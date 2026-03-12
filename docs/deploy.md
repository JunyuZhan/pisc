# Pisc 部署说明（阶段 9）

## 密钥与配置（仓库开源）

- **仓库根即项目根**：克隆后无嵌套目录，`cd pisc` 即为项目根。
- **仓库里只保留占位符**：`wrangler.toml` 中不写真实 Account ID、database_id，方便开源。
- **配置与密钥只在 Cloudflare**：在 CF 控制台关联 GitHub 后，环境变量和 Secret 都在 **CF Dashboard** 里填写，无需下载代码到本机、无需改仓库里的文件。

---

## 推荐：在 CF 控制台关联 GitHub，构建时注入后部署（无需本机）

不下载到本地也可以部署：在 Cloudflare 控制台连接 GitHub 仓库，用**构建时注入**把 `database_id`、`R2_ACCOUNT_ID` 等写入配置后再执行 deploy，仓库内保持占位符。

### 1. 在 CF 控制台连接 GitHub

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**。
2. 点击 **Create application** → **Connect to Git**（或 **Create Worker** → 从 Git 导入）。
3. 选择 **GitHub**，授权并选择仓库 **JunyuZhan/pisc**（或你的 fork）。
4. **Production branch**：`main`。**Root directory**：留空。

### 2. 构建时注入：部署命令与构建环境变量

因 `wrangler.toml` 不支持从环境变量读 `database_id`，需在**构建阶段**用脚本注入后再 deploy：

- **Deploy command**（构建配置里的「部署命令」）改为：
  ```bash
  bash scripts/inject-and-deploy.sh
  ```
  若默认是 `npx wrangler deploy`，替换成上面这一行。

- **Build 环境变量**（同一项目的 Build / Environment variables，用于构建时注入，**不是** Worker 运行时的 vars）必填：
  | 变量名 | 说明 |
  |--------|------|
  | `D1_DATABASE_ID` | D1 数据库 ID（如 `30d22a93-39cb-4a44-8e2c-b86df6e212ac`） |
  | `R2_ACCOUNT_ID` | 用于 R2 的 Account ID（如 R2 API 域名前缀或 CF 账号 ID） |
  | `WRANGLER_ENV` | 可选。要部署的环境，如 `production` 或 `staging`，不填则用默认环境 |

脚本会把这些值替换进 `wrangler.toml` 的占位符后再执行 `wrangler deploy`，仓库内无需提交真实 ID。

### 3. Worker 运行时：Variables and Secrets / Bindings

在 **Workers & Pages** → 选中该 Worker → **Settings**：

- **Variables and Secrets**：  
  - **Environment variables**（运行时）：`ENVIRONMENT`、`R2_ACCOUNT_ID`、`R2_BUCKET_NAME` 等（若已在 inject 脚本里写进 toml，部分可省略，按需配置）。  
  - **Secrets**：`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`，可选 `AUTH_SECRET`。
- **Bindings**：R2、D1、Vectorize、Queues、Durable Objects、AI 等与 `wrangler.toml` 一致（通常由 toml 决定，无需在控制台再绑一遍，除非你只用 Dashboard 绑）。

这样，**构建时注入**负责把 D1/R2 的 ID 写进配置，密钥与运行时变量只在 CF 控制台填写，不写进仓库。

### 4. D1 迁移（首次或 schema 变更时）

若使用 Git 关联部署，**第一次**建好 D1 后，需要在 CF 执行一次 D1 迁移。可以任选其一：

- **在 CF 控制台**：D1 → 选中数据库 → **Migrations**，按提示上传或执行 `migrations/0001_create_photos.sql` 中的 SQL。  
- **或在本机执行一次**：`npx wrangler d1 migrations apply pis-metadata --remote`（只需执行一次，之后推送代码即可由 CF 自动部署 Worker）。

### 5. 之后怎么更新

代码推送到 GitHub 的 `main` 后，若已连接 Git，Cloudflare 会自动重新构建并部署，无需在本机跑 `wrangler deploy`。

---

## 备选：本机用 Wrangler 部署

若你希望用本机命令行部署（或 CF 控制台暂未提供 Git 连接时），可按下面步骤操作。

### 1. 本地填写 wrangler.toml（仅本机，不提交）

仓库里的 `wrangler.toml` 使用占位符，**不会也不应**包含你的真实 Account ID、database_id。  
部署时请**只在你本机**克隆的项目里修改这一份配置，用来告诉 Wrangler 要绑定哪些 CF 资源：

- 打开本机项目根目录下的 `wrangler.toml`
- 将 `R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、`database_id` 等占位符改成你在 CF 创建的资源 ID
- **不要把这些修改提交到 Git / 推送到仓库**（仅用于你本机部署）

若尚未创建 R2、D1、Vectorize、Queue，请先按 [docs/setup-vectorize-queue.md](setup-vectorize-queue.md) 在 Cloudflare 控制台或命令行创建。

### 2. 登录 Wrangler

```bash
npx wrangler login
```

按提示在浏览器中登录你的 Cloudflare 账号。

### 3. 设置 Secret（每个环境执行一次）

部署到 **staging** 时：

```bash
npx wrangler secret put R2_ACCESS_KEY_ID --env staging
npx wrangler secret put R2_SECRET_ACCESS_KEY --env staging
```

按提示输入在 R2 → Manage R2 API Tokens 中创建的 Access Key ID 与 Secret Access Key。  
若需上传/API 鉴权，可再执行：`npx wrangler secret put AUTH_SECRET --env staging`。

部署到 **production** 时，将上述命令中的 `--env staging` 改为 `--env production`。

### 4. 执行部署

**推荐：使用部署脚本（先跑 D1 迁移，再部署 Worker）**

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh staging
```

或分步执行：

```bash
# 远程 D1 迁移（首次或 schema 变更时）
npx wrangler d1 migrations apply pis-metadata --remote --env staging

# 部署 Worker
npm run deploy:staging
```

部署成功后，Worker 会出现在 Cloudflare Dashboard → Workers & Pages，默认域名为 `pisc.<你的子域>.workers.dev`（staging 时可能为 `pisc-staging`，以控制台为准）。

---

## 前置条件（检查清单）

- 已在 Cloudflare 创建：R2 桶、D1 数据库（名称与 `wrangler.toml` 中 `database_name` 一致）、Vectorize 索引（`photo-index`）、Queue（`image-upload-queue`）。
- **用 CF 关联 GitHub 部署**：在 Worker 的 **Settings → Variables and Secrets / Bindings** 里填写 `R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、D1/Vectorize/Queue 绑定及 R2 等 Secret。
- **用本机 Wrangler 部署**：在本机 `wrangler.toml` 中填写真实 ID，并用 `wrangler secret put` 配置 R2 密钥。

## 所需 Secret / 环境变量

部署到 staging 或 production 前，需在对应环境下设置以下 Secret（不写入仓库）：

| 变量名 | 说明 | 设置方式 |
|--------|------|----------|
| `R2_ACCESS_KEY_ID` | R2 API 访问密钥 ID（预签名上传用） | `npx wrangler secret put R2_ACCESS_KEY_ID --env staging` |
| `R2_SECRET_ACCESS_KEY` | R2 API 机密密钥 | `npx wrangler secret put R2_SECRET_ACCESS_KEY --env staging` |
| `AUTH_SECRET` | 可选。上传/API 鉴权用 Bearer 或 ApiKey | `npx wrangler secret put AUTH_SECRET --env staging` |

非 Secret 的变量（如 `R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、`ENVIRONMENT`）在 `wrangler.toml` 的 `[vars]` 或 `[env.<name>.vars]` 中配置；多环境时在 `[env.staging]`、`[env.production]` 下覆盖 `vars` 与绑定（如 `database_id`）即可。

## 部署步骤

1. **本地执行 D1 迁移（可选，首次或 schema 变更时）**
   ```bash
   npx wrangler d1 migrations apply pis-metadata --local   # 本地
   npx wrangler d1 migrations apply pis-metadata --remote --env staging  # 远程 staging
   npx wrangler d1 migrations apply pis-metadata --remote --env production  # 远程 production
   ```

2. **使用部署脚本（推荐）**
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh staging      # 先迁移再 deploy:staging
   ./scripts/deploy.sh production   # 先迁移再 deploy:production
   ```

3. **或仅部署 Worker**
   ```bash
   npm run deploy:staging
   npm run deploy:production
   ```

### 部署到 production

与 staging 相同，只需把环境改为 `production`：

1. 为 production 设置 Secret：`npx wrangler secret put R2_ACCESS_KEY_ID --env production`（及 `R2_SECRET_ACCESS_KEY`、可选 `AUTH_SECRET`）。
2. 执行：`./scripts/deploy.sh production`，或先 `npx wrangler d1 migrations apply pis-metadata --remote --env production` 再 `npm run deploy:production`。

若 staging 与 production 使用不同的 D1/R2（如不同 `database_id`），需在 `wrangler.toml` 的 `[env.production]` 下覆盖对应绑定。

---

## 从 GitHub 自动部署（可选）

**更推荐**：用上文「在 CF 控制台关联 GitHub」方式，密钥和配置全在 CF 填，push 后由 CF 自动构建部署，无需在 GitHub 存密钥。

若你希望用 **GitHub Actions** 触发部署，需在 GitHub 仓库 **Settings → Secrets and variables → Actions** 里配置 **CLOUDFLARE_API_TOKEN**（用于调用 CF 部署接口，不是应用业务密钥）。可使用仓库里的 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)，推送到 `main` 会触发 D1 迁移 + Worker 部署。若不想在 GitHub 存任何密钥，请用「CF 控制台关联 GitHub」或本机 `./scripts/deploy.sh` 部署。

## 监控与告警（阶段 9.2 / 9.3）

- **结构化日志**：Worker 内对上传、webhook、队列消费、DO 处理结果、404 等打点（单行 JSON，见 `src/utils/logger.ts`）。字段含 `event`、`ts`，便于过滤。
- **查看日志**：Cloudflare Dashboard → Workers & Pages → 选择 Worker → **Logs**（Real-time Logs / Tail）可查看实时输出；按 `event=upload_request`、`event=queue_batch`、`event=do_pipeline` 等过滤。
- **Metrics**：同上 → **Metrics** 查看请求数、错误率。
- **Queues**：Queues 控制台查看队列积压与消费情况。
- **告警（9.3）**：在 CF Dashboard → **Notifications**（或 Account → Notifications）中可创建告警，例如：
  - Worker 错误率超过阈值（需先在该 Worker 的 Metrics 中查看是否有对应指标）
  - 账户用量告警（R2、D1、Workers 请求等）在 **Billing** → **Usage** 或 **Notifications** 中配置
  - 队列积压可结合 Queues 控制台与自定义 Worker 健康检查实现

## 成本与安全：避免意外账单

- **免费计划**：在免费额度内使用、不升级付费，费用为 0；超出后通常需你确认才计费，不会默默扣一大笔。
- **生产必配鉴权**：设置 `AUTH_SECRET`（`wrangler secret put AUTH_SECRET`），避免 `POST /api/upload/request` 等接口被匿名刷量吃光额度。
- **用量告警**：Billing → Usage 定期查看；Notifications 中为用量/账单设通知，异常时先收到邮件。
- **密钥勿泄露**：API Key、Bearer、R2 密钥仅放在 CF Secrets 或本地 `.dev.vars`，不提交仓库、不贴到公开渠道。
- **上传限流（可选）**：见下方「配置上传限流」。
- 详见 `docs/tasklist.md` 末尾「是否安全、会不会一夜破产？」。

### 配置上传限流（可选）

限制 `POST /api/upload/request` 的请求频率，防止单 IP/用户刷量。

**方式 A：自定义域名 + WAF Rate Limiting**

若 Worker 已通过 **Custom Domains** 绑到自己的域名（如 `api.example.com`），在该域名的 **Security → WAF → Rate limiting rules** 中：

1. **Create rule**（创建规则）。
2. **Expression**：选 **URI Path**，运算符 **equals**，值填 `/api/upload/request`（或 **contains** `/api/upload/request`）。
3. **Rate limit**：例如 **10 requests per 60 seconds**，**Characteristics** 选 **IP**。
4. **Action**：**Block** 或 **Challenge**；**Duration** 如 60 秒。
5. 保存后，同一 IP 在 60 秒内超过 10 次上传请求会被拦截。

**方式 B：仅 workers.dev 或未绑域名**

- 使用 **Workers Rate Limiting** 绑定（需 Wrangler 4.36+）：在 `wrangler.toml` 配置 `[rate_limits]`，在 Worker 里对 `POST /api/upload/request` 调用 `env.XXX.limit({ key: 用户/IP })`，超出返回 429。详见 [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。
- 或后续在代码内用 **Durable Object** 按 IP/用户计数，超过 N 次/分钟返回 429。

## 成本优化（阶段 9.4）

- **R2**：Dashboard → R2 → 桶 → Settings 可设生命周期（如 30 天后转冷存储）；关注 Class A/B 请求量与存储 GB。
- **Workers AI**：免费额度约 1 万 Neurons/天；在 Dashboard 查看用量，按需限流或选用更轻量模型。
- **Vectorize**：免费额度内注意存储向量数与查询量；可对热门搜索做应用层缓存减少查询。
- **Queues**：免费约 1 万次操作/天；控制入队频率与批量大小。
- **D1**：免费 5 GB/账号；元数据表通常较小，定期看 Billing → Usage 即可。

## 内部测试端点

- `POST /internal/trigger-processing`：仅在 **非 production** 环境启用，body `{ "bucket", "key" }` 可手动入队触发处理，用于集成测试。
