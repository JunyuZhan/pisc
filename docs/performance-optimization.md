# 性能优化建议

## 数据库查询优化

### 1. 索引优化

当前数据库迁移文件已包含基础索引：

```sql
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);
```

**建议添加的复合索引**：

```sql
-- 用户 + 时间范围查询优化
CREATE INDEX IF NOT EXISTS idx_photos_user_created ON photos(user_id, created_at DESC);

-- 标签搜索优化
CREATE INDEX IF NOT EXISTS idx_photo_tags_composite ON photo_tags(tag_id, photo_id);
```

### 2. 查询优化

#### 批量查询优化

当前实现中，`getPhotosByIds` 为每张照片单独查询标签和 EXIF：

```typescript
// 当前实现（N+1 查询问题）
const photos = await Promise.all(
  result.results.map(async (photo) => {
    const tagsResult = await tagsStmt.bind(photo.id).all();
    const exifResult = await exifStmt.bind(photo.id).first();
    // ...
  })
);
```

**优化方案**：使用批量查询

```typescript
// 优化后：批量查询
const photoIds = result.results.map(p => p.id);
const placeholders = photoIds.map(() => '?').join(',');

// 批量获取标签
const allTagsStmt = this.db.prepare(`
  SELECT pt.photo_id, t.name, pt.confidence, pt.source
  FROM photo_tags pt
  JOIN tags t ON pt.tag_id = t.id
  WHERE pt.photo_id IN (${placeholders})
`);
const allTags = await allTagsStmt.bind(...photoIds).all();

// 批量获取 EXIF
const allExifStmt = this.db.prepare(`
  SELECT photo_id, exif_json FROM photo_exif
  WHERE photo_id IN (${placeholders})
`);
const allExif = await allExifStmt.bind(...photoIds).all();

// 在内存中组装
const tagsMap = new Map<string, Tag[]>();
allTags.results.forEach(row => {
  if (!tagsMap.has(row.photo_id)) tagsMap.set(row.photo_id, []);
  tagsMap.get(row.photo_id)!.push({
    name: row.name,
    confidence: row.confidence,
    source: row.source
  });
});
```

### 3. 分页优化

当前使用 `LIMIT/OFFSET` 分页，在大数据集上性能较差。

**优化方案**：使用游标分页

```typescript
// 基于时间戳的游标分页
async searchPhotosWithCursor(options: {
  userId?: string;
  cursor?: number; // 上一页最后一条的 created_at
  limit?: number;
}): Promise<SearchResult> {
  const { userId, cursor, limit = 20 } = options;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (userId) {
    conditions.push("user_id = ?");
    params.push(userId);
  }

  if (cursor) {
    conditions.push("created_at < ?");
    params.push(cursor);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const stmt = this.db.prepare(`
    SELECT * FROM photos
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const result = await stmt.bind(...params, limit + 1).all<PhotoRecord>();
  const hasMore = result.results.length > limit;
  const photos = result.results.slice(0, limit);

  return {
    photos,
    hasMore,
    nextCursor: hasMore ? photos[photos.length - 1].created_at : null,
  };
}
```

---

## 向量搜索优化

### 1. 预过滤优化

当前实现先进行向量搜索，再在 D1 中过滤。对于大量数据，可以优化为：

```typescript
// 将常用过滤字段存入 Vectorize metadata
await vectorizeService.upsertVector(photoId, embedding, {
  userId: photo.user_id,
  createdAt: photo.created_at,
  // 其他常用过滤字段
});

// 搜索时直接在 Vectorize 中过滤
const results = await vectorizeService.queryVector(embedding, {
  userId: 'user-123',
  createdAt: { $gte: fromTimestamp }
}, topK);
```

### 2. 缓存热门搜索

对于热门搜索词，可以缓存向量结果：

```typescript
// 使用 Durable Object 或 KV 缓存
const cacheKey = `search:${queryHash}:${userId}:${limit}`;
const cached = await env.CACHE.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const results = await performSearch(query, userId, limit);
await env.CACHE.put(cacheKey, JSON.stringify(results), {
  expirationTtl: 300 // 5 分钟缓存
});

return results;
```

### 3. 向量维度优化

当前使用 768 维向量（BGE-base）。如果性能不足，可以考虑：

- 使用更小的模型（如 384 维）
- 使用降维技术（PCA）
- 评估是否需要所有维度

---

## API 性能优化

### 1. 响应压缩

启用 gzip 压缩减少传输大小：

```typescript
// 在 Worker 中添加压缩中间件
async function compressResponse(response: Response): Promise<Response> {
  const acceptEncoding = request.headers.get('Accept-Encoding') || '';

  if (acceptEncoding.includes('gzip')) {
    const body = await response.text();
    // 使用 Cloudflare 的压缩功能
    return new Response(body, {
      headers: {
        ...response.headers,
        'Content-Encoding': 'gzip',
      },
    });
  }

  return response;
}
```

### 2. 字段选择

允许客户端选择返回字段，减少数据传输：

```typescript
// GET /api/photos?fields=id,tags,score
const fields = params.get('fields')?.split(',') || ['id', 'tags', 'score'];

const filteredPhotos = photos.map(photo => {
  const filtered: any = {};
  fields.forEach(field => {
    if (photo[field] !== undefined) {
      filtered[field] = photo[field];
    }
  });
  return filtered;
});
```

### 3. 批量操作

添加批量获取和删除接口：

```typescript
// POST /api/photos/batch
{
  "ids": ["id1", "id2", "id3"]
}

// DELETE /api/photos/batch
{
  "ids": ["id1", "id2", "id3"]
}
```

---

## 缓存策略

### 1. CDN 缓存

对于公开照片，使用 Cloudflare CDN 缓存：

```typescript
// 在照片详情 API 中添加缓存头
return new Response(JSON.stringify(photo), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600', // 1 小时
    'CDN-Cache-Control': 'public, max-age=86400', // 24 小时
  },
});
```

### 2. 标签缓存

标签列表变化较少，可以长期缓存：

```typescript
// 使用 KV 存储热门标签
const POPULAR_TAGS_KEY = 'popular_tags';

async function getPopularTags(env: Env): Promise<string[]> {
  const cached = await env.KV.get(POPULAR_TAGS_KEY, 'json');
  if (cached) return cached;

  const db = createDatabaseService(env.DB);
  const tags = await db.getPopularTags();

  await env.KV.put(POPULAR_TAGS_KEY, JSON.stringify(tags), {
    expirationTtl: 3600, // 1 小时
  });

  return tags;
}
```

---

## 监控与调优

### 1. 性能指标

添加性能监控：

```typescript
// 在关键操作中记录耗时
const startTime = Date.now();
const result = await db.searchPhotos(options);
const duration = Date.now() - startTime;

console.log(JSON.stringify({
  level: 'info',
  operation: 'searchPhotos',
  duration,
  params: options,
  resultCount: result.photos.length,
}));
```

### 2. 慢查询日志

记录慢查询：

```typescript
const SLOW_QUERY_THRESHOLD = 1000; // 1 秒

if (duration > SLOW_QUERY_THRESHOLD) {
  console.error(JSON.stringify({
    level: 'warn',
    message: 'Slow query detected',
    operation: 'searchPhotos',
    duration,
    params: options,
  }));
}
```

### 3. 查询计划分析

定期分析查询计划：

```sql
-- 在 D1 中执行
EXPLAIN QUERY PLAN
SELECT * FROM photos WHERE user_id = 'user-123' ORDER BY created_at DESC LIMIT 20;
```

---

## 容量规划

### 1. 数据量估算

- 每张照片元数据：约 500 字节
- 每张照片标签：约 100 字节/标签，平均 5 个标签
- 每张照片向量：768 维 × 4 字节 = 3KB

**总存储估算**：
- 1 万张照片：约 40MB（D1）+ 30MB（Vectorize）
- 10 万张照片：约 400MB（D1）+ 300MB（Vectorize）
- 100 万张照片：约 4GB（D1）+ 3GB（Vectorize）

### 2. 查询性能基准

建议定期进行性能测试：

```bash
# 使用 wrk 或 ab 进行压力测试
wrk -t12 -c400 -d30s https://your-worker.workers.dev/api/photos

# 监控响应时间
# P50 < 100ms
# P95 < 500ms
# P99 < 1000ms
```

---

## 下一步优化方向

1. **实现批量查询优化**：解决 N+1 查询问题
2. **添加游标分页**：替代 OFFSET 分页
3. **实现搜索缓存**：缓存热门搜索结果
4. **添加性能监控**：实时监控关键指标
5. **优化向量搜索**：评估预过滤策略
6. **实现 CDN 缓存**：减少重复请求

---

## 参考资料

- [Cloudflare D1 性能优化](https://developers.cloudflare.com/d1/platform/limits/)
- [Vectorize 最佳实践](https://developers.cloudflare.com/vectorize/platform/best-practices/)
- [Workers 性能优化](https://developers.cloudflare.com/workers/platform/limits/)
