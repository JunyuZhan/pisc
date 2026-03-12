# Pisc 使用与对接指南

本文说明如何**使用**已部署的 Pisc 后端 API，以及前端/应用如何**对接**。

---

## 1. 基础信息

| 项目 | 说明 |
|------|------|
| **Base URL** | 你的 Worker 地址，例如 `https://pisc.<你的子域>.workers.dev` |
| **鉴权** | 若部署时配置了 `AUTH_SECRET`，请求需带 `Authorization: Bearer <AUTH_SECRET>` 或 `Authorization: ApiKey <AUTH_SECRET>` |
| **内容类型** | 请求体为 JSON 时使用 `Content-Type: application/json` |

健康检查：`GET /` 或 `GET /health` 返回 `{"ok":true,"service":"pisc"}`。

---

## 2. 对接方式一：TypeScript/JavaScript SDK（推荐）

本仓库提供 **PISClient**，可直接在上传、列表、搜索、状态、删除等场景使用。

### 安装与初始化

在你的前端或 Node 项目中，将本仓库作为依赖引用（或复制 `src/sdk/` 到你的项目）：

```ts
import { PISClient } from "pisc/sdk"; // 或你项目中的路径

const client = new PISClient(
  "https://pisc.<你的子域>.workers.dev",
  "your-api-key"  // 若配置了 AUTH_SECRET，传此处；否则不传
);
```

### 典型流程示例

```ts
// 1. 上传一张照片（SDK 内部：先请求预签名 URL，再 PUT 到 R2）
const photoId = await client.uploadFile(file);
console.log("上传成功，photoId:", photoId);

// 2. 轮询处理状态（上传后会自动进入队列做 AI 打标、向量化）
const status = await client.getPhotoStatus(photoId);
console.log(status.status); // "processing" | "completed" | "failed"

// 3. 获取照片列表
const { photos, total, hasMore } = await client.listPhotos({
  limit: 20,
  offset: 0,
  orderBy: "created_at",
  order: "DESC",
});

// 4. 语义搜索
const result = await client.searchPhotos("夕阳下的海滩", { limit: 10 });

// 5. 获取单张详情
const { photo } = await client.getPhoto(photoId);

// 6. 删除照片
await client.deletePhoto(photoId);
```

---

## 3. 对接方式二：直接 HTTP 调用

不依赖 SDK 时，可按 REST 接口自行发请求。

### 上传流程（两步）

```bash
# 1. 获取预签名 URL（需鉴权时加 -H "Authorization: Bearer <key>"）
curl -X POST "https://pisc.<你的子域>.workers.dev/api/upload/request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY"

# 响应示例：{ "uploadUrl": "https://...", "publicId": "01ABC...", "expiresAt": 1704067200 }

# 2. 用返回的 uploadUrl 直接 PUT 上传文件（无需再带鉴权）
curl -X PUT "<uploadUrl>" \
  --data-binary @photo.jpg \
  -H "Content-Type: image/jpeg"
```

上传成功后，服务端会自动把该对象加入处理队列（打标、向量化）；可通过 `GET /api/photos/:id/status` 查询处理状态。

### 常用接口速查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/`、`/health` | 健康检查 |
| POST | `/api/upload/request` | 获取上传凭证（uploadUrl、publicId、expiresAt） |
| GET | `/api/photos` | 照片列表（支持 limit、offset、tags、from、to、orderBy、order） |
| GET | `/api/photos/:id` | 单张详情 |
| GET | `/api/photos/:id/status` | 处理状态（processing / completed / failed） |
| GET | `/api/photos/search?q=自然语言` | 语义搜索 |
| DELETE | `/api/photos/:id` | 删除照片 |

更详细的请求/响应格式见 [API 参考](api-reference.md)。

---

## 4. 前端集成示例（React / Next.js）

```ts
// 例如在 Next.js API Route 或 React 组件中
const API_BASE = process.env.NEXT_PUBLIC_PISC_API || "https://pisc.<你的子域>.workers.dev";
const API_KEY = process.env.PISC_API_KEY; // 与服务端 AUTH_SECRET 一致

// 上传
async function uploadPhoto(file: File) {
  const res = await fetch(`${API_BASE}/api/upload/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const { uploadUrl, publicId } = await res.json();
  await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  return publicId;
}

// 语义搜索
async function searchPhotos(q: string) {
  const res = await fetch(
    `${API_BASE}/api/photos/search?${new URLSearchParams({ q })}`,
    { headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {} }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## 5. 注意事项

- **鉴权**：生产环境务必配置 `AUTH_SECRET`，并在前端通过环境变量或安全方式持有 API Key，不要写死在前端代码里。
- **CORS**：若前端与 Worker 不同域，需在 Worker 中返回合适的 `Access-Control-Allow-Origin`（当前实现若未配置，可自行在 Worker 入口添加 CORS 头）。
- **上传限制**：预签名 URL 有效期约 5 分钟；大文件可考虑分片上传（当前为单次 PUT，可选功能见 tasklist）。

更多部署与配置见 [deploy.md](deploy.md)，API 细节见 [api-reference.md](api-reference.md)。

**API 与 SDK 约定**：除 `POST /api/upload/request` 外，其余接口均返回 `{ success, data, meta? }`；本仓库 SDK 已做解包，示例中的 `listPhotos` / `getPhoto` / `searchPhotos` / `getPhotoStatus` / `deletePhoto` 返回值与上文一致。
