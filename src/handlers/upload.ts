import { createPhotoId } from "../utils/id.js";
import { createPresignedPutUrl } from "../services/presign.js";

const UPLOAD_PREFIX = "uploads"; // R2 key 前缀，便于与后续事件过滤配合

/**
 * 验证请求身份（初期简化：API Key 或 Bearer）
 * 未配置 AUTH_SECRET 时跳过校验（仅限开发）
 */
function authorize(request: Request, env: Env): boolean {
  const secret = env.AUTH_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  if (auth.startsWith("Bearer ")) return auth.slice(7) === secret;
  if (auth.startsWith("ApiKey ")) return auth.slice(7) === secret;
  return false;
}

/**
 * POST /api/upload/request
 * 返回 { uploadUrl, publicId, expiresAt }，客户端据此直传 R2
 */
export async function handleUploadRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!authorize(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const r2AccountId = env.R2_ACCOUNT_ID;
  const r2BucketName = env.R2_BUCKET_NAME;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!r2AccountId || !r2BucketName || !accessKeyId || !secretAccessKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: R2 credentials not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const publicId = createPhotoId();
  const key = `${UPLOAD_PREFIX}/${publicId}`;

  try {
    const { url, expiresAt } = await createPresignedPutUrl(
      {
        R2_ACCESS_KEY_ID: accessKeyId,
        R2_SECRET_ACCESS_KEY: secretAccessKey,
        R2_ACCOUNT_ID: r2AccountId,
        R2_BUCKET_NAME: r2BucketName,
      },
      key
    );

    return new Response(
      JSON.stringify({
        uploadUrl: url,
        publicId,
        expiresAt,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to generate upload URL", detail: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
