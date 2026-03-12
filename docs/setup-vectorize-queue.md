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

## 4. R2 存储桶事件通知（阶段 2.3）

上传到 R2 后需要触发处理管道，有两种方式：

### 方式 A：R2 事件直接投递到 Queue（推荐）

1. 打开 **Cloudflare 控制台** → **R2** → 选择桶（如 `pisc-images`）→ **Settings**。
2. 找到 **Event notifications**（事件通知）→ **Create notification**（创建通知）。
3. 事件类型选 **Object created**（对象创建）；目标类型选 **Queue**，选择队列 `image-upload-queue`。
4. 保存后，新对象写入该桶时会自动向队列发送消息（含 bucket、key），Worker 的 queue 消费者会收到并触发 DO 处理。

### 方式 B：R2 事件发到 Worker Webhook

若未配置 Queue 目标，可把事件目标设为 **Worker**，URL 填你的 Worker 地址 + `/r2-webhook`（如 `https://pisc.<你的子域>.workers.dev/r2-webhook`）。Worker 收到 POST 后解析 body 并入队，效果与方式 A 类似，多一层 Worker 转发。

- 事件 payload 格式需与 `handlers/r2-webhook.ts` 中解析的 `bucket`、`object.key` 一致；若 R2 控制台提供的格式不同，需在 Webhook 里做一次转换再 `queue.send()`。

## 5. 死信队列（阶段 3.4，可选）

消费失败、重试耗尽后的消息可进入死信队列（DLQ），便于人工排查或重放：

1. 在 CF 控制台或命令行再创建一个队列，例如：`image-upload-dlq`（`npx wrangler queues create image-upload-dlq`）。
2. 在 `wrangler.toml` 的 `[[queues.consumers]]` 中取消注释并填写：`dead_letter_queue = "image-upload-dlq"`。
3. 可选：为 DLQ 绑定另一个消费者（同一 Worker 或单独 Worker）用于打日志、告警或重试。
