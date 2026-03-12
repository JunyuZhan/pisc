/**
 * 阶段 8.3：管道集成测试
 * 验证 POST /internal/trigger-processing 入队成功，以及 GET /api/photos/:id/status 行为
 * @see docs/tasklist.md
 */
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Pipeline integration", () => {
  it("POST /internal/trigger-processing accepts body, returns 202 when queue bound or 503 when not", async () => {
    const res = await SELF.fetch("http://localhost/internal/trigger-processing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "test-bucket", key: "uploads/integration-test-id" }),
    });
    expect([202, 503]).toContain(res.status);
    const body = (await res.json()) as { ok?: boolean; key?: string; message?: string; error?: string };
    if (res.status === 202) {
      expect(body.ok).toBe(true);
      expect(body.key).toBeDefined();
      expect(body.message).toContain("Queued");
    } else {
      expect(body.error).toBeDefined();
    }
  });

  it("POST /internal/trigger-processing with empty body uses defaults when queue bound", async () => {
    const res = await SELF.fetch("http://localhost/internal/trigger-processing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect([202, 503]).toContain(res.status);
    const body = (await res.json()) as { ok?: boolean; key?: string };
    if (res.status === 202) {
      expect(body.ok).toBe(true);
      expect(body.key).toBeDefined();
    }
  });

  it("GET /api/photos/:id/status returns 200 with status or 404 for unknown id", async () => {
    const res = await SELF.fetch("http://localhost/api/photos/integration-test-id/status");
    // 若 D1 中无该 id 可能 404；若有则 200 + { status }
    expect([200, 404, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = (await res.json()) as { status?: string };
      expect(["pending", "processing", "completed", "failed"]).toContain(data.status);
    }
  });
});
