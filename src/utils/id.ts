/**
 * 生成唯一图片 ID（ULID 风格：时间有序，Workers 兼容，使用 Web Crypto）
 * @see docs/tasklist.md 阶段 2.1
 */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32

function encodeTime(t: number, len: number): string {
  const cap = 32 ** len;
  let n = t % cap;
  let s = "";
  for (let i = 0; i < len; i++) {
    s = ENCODING[n % 32] + s;
    n = Math.floor(n / 32);
  }
  return s;
}

function encodeRandom(bytes: Uint8Array, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ENCODING[bytes[i]! % 32];
  }
  return s;
}

export function createPhotoId(): string {
  const t = Date.now();
  const timePart = encodeTime(t, 10); // 10 chars, 48-bit ms
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const randomPart = encodeRandom(random, 16);
  return timePart + randomPart;
}
