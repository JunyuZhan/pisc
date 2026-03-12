import { describe, it, expect } from "vitest";
import { parseLimit, parseOffset, DEFAULT_LIMIT, MAX_LIMIT } from "../../src/utils/pagination.js";

describe("pagination", () => {
  describe("parseLimit", () => {
    it("returns default when value is null or empty", () => {
      expect(parseLimit(null, 20)).toBe(20);
      expect(parseLimit("", 10)).toBe(10);
    });

    it("parses valid positive integers", () => {
      expect(parseLimit("1", 20)).toBe(1);
      expect(parseLimit("20", 20)).toBe(20);
      expect(parseLimit("100", 20)).toBe(100);
    });

    it("caps at MAX_LIMIT", () => {
      expect(parseLimit("200", 20)).toBe(MAX_LIMIT);
      expect(parseLimit("999", 20)).toBe(MAX_LIMIT);
    });

    it("returns default for NaN or invalid", () => {
      expect(parseLimit("abc", 20)).toBe(20);
      expect(parseLimit("0", 20)).toBe(20);
      expect(parseLimit("-1", 20)).toBe(20);
    });

    it("uses DEFAULT_LIMIT when default not provided", () => {
      expect(parseLimit(null)).toBe(DEFAULT_LIMIT);
    });
  });

  describe("parseOffset", () => {
    it("returns 0 when value is null or empty", () => {
      expect(parseOffset(null)).toBe(0);
      expect(parseOffset("")).toBe(0);
    });

    it("parses valid non-negative integers", () => {
      expect(parseOffset("0")).toBe(0);
      expect(parseOffset("10")).toBe(10);
      expect(parseOffset("100")).toBe(100);
    });

    it("returns 0 for NaN or negative", () => {
      expect(parseOffset("abc")).toBe(0);
      expect(parseOffset("-1")).toBe(0);
    });
  });
});
