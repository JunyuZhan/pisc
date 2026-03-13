/**
 * CORS 响应头。当 API 被浏览器从不同源调用时，由部署者配置 CORS_ORIGIN，本模块据此添加标准 CORS 头。
 * @see docs/cors.md
 */

const ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const ALLOW_HEADERS = "Authorization, Content-Type";
const MAX_AGE = "86400";

export interface CorsOptions {
  /** 允许的源，如 https://pisc-gallery.pages.dev；多个用逗号分隔，或传 *（不推荐生产） */
  origin?: string;
  /** 请求的 Origin 头，用于白名单匹配；若不传则使用 origin 单值 */
  requestOrigin?: string | null;
}

/**
 * 根据配置生成 CORS 响应头
 * - 若 origin 未配置，返回空对象，不添加 CORS
 * - 若 origin 为 * 或单值，直接作为 Allow-Origin
 * - 若 origin 为逗号分隔多值，且 requestOrigin 在白名单中则用 requestOrigin，否则用第一个
 */
export function getCorsHeaders(options: CorsOptions): Record<string, string> {
  const { origin, requestOrigin } = options;
  if (!origin) return {};

  const allowed = origin.split(",").map((o) => o.trim());
  let allowOrigin: string;
  if (allowed.length === 1 && allowed[0] === "*") {
    allowOrigin = "*";
  } else if (requestOrigin && allowed.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  } else if (allowed.length > 0) {
    allowOrigin = allowed[0];
  } else {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": MAX_AGE,
  };
}

/**
 * 为 Response 附加 CORS 头（不覆盖已有头）
 */
export function withCors(
  response: Response,
  corsHeaders: Record<string, string>
): Response {
  if (Object.keys(corsHeaders).length === 0) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
