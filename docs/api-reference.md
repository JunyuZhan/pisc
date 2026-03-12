# PIS API 参考文档

## 概述

PIS (Photo Intelligence System) 提供了一套完整的 RESTful API，用于照片的上传、管理、搜索和删除。

**基础 URL**: `https://your-worker.your-subdomain.workers.dev`

**认证**: 目前支持可选的 API Key 认证（通过 `AUTH_SECRET` 环境变量配置）

---

## API 端点

### 1. 上传相关

#### POST /api/upload/request

获取预签名上传 URL，用于客户端直传 R2。

**请求体**: 无

**成功响应**（200，注意：本接口不包在 `success`/`data` 中，直接返回）:
```json
{
  "uploadUrl": "https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>?X-Amz-...",
  "publicId": "01HXYZ123456789",
  "expiresAt": 1704067200
}
```

**错误响应**（本接口 401/500 使用简单格式）:
- 401: `{ "error": "Unauthorized" }`
- 500: `{ "error": "Server misconfiguration: R2 credentials not set" }` 或 `{ "error": "Failed to generate upload URL", "detail": "..." }`

**使用示例**:
```bash
# 1. 获取预签名 URL
curl -X POST https://your-worker.workers.dev/api/upload/request

# 2. 使用返回的 uploadUrl 上传文件
curl -X PUT "<uploadUrl>" \
  --data-binary "@photo.jpg" \
  -H "Content-Type: image/jpeg"
```

---

### 2. 照片管理

#### GET /api/photos

获取照片列表，支持分页和过滤。

**查询参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| userId | string | 否 | 用户 ID 过滤 |
| tags | string | 否 | 标签过滤，逗号分隔（如 `nature,sunset`） |
| from | number | 否 | 开始时间（Unix 时间戳） |
| to | number | 否 | 结束时间（Unix 时间戳） |
| limit | number | 否 | 每页数量，默认 20 |
| offset | number | 否 | 偏移量，默认 0 |
| orderBy | string | 否 | 排序字段：`created_at` 或 `updated_at` |
| order | string | 否 | 排序方式：`ASC` 或 `DESC` |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "01HXYZ123456789",
      "user_id": "user-123",
      "object_key": "photos/01HXYZ123456789.jpg",
      "created_at": 1704067200,
      "updated_at": 1704067200,
      "tags": [
        {
          "name": "sunset",
          "confidence": 0.95,
          "source": "ai"
        }
      ],
      "exif": "{\"Make\":\"Apple\",\"Model\":\"iPhone 15\"}"
    }
  ],
  "meta": {
    "total": 100,
    "hasMore": true,
    "limit": 20,
    "offset": 0
  }
}
```

**示例**:
```bash
# 获取用户的所有照片
curl "https://your-worker.workers.dev/api/photos?userId=user-123"

# 获取包含特定标签的照片
curl "https://your-worker.workers.dev/api/photos?tags=sunset,beach"

# 分页查询
curl "https://your-worker.workers.dev/api/photos?limit=10&offset=20"
```

---

#### GET /api/photos/:id

获取单张照片的详细信息。

**路径参数**:
- `id`: 照片 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "01HXYZ123456789",
    "user_id": "user-123",
    "object_key": "photos/01HXYZ123456789.jpg",
    "created_at": 1704067200,
    "updated_at": 1704067200,
    "tags": [
      {
        "name": "sunset",
        "confidence": 0.95,
        "source": "ai"
      }
    ],
    "exif": "{\"Make\":\"Apple\",\"Model\":\"iPhone 15\"}"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Photo not found"
  }
}
```

**示例**:
```bash
curl "https://your-worker.workers.dev/api/photos/01HXYZ123456789"
```

---

#### GET /api/photos/:id/status

获取照片的处理状态。

**路径参数**:
- `id`: 照片 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "photoId": "01HXYZ123456789",
    "status": "completed",
    "details": {
      "exists": true,
      "hasTags": true,
      "hasExif": true
    }
  }
}
```

**状态说明**:
- `processing`: 正在处理中
- `completed`: 处理完成
- `failed`: 处理失败

**示例**:
```bash
curl "https://your-worker.workers.dev/api/photos/01HXYZ123456789/status"
```

---

#### DELETE /api/photos/:id

删除照片及其所有关联数据（R2 对象、向量、数据库记录）。

**路径参数**:
- `id`: 照片 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "photoId": "01HXYZ123456789",
    "deleted": true
  }
}
```

**示例**:
```bash
curl -X DELETE "https://your-worker.workers.dev/api/photos/01HXYZ123456789"
```

---

### 3. 语义搜索

#### GET /api/photos/search

使用自然语言搜索照片。

**查询参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索查询文本 |
| userId | string | 否 | 用户 ID 过滤 |
| tags | string | 否 | 标签过滤，逗号分隔 |
| from | number | 否 | 开始时间（Unix 时间戳） |
| to | number | 否 | 结束时间（Unix 时间戳） |
| limit | number | 否 | 返回数量，默认 20 |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "01HXYZ123456789",
      "user_id": "user-123",
      "object_key": "photos/01HXYZ123456789.jpg",
      "created_at": 1704067200,
      "updated_at": 1704067200,
      "tags": [
        {
          "name": "sunset",
          "confidence": 0.95,
          "source": "ai"
        }
      ],
      "exif": null,
      "score": 0.89
    }
  ],
  "meta": {
    "total": 5,
    "hasMore": false,
    "limit": 20,
    "offset": 0
  }
}
```

**示例**:
```bash
# 搜索日落照片
curl "https://your-worker.workers.dev/api/photos/search?q=beautiful%20sunset%20at%20the%20beach"

# 搜索特定用户的照片
curl "https://your-worker.workers.dev/api/photos/search?q=mountain&userId=user-123"

# 搜索并过滤标签
curl "https://your-worker.workers.dev/api/photos/search?q=outdoor&tags=nature,landscape"
```

---

## 错误处理

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### 错误代码

| 代码 | HTTP 状态码 | 说明 |
|------|------------|------|
| NOT_FOUND | 404 | 资源不存在 |
| BAD_REQUEST | 400 | 请求参数错误 |
| UNAUTHORIZED | 401 | 未授权 |
| FORBIDDEN | 403 | 禁止访问 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 500 | 服务不可用（如数据库未配置） |

---

## 完整工作流示例

### 上传并搜索照片

```bash
# 1. 获取预签名 URL（响应为 { uploadUrl, publicId, expiresAt }，无 success/data 包装）
RESPONSE=$(curl -s -X POST https://your-worker.workers.dev/api/upload/request)
UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')
PHOTO_ID=$(echo $RESPONSE | jq -r '.publicId')

# 2. 上传照片
curl -X PUT "$UPLOAD_URL" \
  --data-binary "@my-photo.jpg" \
  -H "Content-Type: image/jpeg"

# 3. 等待处理完成（轮询状态）
while true; do
  STATUS=$(curl -s "https://your-worker.workers.dev/api/photos/$PHOTO_ID/status" | jq -r '.data.status')
  if [ "$STATUS" = "completed" ]; then
    echo "Processing completed!"
    break
  fi
  sleep 2
done

# 4. 搜索照片
curl "https://your-worker.workers.dev/api/photos/search?q=my%20photo"

# 5. 获取照片详情
curl "https://your-worker.workers.dev/api/photos/$PHOTO_ID"

# 6. 删除照片
curl -X DELETE "https://your-worker.workers.dev/api/photos/$PHOTO_ID"
```

---

## 速率限制

当前版本暂未实现速率限制。建议在生产环境中添加以下限制：

- 上传请求：每用户每分钟 10 次
- 搜索请求：每用户每分钟 100 次
- 其他 API：每用户每分钟 200 次

---

## CORS 配置

Worker 已配置 CORS，支持跨域请求。响应头包括：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## SDK 使用示例

### JavaScript/TypeScript

```typescript
class PISClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async requestUpload() {
    const res = await fetch(`${this.baseUrl}/api/upload/request`, {
      method: 'POST',
    });
    return res.json();
  }

  async uploadFile(uploadUrl: string, file: File) {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
  }

  async searchPhotos(query: string, options?: { userId?: string; tags?: string[] }) {
    const params = new URLSearchParams({ q: query });
    if (options?.userId) params.append('userId', options.userId);
    if (options?.tags) params.append('tags', options.tags.join(','));

    const res = await fetch(`${this.baseUrl}/api/photos/search?${params}`);
    return res.json();
  }

  async getPhoto(photoId: string) {
    const res = await fetch(`${this.baseUrl}/api/photos/${photoId}`);
    return res.json();
  }

  async deletePhoto(photoId: string) {
    const res = await fetch(`${this.baseUrl}/api/photos/${photoId}`, {
      method: 'DELETE',
    });
    return res.json();
  }
}

// 使用示例
const client = new PISClient('https://your-worker.workers.dev');

// 上传照片（/api/upload/request 返回 { uploadUrl, publicId, expiresAt }，无 data 包装）
const { uploadUrl, publicId } = await client.requestUpload();
await client.uploadFile(uploadUrl, file);

// 搜索照片
const { data: photos } = await client.searchPhotos('sunset at beach');
console.log(photos);
```

---

## 注意事项

1. **时间戳格式**: 所有时间戳均为 Unix 时间戳（秒级）
2. **标签来源**: `source` 字段表示标签来源，`ai` 表示 AI 自动打标，`manual` 表示手动添加
3. **相似度分数**: 搜索结果中的 `score` 字段表示相似度，范围 0-1，越大越相似
4. **EXIF 数据**: 存储为 JSON 字符串，需要客户端解析
5. **异步处理**: 照片上传后需要等待处理完成才能搜索到

---

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本
- 实现基础照片管理 API
- 实现语义搜索功能
- 统一响应格式和错误处理
