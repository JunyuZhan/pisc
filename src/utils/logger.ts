/**
 * 结构化日志（阶段 9.2）：单行 JSON，便于 CF Tail / 日志聚合过滤
 * 字段约定：event 必填，其余按需；不记录敏感信息（密钥、完整 body）。
 */

function formatLog(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify({ ts: new Date().toISOString(), ...obj });
  } catch {
    return JSON.stringify({ ts: new Date().toISOString(), event: "log_error", msg: "serialize failed" });
  }
}

export function log(event: string, data?: Record<string, unknown>): void {
  console.log(formatLog({ event, ...data }));
}

export function logError(event: string, err: unknown, data?: Record<string, unknown>): void {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error(formatLog({ event, level: "error", error: errMsg, ...data }));
}
