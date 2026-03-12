# Pisc 部署说明（阶段 9）

## 密钥放在哪里（重要）

- **GitHub 仓库只放开源代码，不放任何密钥。**
- **所有密钥只存在 Cloudflare**：在你自己的电脑上执行 `wrangler secret put ...`，密钥会保存到 Cloudflare 账号下，供已部署的 Worker 运行时使用。代码库里、GitHub 上都不会出现这些值。
- **wrangler.toml** 里只写「可公开的配置」（如 Account ID、桶名、database_id 占位符）；真正的密钥（R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、AUTH_SECRET）一律用 `wrangler secret put` 配置在 Cloudflare，不写进任何文件。

---

## 如何部署（推荐：本机部署，密钥只在 CF）

按下面顺序在你自己的电脑上执行即可完成部署（以 **staging** 为例）。

### 1. 填写 wrangler.toml

在项目根目录打开 `wrangler.toml`，将占位符替换为你自己的 Cloudflare 资源：

- `R2_ACCOUNT_ID` → 你的 [Cloudflare Account ID](https://dash.cloudflare.com → 右侧栏)
- `R2_BUCKET_NAME` → 你的 R2 桶名（如 `pisc-images`）
- `database_id`（D1）→ 你的 D1 数据库 ID（在控制台创建 D1 后可见）

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

- 已在 Cloudflare 创建：R2 桶、D1 数据库（名称与 `wrangler.toml` 中 `database_name` 一致）、Vectorize 索引（`photo-index`）、Queue（`image-upload-queue`）
- `wrangler.toml` 中已填写真实的 `R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、`database_id`（非占位符）
- 已通过 `wrangler secret put` 配置当前环境的 R2 密钥

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

## 从 GitHub 自动部署（可选，不用也可以）

若你**不希望**在 GitHub 存任何密钥，可以**不用**下面的方式，只用在上面「如何部署」里说的本机 `./scripts/deploy.sh` 部署即可。代码照常推送到 GitHub 做开源，部署在你本机执行，密钥全部只在 Cloudflare。

若你**希望** push 到 GitHub 后自动部署，可以使用仓库里的 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)。这时需要在 GitHub 仓库 **Settings → Secrets and variables → Actions** 里配置一个 **CLOUDFLARE_API_TOKEN**：这是用来让 GitHub 的机器有权限调用 Cloudflare 的「部署接口」的，**不是**你应用里的 R2 或业务密钥；R2 等密钥仍然只在 Cloudflare 用 `wrangler secret put` 配置，不会进 GitHub。配置好该 Token 后，推送到 `main` 会触发 D1 迁移 + Worker 部署。**若你不想在 GitHub 存任何东西，请忽略本节，只用本机部署。**

## 监控与告警（阶段 9.2 / 9.3）

- 在 Cloudflare Dashboard → Workers & Pages → 选择 Worker → Metrics 查看请求数、错误率
- 在 Queues 控制台查看队列积压与消费情况
- 可配置告警：Worker 错误率 > 1%、队列积压超过阈值等

## 内部测试端点

- `POST /internal/trigger-processing`：仅在 **非 production** 环境启用，body `{ "bucket", "key" }` 可手动入队触发处理，用于集成测试。
