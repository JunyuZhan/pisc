import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseService, type PhotoWithTags } from "../src/services/database.js";

describe("DatabaseService", () => {
  // Mock D1Database
  const mockDb = {
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({
        run: async () => ({ results: [], success: true }),
        first: async <T = any>(): Promise<T | null> => null,
        all: async <T = any>(): Promise<{ results: T[] }> => ({ results: [] }),
      }),
    }),
    batch: async (statements: any[]) => ({ results: [], success: true }),
  } as any;

  const db = createDatabaseService(mockDb);

  describe("insertPhoto", () => {
    it("should insert a photo record", async () => {
      const photo = {
        id: "test-photo-1",
        user_id: "user-1",
        object_key: "photos/test-photo-1.jpg",
      };

      await expect(db.insertPhoto(photo)).resolves.not.toThrow();
    });
  });

  describe("getPhotoById", () => {
    it("should return null for non-existent photo", async () => {
      const result = await db.getPhotoById("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("searchPhotos", () => {
    it("should return empty results for no matches", async () => {
      const result = await db.searchPhotos({});
      expect(result.photos).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
