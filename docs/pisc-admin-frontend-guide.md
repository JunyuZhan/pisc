# Pisc-admin 前端开发建议

Pisc-admin 与 pisc 后端（Cloudflare Workers）对接时的技术选型与对接方式。

---

## 技术栈建议

| 方面 | 推荐 |
|------|------|
| 框架 | **Vite + React + TypeScript**（启动快，适合管理后台） |
| 样式 | **Tailwind CSS** + **shadcn/ui** 或 Radix |
| 请求/状态 | **TanStack Query** + 后端 **PISClient** |
| 环境变量 | `VITE_PISC_URL`、`VITE_PISC_API_KEY`（勿写死） |

## 对接后端

- **SDK**：可从同级 pisc 仓库复制 `src/sdk/` 到 Pisc-admin 的 `src/lib/`，或通过 monorepo 引用。
- **接口**：上传、列表、搜索、详情、删除、状态见 `api-reference.md`；鉴权头 `Authorization: Bearer <API_KEY>`。

## 推荐页面

上传（拖拽 → uploadFile → 轮询 status）、照片列表（分页）、语义搜索、照片详情（EXIF/标签）、删除（mutation + invalidate）。

## 环境变量

`.env.local`：`VITE_PISC_URL=https://pisc.xxx.workers.dev`、`VITE_PISC_API_KEY=...`（勿提交）。
