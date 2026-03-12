import { AwsClient } from "aws4fetch";

const PRESIGN_EXPIRES_SEC = 300; // 5 分钟

export interface PresignEnv {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
}

/**
 * 生成 R2 预签名 PUT URL（S3 兼容 API），有效期 5 分钟
 * 客户端使用该 URL 直接 PUT 上传，无需经过 Worker
 * @see https://developers.cloudflare.com/r2/api/s3/presigned-urls
 */
export async function createPresignedPutUrl(
  env: PresignEnv,
  key: string,
  contentType?: string
): Promise<{ url: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + PRESIGN_EXPIRES_SEC;
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: "auto",
    service: "s3",
  });

  const url = new URL(endpoint);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SEC));

  const req = new Request(url.toString(), {
    method: "PUT",
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body: undefined,
  });

  const signed = await client.sign(req, { aws: { signQuery: true } });
  return { url: signed.url, expiresAt };
}
