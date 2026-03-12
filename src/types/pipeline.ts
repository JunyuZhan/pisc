/**
 * 管道相关类型与 B/C 工程师对接接口约定
 * @see docs/tasklist.md 协同开发与任务分配 → 接口约定
 */

/** R2 事件通知消息体（Queue 收到或 Webhook 入参） */
export interface R2EventPayload {
  account: string;
  action: string;
  bucket: string;
  object: { key: string; size?: number; eTag?: string };
  eventTime: string;
  copySource?: { bucket: string; object: string };
}

/** 入队用：只传处理所需字段 */
export interface UploadQueueMessage {
  bucket: string;
  key: string;
}

// ---------- B（智能）提供，A 在 DO 中调用 ----------

/** 图片打标：B 实现，A 在 DO 中调用 */
export interface IImageTagger {
  tagImage(bucket: string, key: string): Promise<string[]>;
}

/** 文本向量化（768 维）：B 实现，A(DO) 与 C(搜索) 调用 */
export interface IEmbeddingService {
  embedText(text: string): Promise<number[]>;
}

// ---------- C（数据）提供，A 在 DO 中调用 ----------

export interface PhotoRecord {
  id: string;
  user_id: string;
  object_key: string;
  created_at?: number;
  updated_at?: number;
}

export interface PhotoTagRecord {
  photo_id: string;
  tag_id: number;
  confidence?: number;
  source?: string;
}

/** 元数据写入：C 实现，A 在 DO 的 saveToDatabase 中调用 */
export interface IPhotoRepository {
  insertPhoto(photo: PhotoRecord): Promise<void>;
  upsertPhotoTags(photoId: string, tags: { name: string; confidence?: number; source?: string }[]): Promise<void>;
}

/** 向量写入与查询：C 实现 */
export interface IVectorStore {
  upsertVector(photoId: string, embedding: number[], metadata?: Record<string, string | number>): Promise<void>;
  queryVector(embedding: number[], filter?: Record<string, string | number>, topK?: number): Promise<{ id: string; score: number }[]>;
}
