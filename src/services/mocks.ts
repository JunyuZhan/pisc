/**
 * B/C 接口的 Mock 实现，供 A 的 DO 在 B/C 未就绪时使用
 * B 工程师实现 tagImage、embedText 后替换为真实服务；C 实现 insertPhoto、upsertVector 等后替换
 */

import type { IImageTagger, IEmbeddingService, IPhotoRepository, IVectorStore } from "../types/pipeline.js";

export const mockImageTagger: IImageTagger = {
  async tagImage(_bucket: string, _key: string): Promise<string[]> {
    return ["mock-tag-1", "mock-tag-2"];
  },
};

export const mockEmbeddingService: IEmbeddingService = {
  async embedText(_text: string): Promise<number[]> {
    return new Array(768).fill(0).map(() => Math.random() * 2 - 1);
  },
};

export const mockPhotoRepository: IPhotoRepository = {
  async insertPhoto(): Promise<void> {},
  async upsertPhotoTags(): Promise<void> {},
};

export const mockVectorStore: IVectorStore = {
  async upsertVector(): Promise<void> {},
  async queryVector(): Promise<{ id: string; score: number }[]> {
    return [];
  },
};
