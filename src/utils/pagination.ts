/**
 * 分页参数解析与上限，防止滥用
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parseLimit(value: string | null, defaultVal: number = DEFAULT_LIMIT): number {
  if (value == null) return defaultVal;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, MAX_LIMIT);
}

export function parseOffset(value: string | null): number {
  if (value == null) return 0;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}
