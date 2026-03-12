import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    poolOptions: {
      workers: {
        main: "./src/worker/index.ts",
        miniflare: {
          durableObjects: { IMAGE_PROCESSING_DO: "ImageProcessingDO" },
          bindings: {
            R2_ACCOUNT_ID: "test-account-id",
            R2_BUCKET_NAME: "test-bucket",
            R2_ACCESS_KEY_ID: "test-access-key",
            R2_SECRET_ACCESS_KEY: "test-secret-key",
            WEBHOOK_SECRET: "test-webhook-secret",
          },
        },
      },
    },
  },
});
