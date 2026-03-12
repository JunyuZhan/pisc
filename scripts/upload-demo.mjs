#!/usr/bin/env node
/**
 * 阶段 2.2：模拟客户端直传 R2
 * 用法：先运行 npm run dev，再在另一终端执行：
 *   node scripts/upload-demo.mjs [BASE_URL] [IMAGE_PATH]
 * 例：node scripts/upload-demo.mjs http://localhost:8787 ./test-image.png
 */
const baseUrl = process.argv[2] || "http://localhost:8787";
const imagePath = process.argv[3];

async function main() {
  const res = await fetch(`${baseUrl}/api/upload/request`, { method: "POST" });
  if (!res.ok) {
    console.error("upload/request failed:", res.status, await res.text());
    process.exit(1);
  }
  const { uploadUrl, publicId, expiresAt } = await res.json();
  console.log("publicId:", publicId, "expiresAt:", new Date(expiresAt * 1000).toISOString());

  if (!imagePath) {
    console.log("uploadUrl (first 80 chars):", uploadUrl.slice(0, 80) + "...");
    console.log("To actually upload, run: node scripts/upload-demo.mjs", baseUrl, "<path-to-image>");
    return;
  }

  const fs = await import("node:fs");
  const body = fs.readFileSync(imagePath);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body,
    headers: { "Content-Type": "image/png" },
  });
  if (!putRes.ok) {
    console.error("PUT to R2 failed:", putRes.status, await putRes.text());
    process.exit(1);
  }
  console.log("Upload OK. Object key: uploads/" + publicId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
