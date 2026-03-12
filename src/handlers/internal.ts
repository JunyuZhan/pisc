/**
 * 内部测试端点：仅在非生产环境启用，用于触发处理流程（集成测试）
 * @see docs/tasklist.md 阶段 8.3
 */

import type { UploadQueueMessage } from "../types/pipeline.js";

export async function handleInternalTrigger(request: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT === "production") {
    return new Response("Not Found", { status: 404 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const queue = env.UPLOAD_QUEUE;
  if (!queue) {
    return new Response(
      JSON.stringify({ error: "UPLOAD_QUEUE not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { bucket?: string; key?: string };
  try {
    body = (await request.json()) as { bucket?: string; key?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bucket = body.bucket ?? "test-bucket";
  const key = body.key ?? `uploads/test-${Date.now()}`;
  const message: UploadQueueMessage = { bucket, key };
  await queue.send(message);

  return new Response(
    JSON.stringify({ ok: true, key, message: "Queued for processing" }),
    { status: 202, headers: { "Content-Type": "application/json" } }
  );
}
