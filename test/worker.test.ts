import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Worker", () => {
  it("GET /health returns 200 and ok: true", async () => {
    const res = await SELF.fetch("http://localhost/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("pisc");
  });

  it("POST /r2-webhook without UPLOAD_QUEUE returns 503", async () => {
    const res = await SELF.fetch("http://localhost/r2-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket: "b", object: { key: "k" } }),
    });
    expect(res.status).toBe(503);
  });

  it("POST /api/upload/request returns 200 with uploadUrl, publicId, expiresAt", async () => {
    const res = await SELF.fetch("http://localhost/api/upload/request", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      uploadUrl: string;
      publicId: string;
      expiresAt: number;
    };
    expect(body.uploadUrl).toBeDefined();
    expect(body.uploadUrl).toContain("r2.cloudflarestorage.com");
    expect(body.publicId).toBeDefined();
    expect(body.publicId.length).toBeGreaterThan(0);
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
