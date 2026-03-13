/**
 * Pisc Worker 入口：路由与请求分发、队列消费
 * @see docs/tasklist.md
 */

import { log } from "../utils/logger.js";
import { getCorsHeaders, withCors } from "../utils/cors.js";
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

function applyCors(response: Response, request: Request, env: Env): Response {
  const cors = getCorsHeaders({
    origin: env.CORS_ORIGIN,
    requestOrigin: request.headers.get("Origin"),
  });
  return withCors(response, cors);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS 预检：对 OPTIONS 直接返回 204 + CORS 头
    if (method === "OPTIONS") {
      const cors = getCorsHeaders({
        origin: env.CORS_ORIGIN,
        requestOrigin: request.headers.get("Origin"),
      });
      return new Response(null, { status: 204, headers: cors });
    }

    let response: Response;

    // 健康检查
    if (url.pathname === "/" || url.pathname === "/health") {
      response = new Response(JSON.stringify({ ok: true, service: "pisc" }), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (url.pathname === "/api/upload/request" && method === "POST") {
      response = await handleUploadRequest(request, env);
    } else if (url.pathname === "/r2-webhook") {
      response = await handleR2Webhook(request, env);
    } else if (url.pathname === "/internal/trigger-processing") {
      response = await handleInternalTrigger(request, env);
    } else if (url.pathname === "/api/photos/search" && method === "GET") {
      response = await handleSearchPhotos(request, env);
    } else if (url.pathname === "/api/photos" && method === "GET") {
      response = await handleListPhotos(request, env);
    } else {
      const statusMatch = url.pathname.match(/^\/api\/photos\/([^/]+)\/status$/);
      if (statusMatch && method === "GET") {
        response = await handleGetPhotoStatus(request, env, statusMatch[1]);
      } else {
        const photoMatch = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
        if (photoMatch) {
          const photoId = photoMatch[1];
          if (method === "GET") response = await handleGetPhoto(request, env, photoId);
          else if (method === "DELETE") response = await handleDeletePhoto(request, env, photoId);
          else response = new Response("Not Found", { status: 404 });
        } else {
          log("request", { path: url.pathname, method, status: 404 });
          response = new Response("Not Found", { status: 404 });
        }
      }
    }

    return applyCors(response, request, env);
  },

  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleQueueBatch(batch, env, ctx);
  },
};
