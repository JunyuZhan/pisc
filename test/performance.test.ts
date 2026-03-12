import { describe, it, expect, beforeAll } from "vitest";
import { createDatabaseService } from "../src/services/database.js";

describe("Database Performance Tests", () => {
  describe("Complex Query Performance", () => {
    it("should handle time range + tag filtering efficiently", async () => {
      // Mock D1Database with performance tracking
      const queryLog: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          queryLog.push(sql);
          return {
            bind: (...args: any[]) => ({
              run: async () => ({ results: [], success: true }),
              first: async <T = any>(): Promise<T | null> => null,
              all: async <T = any>(): Promise<{ results: T[] }> => {
                // 模拟延迟
                await new Promise(resolve => setTimeout(resolve, 10));
                return { results: [] };
              },
            }),
          };
        },
        batch: async (statements: any[]) => ({ results: [], success: true }),
      } as any;

      const db = createDatabaseService(mockDb);

      const startTime = Date.now();
      const result = await db.searchPhotos({
        userId: "user-123",
        tags: ["sunset", "beach"],
        from: 1704067200,
        to: 1704153600,
        limit: 20,
        offset: 0,
      });
      const duration = Date.now() - startTime;

      console.log(`Complex query took ${duration}ms`);
      console.log(`Queries executed: ${queryLog.length}`);

      // 验证查询结构
      expect(queryLog.length).toBeGreaterThan(0);
      expect(queryLog[0]).toContain("SELECT");
      expect(result.photos).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should use indexes for user_id and created_at filtering", async () => {
      const queryLog: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          queryLog.push(sql);
          return {
            bind: (...args: any[]) => ({
              run: async () => ({ results: [], success: true }),
              first: async <T = any>(): Promise<T | null> => null,
              all: async <T = any>(): Promise<{ results: T[] }> => ({ results: [] }),
            }),
          };
        },
        batch: async (statements: any[]) => ({ results: [], success: true }),
      } as any;

      const db = createDatabaseService(mockDb);

      await db.searchPhotos({
        userId: "user-123",
        from: 1704067200,
        to: 1704153600,
      });

      // 验证查询使用了索引字段
      const countQuery = queryLog.find(q => q.includes("COUNT"));
      expect(countQuery).toBeDefined();
      expect(countQuery).toContain("user_id");
      expect(countQuery).toContain("created_at");
    });

    it("should handle pagination efficiently", async () => {
      const queryLog: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          queryLog.push(sql);
          return {
            bind: (...args: any[]) => ({
              run: async () => ({ results: [], success: true }),
              first: async <T = any>(): Promise<T | null> => null,
              all: async <T = any>(): Promise<{ results: T[] }> => ({ results: [] }),
            }),
          };
        },
        batch: async (statements: any[]) => ({ results: [], success: true }),
      } as any;

      const db = createDatabaseService(mockDb);

      // 测试不同分页大小
      const pageSizes = [10, 20, 50, 100];
      for (const limit of pageSizes) {
        queryLog.length = 0;
        await db.searchPhotos({ limit, offset: 0 });
        const listQuery = queryLog.find(q => q.includes("LIMIT"));
        expect(listQuery).toBeDefined();
      }
    });
  });

  describe("Batch Operations Performance", () => {
    it("should batch insert tags efficiently", async () => {
      const batchCalls: any[][] = [];
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: any[]) => ({
            run: async () => ({ results: [], success: true }),
            first: async <T = any>(): Promise<T | null> => ({ id: 1 } as T),
            all: async <T = any>(): Promise<{ results: T[] }> => ({ results: [] }),
          }),
        }),
        batch: async (statements: any[]) => {
          batchCalls.push(statements);
          return { results: [], success: true };
        },
      } as any;

      const db = createDatabaseService(mockDb);

      const tags = [
        { name: "sunset", confidence: 0.95, source: "ai" },
        { name: "beach", confidence: 0.88, source: "ai" },
        { name: "nature", confidence: 0.92, source: "ai" },
      ];

      await db.upsertPhotoTags("photo-123", tags);

      // 验证使用了批量操作
      expect(batchCalls.length).toBeGreaterThan(0);
      console.log(`Batch operations: ${batchCalls.length}`);
    });
  });
});
