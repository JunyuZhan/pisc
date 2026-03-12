import { describe, it, expect } from "vitest";
import { createVectorizeService } from "../src/services/vectorize.js";

describe("VectorizeService", () => {
  // Mock VectorizeIndex
  const mockIndex = {
    upsert: async (vectors: any[]) => ({ ids: vectors.map((v) => v.id) }),
    query: async (vector: number[], options?: any) => ({
      matches: [],
      count: 0,
    }),
    getByIds: async (ids: string[]) => [],
    deleteByIds: async (ids: string[]) => ({ ids }),
  } as any;

  const vectorize = createVectorizeService(mockIndex);

  describe("upsertVector", () => {
    it("should upsert a vector", async () => {
      const embedding = new Array(768).fill(0).map(() => Math.random());
      await expect(
        vectorize.upsertVector("photo-1", embedding, { userId: "user-1" })
      ).resolves.not.toThrow();
    });
  });

  describe("queryVector", () => {
    it("should return empty results for no matches", async () => {
      const embedding = new Array(768).fill(0).map(() => Math.random());
      const results = await vectorize.queryVector(embedding, undefined, 10);
      expect(results).toEqual([]);
    });
  });

  describe("deleteVector", () => {
    it("should delete a vector", async () => {
      await expect(vectorize.deleteVector("photo-1")).resolves.not.toThrow();
    });
  });
});
