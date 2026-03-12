# PIS 项目：可行性、安全性与性能检查报告

本文档基于对当前代码与配置的审查，从**可行性**、**安全性**、**性能**三方面给出结论与改进建议。

**说明**：本项目为**开源仓库**，且已支持 **Cloudflare 关联 GitHub 后推送即自动部署**。因此代码中不得包含任何密钥；所有 Secret 与敏感变量仅在 CF 控制台配置。合并到主分支的改动会在下次推送后自动上线，请确保安全与兼容性后再合并。

---

## 一、可行性

### 结论：可行

- **技术栈**：Workers、R2、D1、Vectorize、Queues、Durable Objects、Workers AI 均为 Cloudflare 官方能力，组合使用无已知不兼容。
- **任务清单**：阶段 1～8 已就绪，A/B/C 接口已对接，完整链路由上传 → Webhook/入队 → DO 状态机 → AI → D1/Vectorize 已跑通。
- **免费额度**：在 CF 免费额度内可零费用部署（详见 `docs/tasklist.md` 方案可行性及免费部署说明）；规模边界受 Queues 1 万次/天、Workers AI Neurons、DO 请求量等限制。
- **部署**：支持 CF 关联 Git 自动部署与本地 `wrangler deploy`，D1 迁移与 Secret 配置有文档说明。

---

## 二、安全性

### 已做得较好的部分

| 项目 | 说明 |
|------|------|
| 密钥不落库 | `.dev.vars`、真实 R2/密钥已列入 `.gitignore`；`wrangler.toml` 使用占位符，README 明确勿提交密钥。 |
| 上传鉴权 | `POST /api/upload/request` 在配置 `AUTH_SECRET` 时要求 Bearer/ApiKey，否则 401。 |
| 照片资源授权 | `handleGetPhoto`、`handleDeletePhoto` 使用 `authorizeResourceAccess`，认证用户仅能访问自己的照片。 |
| SQL 安全 | D1 访问层统一使用 `prepare().bind()`，无拼接 SQL，有效防注入。 |
| 内部端点 | `POST /internal/trigger-processing` 在 `ENVIRONMENT === "production"` 时返回 404，避免生产被滥用。 |
| 预签名 key | 上传 key 由服务端 `createPhotoId()` 生成，客户端无法指定路径，无 path traversal 风险。 |

### 需修复或加强的部分（已修复项已标注）

| 风险 | 说明 | 状态 |
|------|------|------|
| **DELETE 未强制认证** | 未认证时可被匿名按 ID 删除任意照片。 | ✅ 已修复：未认证时返回 401。 |
| **搜索未强制 userId** | 已认证用户若传 `userId=他人` 可能查到他人照片。 | ✅ 已修复：已认证时强制使用当前用户 ID。 |
| **列表/搜索 limit 无上限** | 可传极大 limit 加重 D1/Vectorize 负载。 | ✅ 已修复：limit 上限 100，offset/limit 做 NaN 与范围校验。 |
| **R2 Webhook 校验** | 若生产走 Worker Webhook，需防伪造入队。 | ✅ 已实现：可选 `WEBHOOK_SECRET`，请求头 `X-Webhook-Secret` 须与之一致，否则 401；仍建议生产优先 R2 事件直投 Queue。 |
| **鉴权统一** | 上传与照片 API 应使用同一套鉴权。 | ✅ 已统一：上传与 photos 均使用 `utils/auth.ts`（`authenticateUser`）；支持 Bearer/ApiKey 简单密钥或 JWT、HMAC 签名；`middleware/auth.ts` 已标注弃用。 |

### 生产环境安全清单（开源 + 推送即部署）

- [ ] 在 **CF Dashboard → Variables and Secrets** 中配置 `AUTH_SECRET`（不写入仓库），确保上传与删除等 API 需认证。
- [x] 未认证禁止删除照片、搜索强制当前用户、limit 上限已落实。
- [x] R2 Webhook：可配置 `WEBHOOK_SECRET` + `X-Webhook-Secret`，或生产使用 R2 事件直投 Queue。
- [ ] 定期查看 Billing/Usage 与告警；**推送前确认无敏感信息**，因合并后推送会触发自动部署。

---

## 三、性能

### 已考虑或已实现的部分

| 项目 | 说明 |
|------|------|
| 队列与 DO | `max_concurrency = 5`、`max_batch_size = 1` 控制并发；每图独立 DO，故障隔离与重试清晰。 |
| AI 限流 | `ai.ts` 内 TokenBucket（10 tokens, 1/s）、429 重试与退避，避免打满 Workers AI。 |
| D1 查询 | 迁移中已为常用查询建索引；分页使用 LIMIT/OFFSET，`searchPhotos` 条件与参数化正确。 |
| 向量搜索 | 先 Vectorize topK，再 D1 按 ID 批量取详情，避免全表扫描。 |
| 预签名直传 | 客户端直传 R2，不经过 Worker 转发 body，节省 Worker CPU 与时长。 |

### 建议与可选优化

| 项目 | 说明 |
|------|------|
| limit/offset 上限 | ✅ 已实现：`src/utils/pagination.ts` 中 `parseLimit`/`parseOffset`，limit 上限 100。 |
| 队列 max_concurrency | 与 Workers AI 限流配合，可结合实测在 `wrangler.toml` 中微调（当前 5 合理）。 |
| 搜索 topK | 当前 `topK: limit * 2` 用于后过滤，limit 已加帽；可观察 D1/Vectorize 延迟再调。 |
| 日志与监控 | 已有结构化日志；可接入 Tail Workers 或 Sentry（见 `docs/deploy.md` 监控与告警）。 |
| 依赖安全 | 建议上线前或 CI 中执行 `npm audit`，按提示修复高危依赖。 |

---

## 四、总结

| 维度 | 结论 |
|------|------|
| **可行性** | 技术方案可行，免费额度内可部署，适合个人/小规模首版上线。 |
| **安全性** | 删除需认证、搜索强制 userId、limit 上限、R2 Webhook 可选校验、鉴权统一均已落实；生产配置 `AUTH_SECRET` 与可选 `WEBHOOK_SECRET` 即可。 |
| **性能** | 边缘架构与限流、索引设计合理；limit/offset 已加校验与上限；可结合 `npm audit` 与 Tail Workers/Sentry 做依赖与可观测增强。 |

当前安全与参数校验已就绪，可稳定进入「跑通完整链路 → 部署 → 监控」的迭代。
