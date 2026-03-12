/**
 * 队列消费者：每条约 R2 上传消息，派发到对应 ImageProcessingDO 的 /process
 * @see docs/tasklist.md 阶段 3.2
 */

import type { R2EventPayload, UploadQueueMessage } from "../types/pipeline.js";
import { log, logError } from "../utils/logger.js";

function normalizeToBucketKey(body: unknown): { bucket: string; key: string } | null {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const bucket = b.bucket ?? (b as R2EventPayload).bucket;
    const key =
      (b as UploadQueueMessage).key ??
      ((b as R2EventPayload).object && typeof (b as R2EventPayload).object === "object"
        ? ((b as R2EventPayload).object as { key: string }).key
        : null);
    if (typeof bucket === "string" && typeof key === "string") return { bucket, key };
  }
  return null;
}

export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const doNamespace = env.IMAGE_PROCESSING_DO;
  if (!doNamespace) {
    log("queue_batch", { skipped: true, reason: "do_not_bound", size: batch.messages.length });
    return;
  }

  log("queue_batch", { size: batch.messages.length, queue: batch.queue });

  for (const message of batch.messages) {
    const parsed = normalizeToBucketKey(message.body);
    if (!parsed) {
      message.ack();
      continue;
    }
    const { bucket, key } = parsed;
    const id = doNamespace.idFromName(key);
    const stub = doNamespace.get(id);
    try {
      const res = await stub.fetch("http://do/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, key }),
      });
      if (res.ok || res.status === 202) {
        log("queue_message", { key, action: "ack" });
        message.ack();
      } else {
        log("queue_message", { key, action: "retry", status: res.status });
        message.retry();
      }
    } catch (e) {
      logError("queue_message", e, { key, action: "retry" });
      message.retry();
    }
  }
}
