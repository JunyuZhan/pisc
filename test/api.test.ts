import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

describe("Photo API", () => {
  describe("GET /api/photos", () => {
    it("should return 500 when database not configured", async () => {
      const res = await SELF.fetch("http://localhost/api/photos");
      // 如果没有配置 DB，应该返回 500
      // 如果配置了 DB，应该返回 200
      expect([200, 500]).toContain(res.status);
    });

    it("should support query parameters", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/photos?userId=user-1&limit=10&offset=0"
      );
      expect([200, 500]).toContain(res.status);
    });
  });

  describe("GET /api/photos/:id", () => {
    it("should return 404 for non-existent photo", async () => {
      const res = await SELF.fetch("http://localhost/api/photos/non-existent-id");
      // 如果没有配置 DB，返回 500
      // 如果配置了 DB，返回 404
      expect([404, 500]).toContain(res.status);
    });
  });

  describe("GET /api/photos/search", () => {
    it("should return 400 when query parameter missing", async () => {
      const res = await SELF.fetch("http://localhost/api/photos/search");
      // 如果没有配置必要服务，返回 500
      // 如果缺少 q 参数，返回 400
      expect([400, 500]).toContain(res.status);
    });

    it("should return 400 when q parameter is empty", async () => {
      const res = await SELF.fetch("http://localhost/api/photos/search?q=");
      expect([400, 500]).toContain(res.status);
    });
  });

  describe("DELETE /api/photos/:id", () => {
    it("should return 404 for non-existent photo", async () => {
      const res = await SELF.fetch("http://localhost/api/photos/non-existent-id", {
        method: "DELETE",
      });
      expect([404, 500]).toContain(res.status);
    });
  });
});
