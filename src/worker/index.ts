/**
 * Pisc Worker 入口：路由与请求分发、队列消费
 * @see docs/tasklist.md
 */

import { handleUploadRequest } from "../handlers/upload.js";
import { handleR2Webhook } from "../handlers/r2-webhook.js";
import { handleInternalTrigger } from "../handlers/internal.js";
import { handleQueueBatch } from "../handlers/queue-consumer.js";
import {
  handleGetPhoto,
  handleListPhotos,
  handleSearchPhotos,
  handleGetPhotoStatus,
  handleDeletePhoto,
} from "../handlers/photos.js";

export { ImageProcessingDO } from "../durable-objects/ImageProcessingDO.js";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // 健康检查
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "pisc" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 上传请求
    if (url.pathname === "/api/upload/request" && method === "POST") {
      return handleUploadRequest(request, env);
    }

    // R2 Webhook
    if (url.pathname === "/r2-webhook") {
      return handleR2Webhook(request, env);
    }

    // 内部测试：触发处理流程（仅非 production，阶段 8.3）
    if (url.pathname === "/internal/trigger-processing") {
      return handleInternalTrigger(request, env);
    }

    // 照片搜索（必须在 /api/photos/:id 之前匹配）
    if (url.pathname === "/api/photos/search" && method === "GET") {
      return handleSearchPhotos(request, env);
    }

    // 照片列表
    if (url.pathname === "/api/photos" && method === "GET") {
      return handleListPhotos(request, env);
    }

    // 照片状态 GET /api/photos/:id/status（必须在 /api/photos/:id 之前匹配）
    const statusMatch = url.pathname.match(/^\/api\/photos\/([^/]+)\/status$/);
    if (statusMatch && method === "GET") {
      return handleGetPhotoStatus(request, env, statusMatch[1]);
    }

    // 单张照片操作 GET /api/photos/:id、DELETE /api/photos/:id
    const photoMatch = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
    if (photoMatch) {
      const photoId = photoMatch[1];
      if (method === "GET") return handleGetPhoto(request, env, photoId);
      if (method === "DELETE") return handleDeletePhoto(request, env, photoId);
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleQueueBatch(batch, env, ctx);
  },
};
