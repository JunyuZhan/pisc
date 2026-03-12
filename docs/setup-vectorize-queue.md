# 索引（Vectorize）与队列（Queue）创建步骤

在项目根目录、且已登录 Cloudflare（`npx wrangler login`）的前提下操作。

## 1. 创建队列

### 方式 A：在 Cloudflare 控制台创建（推荐，避免 CLI 报错）

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com) → **Workers 和 Pages** → 左侧 **Queues**。
2. 点 **Create queue**（或「创建队列」）。
3. 队列名称填：`image-upload-queue`（必须与 `wrangler.toml` 中一致）。
4. 创建后无需改配置，当前 `wrangler.toml` 已绑定该队列。

### 方式 B：用 Wrangler 命令行创建

若出现 `The specified queue settings are invalid`，多半是当前 Wrangler 把本地的 consumer 配置误传给创建接口。可先**临时注释** `wrangler.toml` 里这两段（约第 20～29 行）：

```toml
# [[queues.producers]]
# queue = "image-upload-queue"
# binding = "UPLOAD_QUEUE"

# [[queues.consumers]]
# queue = "image-upload-queue"
# max_batch_size = 1
# ...
```

然后执行：

```bash
npx wrangler queues create image-upload-queue
```

成功后再把上面两段**取消注释**恢复原样。

- 也可先升级 Wrangler 再试：`npm install --save-dev wrangler@4`，然后 `npx wrangler queues create image-upload-queue`。

## 2. 创建 Vectorize 索引

执行（**不要**加 `--update-config`，当前 Wrangler 可能不支持）：

```bash
npx wrangler vectorize create photo-index --dimensions=768 --metric=cosine
```

- 终端会输出 **Index ID**（UUID），例如：`Created index photo-index with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`。
- 打开 `wrangler.toml`，找到 `[[vectorize]]` 段，把 `index_id = "..."` 里的占位符改成终端输出的 Index ID，并**取消该段注释**（若被注释的话）。

## 3. 找不到刚创建的资源时

- **Queue**：Cloudflare 控制台 → **Workers 和 Pages** → 左侧 **Queues**，在列表里找 `image-upload-queue`。
- **Vectorize**：控制台 → **Workers 和 Pages** → 左侧展开 **AI** 或 **存储和数据库** → **Vectorize**，在列表里找 `photo-index`，点进去可看到 **Index ID**。

把 Index ID 填进 `wrangler.toml` 的 `index_id` 后，保存即可。
