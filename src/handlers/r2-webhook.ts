/**
 * POST /r2-webhook：接收 R2 事件（或测试用 body），入队后返回 202
 * 生产环境也可由 R2 事件直接投递到 Queue，本端点用于测试或二次入队
 * @see docs/tasklist.md 阶段 3.1
 */

import type { R2EventPayload, UploadQueueMessage } from "../types/pipeline.js";
import { log } from "../utils/logger.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function handleR2Webhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (env.WEBHOOK_SECRET) {
    const provided = request.headers.get("X-Webhook-Secret");
    if (provided !== env.WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: JSON_HEADERS }
      );
    }
  }

  const queue = env.UPLOAD_QUEUE;
  if (!queue) {
    return new Response(
      JSON.stringify({ error: "UPLOAD_QUEUE not configured" }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  let body: R2EventPayload;
  try {
    body = (await request.json()) as R2EventPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const bucket = body.bucket;
  const key = body.object?.key;
  if (!bucket || !key) {
    return new Response(
      JSON.stringify({ error: "Missing bucket or object.key" }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const message: UploadQueueMessage = { bucket, key };
  await queue.send(message);
  log("webhook_queued", { bucket, key });

  return new Response(null, { status: 202 });
}
