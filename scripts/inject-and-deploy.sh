#!/usr/bin/env bash
# 在 CF「关联 Git」构建时用：从构建环境变量注入 wrangler.toml 占位符后执行 deploy。
# 在 CF Dashboard → Worker → Build → Environment variables 中配置：
#   D1_DATABASE_ID、R2_ACCOUNT_ID（必填）；WRANGLER_ENV 可选，如 production。
set -e

if [ -z "${D1_DATABASE_ID}" ]; then
  echo "Error: D1_DATABASE_ID is not set. Set it in Cloudflare Build environment variables."
  exit 1
fi
if [ -z "${R2_ACCOUNT_ID}" ]; then
  echo "Error: R2_ACCOUNT_ID is not set. Set it in Cloudflare Build environment variables."
  exit 1
fi

# 替换占位符（Linux 构建环境）
sed -i "s/<YOUR_D1_DATABASE_ID>/${D1_DATABASE_ID}/g" wrangler.toml
sed -i "s/<YOUR_CF_ACCOUNT_ID>/${R2_ACCOUNT_ID}/g" wrangler.toml

if [ -n "${WRANGLER_ENV}" ]; then
  npx wrangler deploy --env "${WRANGLER_ENV}"
else
  npx wrangler deploy
fi
