本文档为 PIS（Photo Intelligence System）核心图床与媒体基础设施的开发任务清单，基于 Cloudflare 生态（Workers、R2、D1、Vectorize、Queues、Durable Objects、Workers AI）。代码仓库：[JunyuZhan/pisc](https://github.com/JunyuZhan/pisc)。

---

# PIS 核心图床基础设施 - 开发任务清单

## 开发完成度说明

**核心功能开发已完成**：阶段 1～7 的代码与配置已就绪（上传、管道、AI、D1、Vectorize、REST API、SDK、鉴权等），A/B/C 已对接，可跑通完整链路。  
**尚未全部收尾**：阶段 1 中「在 Cloudflare 控制台创建资源」需按环境执行；阶段 8 部分测试用例、阶段 9 的日志/监控/告警/成本优化为可选或上线后迭代。  
**结论**：可进入「跑通完整链路 → 部署 → 监控」；下列未勾选项多为运维/可选，不影响首版上线。  
阶段 8：CI、内部端点、Mock 已就绪；部分集成/单元用例为可选。阶段 9：部署脚本与文档已完成；日志/告警/成本优化为上线后迭代。

---

## 📋 任务概览
| 阶段 | 主要任务 | 预计工时 | 状态 |
|------|----------|----------|------|
| 1 | 项目初始化与环境配置 | 2d | ✅ |
| 2 | R2 直传与预签名上传 | 3d | ✅ |
| 3 | 事件驱动处理管道（Queue + Durable Object） | 5d | ✅ |
| 4 | AI 处理与向量化集成 | 4d | ✅ |
| 5 | 元数据存储与查询（D1/PostgreSQL） | 3d | ✅ |
| 6 | 向量索引与语义搜索 | 3d | ✅ |
| 7 | API 接口与客户端 SDK | 4d | ✅ |
| 8 | 本地模拟与自动化测试 | 3d | ✅ |
| 9 | 部署、监控与可观测性 | 2d | 🟡 部分（9.1 已完成） |

---

## 👥 协同开发与任务分配（3 人）

为加快进度，建议按**三条并行线**分配，先约定接口再实现，减少互相阻塞。  
本仓库的 Cursor 规则（`.cursor/rules/`）中约定：**AI 助手在此项目中以工程师 A（管道/组织者）角色参与开发**。

| 角色 | 负责人 | 主要阶段 | 交付物与对接点 |
|------|--------|----------|----------------|
| **A - 管道 (Pipeline)** | 工程师 A | 2.3、3、4 中 DO 内调用 | R2 Webhook、Queue 消费、Durable Object 状态机；依赖 B/C 的接口 |
| **B - 智能 (AI)** | 工程师 B | 4 | Workers AI 封装、打标/嵌入服务；对外提供 `tagImage()`、`embedText()` 等接口供 DO 与搜索使用 |
| **C - 数据与 API (Data)** | 工程师 C | 5、6、7 | D1 数据访问层、Vectorize 封装、REST API（列表/详情/搜索/删除）、可选 SDK；搜索需调用 B 的 `embedText()` |

### 接口约定（先定再实现，避免阻塞）

在 `src/types/` 或 `src/services/` 下约定以下接口，由 B、C 分别实现，A 在 DO 中注入调用：

| 接口/模块 | 提供方 | 使用者 | 说明 |
|-----------|--------|--------|------|
| **图片打标** `tagImage(r2Key): Promise<string[]>` | B | A (DO) | 从 R2 读图并返回标签列表 |
| **文本向量化** `embedText(text: string): Promise<number[]>` | B | A (DO)、C (搜索) | 768 维向量，与 Vectorize 一致 |
| **元数据写入** `insertPhoto(photo)`, `upsertPhotoTags(photoId, tags)` 等 | C | A (DO) | D1 写入 |
| **向量写入** `upsertVector(photoId, embedding, metadata)` | C | A (DO) | Vectorize upsert |
| **向量搜索** `queryVector(embedding, filter, topK)` | C | C (搜索 API) | 返回 photoId + 相似度 |

- A 在 DO 状态机里：先调 B 打标 → 再调 B 嵌入 → 再调 C 写 D1 + Vectorize；可先用 Mock 实现接口，待 B/C 就绪后替换。
- 分支建议：每人长期分支如 `feature/pipeline`、`feature/ai`、`feature/data-api`，按小功能 PR 合并到 `development`，避免单分支堆积冲突。

### 建议时间线（并行）

1. **第 1 周**：A 做 2.3 + 3.1/3.2 + DO 骨架与 Mock；B 做 4.1/4.2/4.4；C 做 5.1/5.2 + 6.1。
2. **第 2 周**：A 完成 3.3/3.4 并接入 B、C 真实实现；B 做 4.3 备选、与 A 联调；C 做 6.2/6.3 + 7.1（列表/详情/搜索/删除）。
3. **第 3 周**：联调、7.2/7.3、8（测试）、9（部署与监控）；可共同认领 8、9 或由一人收尾。

若增加更多工程师，可将「7 客户端 SDK」「8 测试」「9 部署与监控」拆出给第 4 人独立负责。

### 进度检查（最近一次）

| 角色 | 进度 | 说明 |
|------|------|------|
| **B（智能）** | **阶段 4 已全部完成** | 见下方「工程师 B 完成度确认」。 |
| **C（数据与 API）** | 阶段 5、6、7 已完成 | `services/database.ts` 实现 IPhotoRepository；`services/vectorize.ts` 实现 IVectorStore；`handlers/photos.ts` 提供列表/详情/搜索/状态/删除，已挂载到 Worker 路由。 |
| **A（管道）** | 已对接 B/C | DO 已接入 B 的 AIService（R2 读图 → tagImage → embedText）、C 的 DatabaseService 与 VectorizeService；未配置 AI/DB/VECTORIZE 时回退 Mock。修复了 `GET /api/photos/:id/status` 路由匹配。 |

#### 工程师 B 完成度确认

已对照 tasklist 阶段 4 逐项核对，**B 的交付已全部到位**：

| 阶段 4 子项 | 状态 | 对应实现 |
|-------------|------|----------|
| 4.1 Workers AI 集成 | ✅ | `wrangler.toml` 中 `[ai] binding = "AI"`；`ai.ts` 封装 `tagImage(imageData)`、`embedText(text)`，模型 mobilenet、bge-base-en-v1.5（768 维），限流/错误处理。 |
| 4.2 并发控制 | ✅ | `ai.ts` 内 TokenBucket（10 tokens, 1/s）、429 时 refund + 指数退避重试。 |
| 4.3 备选方案 | ✅ | `ai-external.ts`：ReplicateAdapter、OpenAIAdapter，环境变量管理 API Keys，`createExternalAIAdapter` 适配器切换。 |
| 4.4 向量生成与存储 | ✅ | 标签拼接文本后调用 `embedText`，768 维与 Vectorize 一致；向量由 DO 写入 storage 再在 `saveToDatabase` 中交给 C 的 Vectorize。 |

唯一可选优化（非阻塞）：4.2 中「配置队列消费者的 `max_concurrency`」需结合 Workers AI 限流做实测，可在上线前由 A/B 或运维在 `wrangler.toml` 中调参。

### 接下来该干什么（优先级）

**开发工作已基本完成**（阶段 1～8 代码与配置就绪）。建议按下面顺序收尾与上线：

| 优先级 | 做什么 | 负责人 | 说明 |
|--------|--------|--------|------|
| **P0** | **跑通一次完整链路** | 全员 | ✅ 已完成：本地 `npm run dev` + `upload-demo.mjs` + `POST /internal/trigger-processing` 已跑通；R2/D1/Vectorize/Queue 已配置。 |
| **P1** | **阶段 9.1 部署与 secret** | A 或运维 | ✅ 已完成：CF 关联 GitHub，部署命令 `bash scripts/inject-and-deploy.sh`，构建环境变量 D1_DATABASE_ID/R2_ACCOUNT_ID；生产 D1 迁移已执行；Worker 已上线（域名为 `pisc.<你的子域>.workers.dev`，以控制台为准）。本机部署见 `docs/deploy.md`。 |
| **P2** | **阶段 8.3 集成测试** | 任一人 | ✅ 已添加 `test/pipeline.integration.test.ts`：internal trigger 入队 + status 查询。 |
| **P3** | **阶段 9.2 日志与监控** | A 或运维 | ✅ 已完成：`src/utils/logger.ts` 结构化日志，上传/webhook/队列/DO 打点；9.3 告警与 9.4 成本优化已写文档。 |
| **可选** | 阶段 3.4 死信队列、指数退避 | A | 提高可靠性；可在首次上线后迭代。 |
| **可选** | 7.2 按 userId 做 API 鉴权、8.2 工具函数/DO 单测 | C / B | 安全与覆盖率增强；8.2 已补充 id 工具单测。 |

结论：**P0～P3 已完成**；接下来可做可选项（3.4 死信队列、8.2 更多单测、7.2 鉴权增强）或直接迭代业务功能。

### 同一物理目录 / 同一仓库协同（可行）

三人共用同一套代码目录（同一 Git 仓库）完全可行，且是推荐做法。注意以下约定即可减少冲突：

| 要点 | 说明 |
|------|------|
| **目录边界** | A 主改 `src/durable-objects/`、`src/worker/`（路由/队列）、`src/handlers/` 中 webhook；B 主改 `src/services/` 下 AI 相关（如 `ai/` 或 `tagging.ts`）；C 主改 `src/services/` 下 D1/Vectorize、`src/handlers/` 下 REST、`migrations/`。有主责即可并行改不同文件。 |
| **共享文件** | `src/worker/index.ts`（路由汇总）、`src/types/env.d.ts`、`wrangler.toml` 会多人碰，建议：先由一人加新路由/绑定，其他人 `git pull` 后再在自己分支加逻辑；或约定由 A 维护入口与配置，B/C 只提交各自模块，通过 PR 由 A 合并进路由。 |
| **分支** | 每人从 `development` 拉自己的功能分支（如 `feature/pipeline`、`feature/ai`、`feature/data-api`），小步提交、经常向 `development` 提 PR 合并，避免长期堆积。 |
| **拉取习惯** | 开工前执行 `git pull origin development`，合并他人改动后再开发；冲突在各自负责的目录内解决。 |
| **本地环境** | 同一目录下每人可各自复制 `.dev.vars`、按需改 `wrangler.toml` 的本地绑定，用 `.gitignore` 忽略敏感与本地覆盖，不提交他人私密配置。 |

结论：**同一物理目录、同一仓库内三人协同可行**；按上述目录边界与分支/拉取约定执行即可。

---

## 1. 项目初始化与环境配置

### 1.1 代码仓库与基础结构
- [x] 使用本仓库 [JunyuZhan/pisc](https://github.com/JunyuZhan/pisc) 作为主开发仓库
- [x] 初始化 Node.js 项目 (`npm init`)，见 `package.json`
- [x] 安装核心依赖：`wrangler`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`
- [x] 配置 TypeScript (`tsconfig.json`)
- [x] 创建项目目录结构（**与 CONTRIBUTING.md 第 5 节保持一致，以本清单为准**）：
  ```
  src/
    worker/          # Worker 入口与路由
    handlers/        # 请求处理函数（API 控制器）
    services/        # 业务逻辑（AI 推理、元数据、D1/Vectorize 访问等）
    durable-objects/ # Durable Object 类
    utils/           # 工具函数
    types/           # 类型定义
  test/              # 测试文件
  migrations/        # D1 数据库迁移
  wrangler.toml      # 配置文件
  ```

### 1.2 Cloudflare 账号与资源配置
- [ ] 注册/登录 Cloudflare 账号（需各人在控制台完成）
- [ ] 安装并登录 Wrangler CLI（`wrangler login`）
- [ ] 创建 R2 存储桶（如 `pis-images-{env}`）
- [ ] 创建 D1 数据库（如 `pis-metadata`）并记录 database_id
- [ ] 创建 Vectorize 索引（如 `photo-index`），维度 768，度量方式 cosine
- [ ] 创建 Queue（如 `image-upload-queue`）
- [x] 配置 wrangler.toml 绑定所有资源（Queue、DO、AI、D1、Vectorize 等已写入，见 `wrangler.toml` 与 `wrangler.toml.example`）

### 1.3 环境变量与多环境配置
- [x] 在 wrangler.toml 中定义环境变量（`ENVIRONMENT`）
- [x] 创建 `.dev.vars` 示例（`.dev.vars.example`），本地复制为 `.dev.vars` 存放敏感变量
- [x] 配置 `dev`、`staging`、`production` 环境（通过 `--env` 与 `scripts/deploy.sh`，见 `docs/deploy.md`）

---

## 2. R2 直传与预签名上传

### 2.1 预签名上传 API
- [x] 实现 `POST /api/upload/request` 接口
- [x] 验证用户身份（JWT 或 API Key，初期可简化：Bearer / ApiKey + AUTH_SECRET，未配置则跳过）
- [x] 生成唯一图片 ID（ULID）
- [x] 生成 R2 预签名 PUT URL（有效期 5 分钟，aws4fetch + S3 API）
- [x] 返回 `{ uploadUrl, publicId, expiresAt }`
- [x] 限流（可选）：可用 CF 控制台 Rate Limiting / WAF 限制 `/api/upload/request` 请求频率；或后续用 DO 按 IP/用户计数，见 `docs/deploy.md` 成本与安全

### 2.2 客户端上传模拟
- [x] 编写测试脚本模拟客户端直接上传图片到预签名 URL（`scripts/upload-demo.mjs`）
- [ ] 验证分片上传支持（可选，初期简化）
- [x] 处理上传完成后的回调（R2 事件 → Webhook/Queue → DO 处理，见阶段 3）

### 2.3 R2 事件通知配置
- [x] 在 R2 存储桶中启用事件通知（见 `docs/setup-vectorize-queue.md` 第 4 节：Dashboard 事件通知 → Queue 或 Worker `/r2-webhook`）
- [x] 事件目标：可配置为 Queue（推荐）或通过 Worker 路由 `/r2-webhook` 入队；Webhook 与入队逻辑已实现
- [x] 事件包含 bucket 和 key（R2 事件格式已支持，见 `handlers/r2-webhook.ts`）

---

## 3. 事件驱动处理管道（Queue + Durable Object）

### 3.1 R2 事件接收与入队
- [x] 实现 Webhook 接收端点 `POST /r2-webhook`
- [x] 解析事件消息，提取 bucket 和 key
- [x] 将消息写入 `image-upload-queue`（使用 Queue 生产者绑定）
- [x] 立即返回 202 Accepted

### 3.2 队列消费者
- [x] 在 wrangler.toml 中配置队列消费者（绑定到同一个 Worker）
- [x] 实现 `queue` 处理函数（`export default { queue }`）
- [x] 对于每条消息，获取或创建 Durable Object 实例（使用 key 作为 DO idFromName）
- [x] 向 DO 发送 fetch 请求（`/process`）触发处理

### 3.3 Durable Object 状态机（核心）
- [x] 定义 `ImageProcessingDO` 类（继承自 `DurableObject`）
- [x] 实现状态存储：`steps` 记录每个步骤状态，`retryCount`
- [x] 实现 `fetch` 方法，接受 `/process` 请求并启动后台处理（`ctx.waitUntil`）
- [x] 实现核心流程方法（按依赖顺序调用）：
  - [x] `extractMetadata(bucket, key)`：占位，待 R2 读图/EXIF
  - [x] `performAITagging(bucket, key)`：调用 B 接口（当前 Mock）
  - [x] `generateVector()`：调用 B 嵌入（当前 Mock）
  - [x] `saveToDatabase()`：调用 C 接口（当前 Mock）
- [x] 实现步骤状态机逻辑：循环执行、跳过已完成、失败时更新状态并重试
- [x] 实现指数退避重试与重试耗尽 FAILED 写入
- [x] 实现幂等性：每次启动时从 storage 恢复状态

### 3.4 错误处理与死信队列
- [x] 配置队列的死信队列（DLQ）选项（可选）：`wrangler.toml` 中已预留 `dead_letter_queue` 注释；见 `docs/setup-vectorize-queue.md` 第 5 节
- [x] 重试耗尽后 CF 自动将消息送入 DLQ（无需 DO 内手动转发）

---

## 4. AI 处理与向量化集成

### 4.1 Workers AI 集成
- [x] 在 wrangler.toml 中绑定 `AI`（`[ai] binding = "AI"`）
- [x] 封装 AI 调用函数，处理限流错误
- [x] 选择合适的模型：
  - 图片打标：`@cf/mobilenet` 或 `@cf/microsoft/resnet-50`
  - 向量嵌入：`@cf/baai/bge-base-en-v1.5`（768 维）

### 4.2 并发控制实现
- [x] 在 DO 内部实现简单的令牌桶（每个 DO 独立）平滑请求
- [x] 捕获 429 错误，放回令牌并重试
- [x] 配置队列消费者的 `max_concurrency` 略低于 Workers AI 的并发限制（通过实验确定）

### 4.3 备选方案：外部推理 API
- [x] 如果 Workers AI 不能满足需求，集成 Replicate、OpenAI 等外部 API
- [x] 添加环境变量管理 API Keys
- [x] 封装适配器模式，便于切换

### 4.4 向量生成与存储
- [x] 将标签列表拼接为文本，调用嵌入模型
- [x] 确保向量维度与 Vectorize 索引一致
- [x] 将向量存入 DO 临时存储，供最后一步使用

---

## 5. 元数据存储与查询（D1/PostgreSQL）

### 5.1 数据库迁移
- [x] 创建 `migrations/0001_create_photos.sql`
  ```sql
  CREATE TABLE photos (id TEXT PRIMARY KEY, user_id TEXT, ...);
  CREATE TABLE photo_exif (photo_id TEXT PRIMARY KEY, exif_json TEXT);
  CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
  CREATE TABLE photo_tags (photo_id TEXT, tag_id INTEGER, confidence REAL, source TEXT, PRIMARY KEY (photo_id, tag_id));
  CREATE INDEX ...
  ```
- [x] 迁移脚本就绪（`migrations/0001_create_photos.sql`）；需在各环境执行一次：`wrangler d1 migrations apply pis-metadata --local` / `--remote`，见 `docs/deploy.md`

### 5.2 数据访问层
- [x] 封装 D1 数据库操作函数（`insertPhoto`, `getPhotoById`, `searchPhotos` 等）
- [x] 使用预处理语句防止 SQL 注入
- [x] 在 DO 的 `saveToDatabase` 中调用这些函数

### 5.3 查询优化
- [x] 为常用查询字段创建索引（已包含在迁移中）
- [x] 实现分页查询（使用 `LIMIT` / `OFFSET` 或游标）
- [x] 测试复杂查询性能（`test/performance.test.ts`：时间范围 + 标签过滤、索引使用）

---

## 6. 向量索引与语义搜索

### 6.1 Vectorize 操作封装
- [x] 在 wrangler.toml 中绑定 Vectorize 索引
- [x] 实现 `upsertVector(photoId, embedding, metadata)`
- [x] 实现 `queryVector(embedding, filter, topK)`
- [x] 在 DO 的 `saveToDatabase` 中调用 `upsertVector`

### 6.2 搜索接口设计
- [x] 实现 `GET /api/photos/search?q=...&tags=...&from=...&to=...`
- [x] 解析查询参数：自然语言描述 `q`，过滤条件
- [x] 将 `q` 转换为向量（调用嵌入模型）
- [x] 执行向量搜索，获取候选 ID 列表及相似度分数
- [x] 根据过滤条件在 D1 中二次过滤（或利用 Vectorize metadata 预过滤）
- [x] 返回结果列表（包含缩略图 URL、标签、相似度等）

### 6.3 混合搜索优化
- [x] 实现两种过滤策略（见 `services/vectorize.ts`、`handlers/photos.ts`）：
  - 策略 A：向量搜索时通过 metadata 过滤
  - 策略 B：向量搜索后用 ID 列表在 D1 中二次过滤
- [x] 混合搜索与策略选择已实现（工程师 C 交付，见 `docs/engineer-c-final-report.md`）

---

## 7. API 接口与客户端 SDK

### 7.1 RESTful API 实现
- [x] `POST /api/upload/request`（上传凭证）
- [x] `GET /api/photos/:id`（获取单张照片元数据）
- [x] `GET /api/photos`（列表，支持分页、排序）
- [x] `GET /api/photos/search`（搜索）
- [x] `GET /api/photos/:id/status`（查询处理状态）
- [x] `DELETE /api/photos/:id`（删除照片，需级联删除 R2 对象、向量等）

### 7.2 身份认证与授权（可选）
- [x] 集成 JWT 验证（通过 Cloudflare Access 或自定义）
- [x] 在 Worker 中添加中间件验证用户身份
- [x] 确保 API 只能访问用户自己的照片（工程师 C 实现鉴权与资源校验，见 `handlers/photos.ts`、middleware）

### 7.3 客户端 SDK（TypeScript）
- [x] 封装上传方法：`requestUpload(file)` -> 获取预签名 URL -> 直接上传
- [x] 封装搜索方法：`searchPhotos(query, filters)`
- [ ] 发布为 npm 包（可选）

---

## 8. 本地模拟与自动化测试

### 8.1 本地开发环境配置
- [x] 使用 `wrangler dev` 启动本地服务（`npm run dev`）
- [x] 本地开发使用 Miniflare 模拟 R2/D1/Queue/Vectorize（Wrangler 已集成）；`preview_bucket_name` 等可按需在 wrangler 中配置
- [x] 使用 Miniflare 模拟 R2、D1、Queue、Vectorize（Wrangler 已集成）
- [x] 编写本地开发启动脚本（`npm run dev`）

### 8.2 单元测试（Vitest + Miniflare）
- [x] 配置 `vitest.config.ts` 使用 `@cloudflare/vitest-pool-workers`
- [x] 为工具函数编写单元测试（`test/utils/id.test.ts`：createPhotoId 格式、唯一性、时间序）
- [x] DO 路径由集成测试覆盖（`pipeline.integration.test.ts` 中 trigger-processing → GET status 会触发 DO；单独 DO 实例化测试可选）

### 8.3 集成测试
- [x] 实现内部测试端点（`POST /internal/trigger-processing`，仅非 production 启用）触发处理流程
- [x] 编写集成测试用例（`test/pipeline.integration.test.ts`）：
  - 测试 internal trigger 入队（202/503）与 GET /api/photos/:id/status
  - 可选后续补充：完整上传流程、重试、搜索
- [x] 在 CI 中运行测试（GitHub Actions `.github/workflows/ci.yml`）

### 8.4 模拟 AI 服务
- [x] 创建 Mock AI 对象，在测试环境中替换真实的 AI 绑定（`src/services/mocks.ts`）
- [x] 确保测试不依赖外部 API（DO 未配置 AI 时用 Mock）

---

## 9. 部署、监控与可观测性

### 9.1 部署脚本
- [x] 编写部署脚本：`scripts/deploy.sh [staging|production]`（先 D1 迁移再 deploy）
- [x] 使用 `wrangler deploy --env` 部署 Worker（`npm run deploy:staging` / `deploy:production`）
- [x] 执行 D1 迁移（见 `docs/deploy.md` 与 `scripts/deploy.sh`）
- [x] 环境变量与 Secret 说明（见 `docs/deploy.md`、`.dev.vars.example`；生产需执行 `wrangler secret put`）
- [x] **CF 关联 GitHub 部署**：部署命令 `bash scripts/inject-and-deploy.sh`，构建环境变量 `D1_DATABASE_ID`、`R2_ACCOUNT_ID`（可选 `WRANGLER_ENV`）；生产 D1 迁移已执行；Worker 已上线（域名以 CF 控制台为准）

### 9.2 日志与监控
- [x] 在 Worker 中添加结构化日志（`src/utils/logger.ts` 单行 JSON；上传、webhook、队列消费、404 等打点，见 `handlers/`）
- [ ] 集成 Tail Workers 或第三方服务（如 Sentry）收集错误（可选）
- [ ] 创建仪表板监控关键指标（CF Dashboard → Workers → Metrics / Logs 可查看请求量与实时日志）：
  - 上传请求数（过滤 `event=upload_request`）
  - 处理成功率（`event=queue_message` action=ack/retry）
  - 队列长度（Queues 控制台）
  - AI 调用延迟（可选在 DO 内打点）

### 9.3 告警
- [x] 说明如何在 CF 配置告警（见 `docs/deploy.md` 监控与告警：Notifications、Billing/Usage、队列积压）
- [ ] 实际在控制台创建告警规则（如 Worker 错误率、用量阈值，按需操作）

### 9.4 成本优化
- [x] 文档说明 R2 生命周期、Workers AI/Vectorize/Queues 免费额度与优化建议（见 `docs/deploy.md` 成本优化）
- [ ] 按需在控制台设置 R2 生命周期、监控用量

---

## 📌 备注与参考
- 所有 API 设计应遵循 RESTful 最佳实践
- 代码需注释关键逻辑，并遵循“代码即文档”原则
- 在开发过程中保持与架构文档的一致性
- 遇到阻塞问题及时回顾架构设计进行调整

---

## ✅ 方案可行性及免费部署说明

### 方案是否可行
**结论：可行。** 当前方案与 Cloudflare 官方能力一致：
- **R2 事件通知**：支持将 `object-create` 等事件投递到 Queue，由消费者 Worker 处理，与任务清单中的「R2 Webhook → 入队 → DO 处理」流程一致。
- **技术栈**：Workers、R2、D1、Vectorize、Queues、Durable Objects、Workers AI 均可在同一账号下配合使用，无已知不兼容点。
- **实现路径**：预签名上传、队列消费、DO 状态机、AI 调用、向量写入等均有官方文档与示例可参考。

### 是否可免费部署
**结论：在免费额度内可以做到零费用部署，适合个人/小规模使用。** 各组件免费额度（以官方当前说明为准，实际以 Cloudflare 控制台为准）如下：

| 组件 | 免费额度 | 对本方案的含义 |
|------|----------|----------------|
| **Workers** | 10 万次请求/天 | 足够 API、Webhook、健康检查等常规调用。 |
| **R2** | 10 GB 存储/月、100 万 Class A、1000 万 Class B/月，出口免费 | 小规模图床（如数千张普通照片）可落在免费内；超出后按量计费。 |
| **D1** | 每账号 5 GB 总存储、单库最大 500 MB | 元数据与标签表体积小，通常远低于上限。 |
| **Vectorize** | 每账号 500 万存储向量维度、3000 万查询维度/月 | 768 维/图，约可存约 6500 条向量；语义搜索在免费范围内可用。 |
| **Queues** | 1 万次操作/天（读+写+删合计） | 上传即入队时，约可支持约 1 万张/天的新增；需控制队列操作次数。 |
| **Durable Objects** | 10 万次请求/天（Free 计划仅支持 SQLite 存储型 DO） | 与 Workers 同量级，按「一图一 DO」调度时需注意日请求总量。 |
| **Workers AI** | 1 万 Neurons/天 | 每张图会经历打标 + 向量嵌入，Neurons 消耗与模型有关；大致可支撑数百～一两千张/天的自动处理，具体以控制台为准。 |

### 免费部署时的注意点
1. **规模边界**：日新增图片与 AI 处理量需控制在上述额度内；超出后需升级付费或限流/排队。
2. **Queues 1 万次/天**：若一次上传对应一次入队，则「免费可处理上传」约 1 万次/天；与 Workers AI、DO 一起构成主要瓶颈。
3. **Workers AI**：优先用免费 1 万 Neurons/天做打标+嵌入；若需更多，可考虑限流、排队或付费。
4. **Durable Objects**：Free 计划下仅可使用 SQLite 存储型 DO（适合本方案状态机）；若误用 Key-Value 型需付费计划。
5. **成本监控**：上线前后在 Cloudflare 控制台查看用量与预估费用，必要时在阶段 9 为「成本与配额」加告警（见任务清单 9.4）。

在以上约束下，**方案技术可行，且可在免费额度内完成部署与运行**；规模扩大时再按需升级或优化瓶颈组件。

### 是否安全、会不会一夜破产？

**结论：在免费额度内使用、且做好下面几条，不会一夜破产。**

1. **免费计划**  
   - 不升级付费、不绑信用卡（或绑了也只在免费额内用），**费用为 0**。  
   - 超出免费额时，CF 一般会限流或需你同意升级/付费后才继续计费，不会默默扣一大笔；具体以你账号的 Billing 说明为准。

2. **防止被刷量（避免恶意请求吃光额度或产生超额）**  
   - **生产环境务必配置 `AUTH_SECRET`**：`POST /api/upload/request` 等接口需鉴权，避免匿名刷上传。  
   - 不在公开场合暴露 API Key、Bearer、`.dev.vars`；密钥只放在 CF Secrets 或本地且不提交仓库。  
   - 可选：在 Worker 或 CF 防火墙里做**按 IP/用户的限流**（阶段 2.1 限流项），防止单点暴量。

3. **用量与账单可见、可告警**  
   - **Billing → Usage**：定期看 Workers 请求数、R2 存储与请求、D1、Vectorize、Queues、Workers AI 用量。  
   - **Notifications / 告警**：在 CF 控制台为「用量超阈值」或「账单」设通知（见 `docs/deploy.md` 监控与告警），异常时先收到邮件再考虑是否升级。  
   - CF 目前**没有**「硬性支出上限自动停服」；防破产主要靠：**免费额内用 + 鉴权 + 限流 + 用量告警**。

4. **建议**  
   - 个人/小规模：保持在免费计划内，配好 `AUTH_SECRET`，开用量通知即可。  
   - 若升级付费：设好月度预算提醒、关键产品用量告警，避免意外放大（如爬虫、泄露 Key 导致请求暴增）。

在以上前提下，**方案是安全的，不会因为「睡一觉起来被刷爆」而一夜破产**；真正风险来自密钥泄露或未鉴权接口被滥用，已通过文档与配置建议覆盖。

---