/**
 * Cloudflare Workers 环境绑定类型（随 wrangler.toml 绑定补充）
 */
interface Env {
  ENVIRONMENT?: string;
  /** 可选：API Key / Bearer 鉴权，未设置时开发环境不校验 */
  AUTH_SECRET?: string;
  /** R2 预签名用：S3 API 凭证（secret） */
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET_NAME?: string;
  /** R2 桶绑定，Pipeline 读对象（阶段 3） */
  BUCKET?: R2Bucket;
  /** 上传事件队列生产者，R2 事件或 Webhook 入队（阶段 3） */
  UPLOAD_QUEUE?: { send(message: unknown): Promise<void> };
  /** Durable Object：图片处理状态机 */
  IMAGE_PROCESSING_DO?: DurableObjectNamespace;
  /** Workers AI 绑定（B 工程师使用） */
  AI?: Ai;
  /** D1 数据库绑定（C 工程师使用） */
  DB?: D1Database;
  /** Vectorize 向量索引绑定（C 工程师使用） */
  VECTORIZE?: VectorizeIndex;
}
