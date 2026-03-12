#!/usr/bin/env bash
# 阶段 9.1：部署前执行 D1 迁移，再部署 Worker
# 用法: ./scripts/deploy.sh [staging|production]
# 需先在 wrangler.toml 配置对应 env 的 D1 绑定（database_name = "pis-metadata"）

set -e
ENV="${1:-staging}"

echo "Applying D1 migrations (remote) for env: $ENV"
if [ "$ENV" = "production" ]; then
  npx wrangler d1 migrations apply pis-metadata --remote --env production
else
  npx wrangler d1 migrations apply pis-metadata --remote --env staging
fi

echo "Deploying Worker (env: $ENV)"
if [ "$ENV" = "production" ]; then
  npm run deploy:production
else
  npm run deploy:staging
fi

echo "Done. env=$ENV"
