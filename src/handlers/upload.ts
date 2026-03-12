import { createPhotoId } from "../utils/id.js";
import { createPresignedPutUrl } from "../services/presign.js";
import { log, logError } from "../utils/logger.js";
import { authenticateUser } from "../utils/auth.js";

const UPLOAD_PREFIX = "uploads"; // R2 key 前缀，便于与后续事件过滤配合

/**
 * POST /api/upload/request
 * 返回 { uploadUrl, publicId, expiresAt }，客户端据此直传 R2
 * 鉴权与 photos 等 API 统一使用 utils/auth.ts
 */
export async function handleUploadRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authContext = await authenticateUser(request, env);
  if (!authContext.authenticated) {
    log("upload_request", { status: 401, reason: "unauthorized" });
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
    log("upload_request", { status: 500, reason: "r2_not_configured" });
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

    log("upload_request", { status: 200, publicId, key });
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
    logError("upload_request", e, { status: 500 });
    return new Response(
      JSON.stringify({ error: "Failed to generate upload URL", detail: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
