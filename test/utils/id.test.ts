/**
 * 工具函数单元测试（阶段 8.2）：createPhotoId
 */
import { describe, it, expect } from "vitest";
import { createPhotoId } from "../../src/utils/id.js";

describe("createPhotoId", () => {
  it("returns a 26-character string (ULID-style)", () => {
    const id = createPhotoId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("generates unique IDs across multiple calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createPhotoId());
    }
    expect(ids.size).toBe(100);
  });

  it("is time-ordered (later call >= earlier call when not same ms)", async () => {
    const a = createPhotoId();
    await new Promise((r) => setTimeout(r, 2));
    const b = createPhotoId();
    expect(a <= b).toBe(true);
  });
});
