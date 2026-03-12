/**
 * Vectorize 向量存储服务
 * @see docs/tasklist.md 阶段 6
 * @see src/types/pipeline.ts IVectorStore 接口
 */

import type { IVectorStore } from "../types/pipeline.js";

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, string | number>;
}

export interface VectorQueryOptions {
  topK?: number;
  filter?: Record<string, string | number>;
  returnMetadata?: boolean;
}

/**
 * Vectorize 向量存储服务
 * 实现 IVectorStore 接口，供 DO 和搜索 API 调用
 */
export class VectorizeService implements IVectorStore {
  private index: VectorizeIndex;

  constructor(index: VectorizeIndex) {
    this.index = index;
  }

  /**
   * 插入或更新向量
   * @param photoId 照片 ID（作为向量 ID）
   * @param embedding 768 维向量
   * @param metadata 可选元数据（用于预过滤）
   */
  async upsertVector(
    photoId: string,
    embedding: number[],
    metadata?: Record<string, string | number>
  ): Promise<void> {
    const vector: VectorizeVector = {
      id: photoId,
      values: embedding,
      metadata: metadata ?? {},
    };

    await this.index.upsert([vector]);
  }

  /**
   * 批量插入或更新向量
   */
  async upsertVectors(
    vectors: { id: string; values: number[]; metadata?: Record<string, string | number> }[]
  ): Promise<void> {
    const vectorizeVectors: VectorizeVector[] = vectors.map((v) => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata ?? {},
    }));

    await this.index.upsert(vectorizeVectors);
  }

  /**
   * 向量相似度搜索
   * @param embedding 查询向量
   * @param filter 可选元数据过滤条件
   * @param topK 返回结果数量
   */
  async queryVector(
    embedding: number[],
    filter?: Record<string, string | number>,
    topK: number = 20
  ): Promise<VectorSearchResult[]> {
    const queryOptions: VectorizeQueryOptions = {
      topK,
      returnMetadata: true,
    };

    // 添加元数据过滤
    if (filter && Object.keys(filter).length > 0) {
      queryOptions.filter = this.buildFilter(filter);
    }

    const result = await this.index.query(embedding, queryOptions);

    return result.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as Record<string, string | number> | undefined,
    }));
  }

  /**
   * 根据 ID 获取向量
   */
  async getVectorById(id: string): Promise<VectorizeVector | null> {
    const result = await this.index.getByIds([id]);
    return result[0] ?? null;
  }

  /**
   * 批量获取向量
   */
  async getVectorsByIds(ids: string[]): Promise<VectorizeVector[]> {
    if (ids.length === 0) return [];
    return await this.index.getByIds(ids);
  }

  /**
   * 删除向量
   */
  async deleteVector(id: string): Promise<void> {
    await this.index.deleteByIds([id]);
  }

  /**
   * 批量删除向量
   */
  async deleteVectors(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.index.deleteByIds(ids);
  }

  /**
   * 构建元数据过滤条件
   * Vectorize 支持的过滤语法
   */
  private buildFilter(filter: Record<string, string | number>): VectorizeVectorMetadataFilter {
    // 简化实现：只支持单个条件
    // 如果需要多个条件，可以在 D1 中二次过滤
    const entries = Object.entries(filter);
    if (entries.length === 0) {
      return {};
    }

    const [key, value] = entries[0];
    return { [key]: value };
  }

  /**
   * 混合搜索：先向量搜索，再用 D1 过滤
   * 这个方法会在搜索 API 中使用
   */
  async hybridSearch(
    embedding: number[],
    options: {
      topK?: number;
      userId?: string;
      from?: number;
      to?: number;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const { topK = 20, userId, from, to } = options;

    // 构建元数据过滤（如果支持）
    const filter: Record<string, string | number> = {};
    if (userId) {
      filter.userId = userId;
    }

    // 注意：时间范围过滤可能需要在 D1 中二次过滤
    // 因为 Vectorize 的元数据过滤能力有限

    return await this.queryVector(embedding, Object.keys(filter).length > 0 ? filter : undefined, topK);
  }

  /**
   * 策略 A：向量搜索时通过 metadata 过滤
   * 优点：减少向量搜索范围，提高性能
   * 缺点：需要将常用字段存入 metadata
   */
  async searchWithMetadataFilter(
    embedding: number[],
    filters: {
      userId?: string;
      createdAt?: number;
      customMetadata?: Record<string, string | number>;
    },
    topK: number = 20
  ): Promise<VectorSearchResult[]> {
    const metadataFilter: Record<string, string | number> = {};

    if (filters.userId) {
      metadataFilter.userId = filters.userId;
    }

    if (filters.createdAt) {
      metadataFilter.createdAt = filters.createdAt;
    }

    if (filters.customMetadata) {
      Object.assign(metadataFilter, filters.customMetadata);
    }

    return await this.queryVector(
      embedding,
      Object.keys(metadataFilter).length > 0 ? metadataFilter : undefined,
      topK
    );
  }

  /**
   * 策略 B：向量搜索后，用 ID 列表在 D1 中过滤
   * 优点：支持复杂的 SQL 过滤条件
   * 缺点：需要额外的数据库查询
   */
  async searchWithPostFilter(
    embedding: number[],
    topK: number = 20
  ): Promise<VectorSearchResult[]> {
    // 先进行纯向量搜索
    return await this.queryVector(embedding, undefined, topK);
  }

  /**
   * 智能选择搜索策略
   * 根据过滤条件自动选择最优策略
   */
  async smartSearch(
    embedding: number[],
    options: {
      userId?: string;
      from?: number;
      to?: number;
      tags?: string[];
      topK?: number;
    } = {}
  ): Promise<{
    results: VectorSearchResult[];
    strategy: "metadata" | "post-filter" | "hybrid";
  }> {
    const { userId, from, to, tags, topK = 20 } = options;

    // 策略选择逻辑
    let strategy: "metadata" | "post-filter" | "hybrid";

    if (userId && !from && !to && !tags) {
      // 只有 userId 过滤：使用 metadata 策略
      strategy = "metadata";
      const results = await this.searchWithMetadataFilter(
        embedding,
        { userId },
        topK
      );
      return { results, strategy };
    } else if (!userId && !from && !to && !tags) {
      // 无过滤条件：纯向量搜索
      strategy = "post-filter";
      const results = await this.searchWithPostFilter(embedding, topK);
      return { results, strategy };
    } else {
      // 复杂过滤条件：使用混合策略
      strategy = "hybrid";
      const results = await this.hybridSearch(embedding, {
        topK: topK * 2, // 多取一些用于后续过滤
        userId,
        from,
        to,
      });
      return { results, strategy };
    }
  }
}

/**
 * 创建 Vectorize 服务实例
 */
export function createVectorizeService(index: VectorizeIndex): VectorizeService {
  return new VectorizeService(index);
}
