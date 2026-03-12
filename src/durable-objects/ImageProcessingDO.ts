/**
 * 图片处理 Durable Object：状态机编排
 * 步骤：extractMetadata → performAITagging → generateVector → saveToDatabase
 * 接入 B（AI）、C（Database + Vectorize）真实实现；未配置时回退 Mock
 * @see docs/tasklist.md 阶段 3.3
 */

import { DurableObject } from "cloudflare:workers";
import type { UploadQueueMessage } from "../types/pipeline.js";
import { mockImageTagger, mockEmbeddingService, mockPhotoRepository, mockVectorStore } from "../services/mocks.js";
import { createAIService } from "../services/ai.js";
import { createDatabaseService } from "../services/database.js";
import { createVectorizeService } from "../services/vectorize.js";

const STORAGE_KEYS = {
  STEPS: "steps",
  RETRY_COUNT: "retryCount",
  BUCKET: "bucket",
  KEY: "key",
  STATUS: "status",
} as const;

type StepName = "extractMetadata" | "performAITagging" | "generateVector" | "saveToDatabase";
type StepStatus = "pending" | "running" | "completed" | "failed";
type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

interface StepState {
  status: StepStatus;
  error?: string;
}

const STEP_ORDER: StepName[] = ["extractMetadata", "performAITagging", "generateVector", "saveToDatabase"];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避

export class ImageProcessingDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private get aiService() {
    return this.env.AI ? createAIService(this.env) : null;
  }

  private get photoRepo() {
    return this.env.DB ? createDatabaseService(this.env.DB) : mockPhotoRepository;
  }

  private get vectorStore() {
    return this.env.VECTORIZE ? createVectorizeService(this.env.VECTORIZE) : mockVectorStore;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/process" || request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    let body: UploadQueueMessage;
    try {
      body = (await request.json()) as UploadQueueMessage;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { bucket, key } = body;
    if (!bucket || !key) {
      return new Response(JSON.stringify({ error: "Missing bucket or key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    this.ctx.waitUntil(this.runPipeline(bucket, key));
    return new Response(JSON.stringify({ accepted: true, key }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async runPipeline(bucket: string, key: string): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEYS.BUCKET, bucket);
    await this.ctx.storage.put(STORAGE_KEYS.KEY, key);
    await this.ctx.storage.put(STORAGE_KEYS.STATUS, "processing");

    let steps = (await this.ctx.storage.get<Record<StepName, StepState>>(STORAGE_KEYS.STEPS)) ?? this.initialSteps();
    let retryCount = (await this.ctx.storage.get<number>(STORAGE_KEYS.RETRY_COUNT)) ?? 0;

    for (const stepName of STEP_ORDER) {
      const state = steps[stepName];
      if (state.status === "completed") continue;

      steps[stepName] = { ...state, status: "running" };
      await this.ctx.storage.put(STORAGE_KEYS.STEPS, steps);

      try {
        switch (stepName) {
          case "extractMetadata":
            await this.extractMetadata(bucket, key);
            break;
          case "performAITagging":
            await this.performAITagging(bucket, key);
            break;
          case "generateVector":
            await this.generateVector();
            break;
          case "saveToDatabase":
            await this.saveToDatabase(key);
            break;
        }
        steps[stepName] = { status: "completed" };
      } catch (e) {
        steps[stepName] = { status: "failed", error: String(e) };
        retryCount += 1;
        await this.ctx.storage.put(STORAGE_KEYS.STEPS, steps);
        await this.ctx.storage.put(STORAGE_KEYS.RETRY_COUNT, retryCount);

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        await this.ctx.storage.put(STORAGE_KEYS.STATUS, "failed");
        await this.handleFailure(bucket, key, steps);
        throw e;
      }
      await this.ctx.storage.put(STORAGE_KEYS.STEPS, steps);
    }

    await this.ctx.storage.put(STORAGE_KEYS.STATUS, "completed");
  }

  private async handleFailure(bucket: string, key: string, steps: Record<StepName, StepState>): Promise<void> {
    console.error(`ImageProcessingDO: Processing failed for ${bucket}/${key}`, steps);
  }

  private initialSteps(): Record<StepName, StepState> {
    return {
      extractMetadata: { status: "pending" },
      performAITagging: { status: "pending" },
      generateVector: { status: "pending" },
      saveToDatabase: { status: "pending" },
    };
  }

  private async extractMetadata(_bucket: string, _key: string): Promise<void> {
    // TODO: 从 R2 读图解析 EXIF 写入 photo_exif；当前跳过，C 已提供 db.upsertExif
  }

  private async performAITagging(bucket: string, key: string): Promise<void> {
    if (this.env.BUCKET && this.aiService) {
      const obj = await this.env.BUCKET.get(key);
      if (!obj) throw new Error("R2 object not found: " + key);
      const buf = await obj.arrayBuffer();
      const result = await this.aiService.tagImage(buf);
      await this.ctx.storage.put("tags", result.tags);
      await this.ctx.storage.put("confidences", result.confidences);
    } else {
      const tags = await mockImageTagger.tagImage(bucket, key);
      await this.ctx.storage.put("tags", tags);
    }
  }

  private async generateVector(): Promise<void> {
    const tags = (await this.ctx.storage.get<string[]>("tags")) ?? [];
    const text = tags.join(", ");
    if (this.aiService) {
      const result = await this.aiService.embedText(text);
      await this.ctx.storage.put("embedding", result.embedding);
    } else {
      const embedding = await mockEmbeddingService.embedText(text);
      await this.ctx.storage.put("embedding", embedding);
    }
  }

  private async saveToDatabase(key: string): Promise<void> {
    const photoId = key.replace(/^uploads\//, "") || key;
    const embedding = (await this.ctx.storage.get<number[]>("embedding")) ?? [];
    const tags = (await this.ctx.storage.get<string[]>("tags")) ?? [];
    const confidences = (await this.ctx.storage.get<number[]>("confidences")) ?? [];

    await this.photoRepo.insertPhoto({
      id: photoId,
      user_id: "system",
      object_key: key,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    });
    await this.photoRepo.upsertPhotoTags(
      photoId,
      tags.map((name, i) => ({ name, confidence: confidences[i] ?? 1, source: "ai" }))
    );
    await this.vectorStore.upsertVector(photoId, embedding, {});
  }
}
