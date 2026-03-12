PIS (Photo Intelligence System)
PIS 是一个基于 Cloudflare 原生技术栈（Workers, R2, D1, Vectorize, AI）构建的下一代摄影媒体基础设施。它彻底抛弃了传统的单体服务器架构，实现了极致的边缘处理能力与AI 驱动的语义搜索。

🚀 为什么选择 PIS？
边缘原生 (Edge-Native)：所有计算均在离用户最近的 Cloudflare 节点发生，全球毫秒级响应。

AI 驱动 (AI-Native)：上传即索引。系统自动分析图像内容、提取 EXIF 参数，并生成向量 Embedding，实现“所想即所得”的语义搜索。

无运维负担 (Zero-Ops)：全 Serverless 架构。你不再需要维护数据库副本、无需担心流量高峰导致的宕机。

异步事件流水线：利用 Cloudflare Queues 与 Durable Objects，构建高度可靠、可重试的异步图像处理引擎。

🛠 技术栈
Compute: Cloudflare Workers + Durable Objects

Storage: Cloudflare R2 (Binary) + Cloudflare D1 (Metadata)

Intelligence: Cloudflare Workers AI (Mobilenet, BGE-base)

Search: Cloudflare Vectorize (Semantic Vector Search)

Test: Vitest + Miniflare

⚡️ 核心能力概览
智能提取：自动读取拍摄参数（光圈、快门、焦段）、地理位置并存入 SQL 数据库。

语义搜索：支持自然语言查询（如：“夕阳下的海滩”），精准匹配相册中意境相符的照片。

弹性伸缩：架构天然具备水平扩展能力，从 10 张照片到 100 万张，性能表现稳定。

极致 API 设计：提供完整的 RESTful API，方便集成到你的 Next.js 应用、博客或自定义前端中。

🏁 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/JunyuZhan/pisc.git
cd pisc

# 2. 安装依赖
npm install

# 3. 配置 Cloudflare 资源（开源仓库不含真实 ID/密钥，需自行填写）
#    - 在 wrangler.toml 中填入 R2_ACCOUNT_ID、R2_BUCKET_NAME、D1 的 database_id
#    - 复制 .dev.vars.example 为 .dev.vars，填入 R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY
#    - 创建 R2 桶、D1、Vectorize、Queue 见 docs/setup-vectorize-queue.md
cp .dev.vars.example .dev.vars   # 然后编辑 .dev.vars，勿提交到 Git

# 4. 本地 D1 迁移（需先配置 wrangler.toml 中的 database_id 或使用 --local 用本地模拟）
npx wrangler d1 migrations apply pis-metadata --local

# 5. 启动本地开发环境
npx wrangler dev
```

📚 关键文档

- [架构设计](ARCHITECTURE.md)
- [开发任务清单](docs/tasklist.md)
- [贡献指南](CONTRIBUTING.md)

🤝 贡献说明

我们欢迎开发者参与贡献！无论你是图像处理专家、AI 爱好者，还是追求极限性能的架构师，PIS 都为你留出了空间。请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何提交 Issue 和 Pull Request。

📦 仓库命名建议

若你已有名为 `pis` 的仓库，本项目的代码仓库可选用以下名称以区分：

本仓库：**[JunyuZhan/pisc](https://github.com/JunyuZhan/pisc)**（Pisc = PIS + Cloud，基于 Cloudflare 的摄影媒体基础设施）。

🔒 开源与安全

- **勿将密钥提交到仓库**：`.dev.vars`、真实 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` 仅用于本地或通过 `wrangler secret put` 配置，已列入 `.gitignore`。
- **wrangler.toml**：仓库内使用占位符（如 `<YOUR_CF_ACCOUNT_ID>`、`<YOUR_D1_DATABASE_ID>`），克隆后请替换为你自己的 Cloudflare 资源 ID。

⚖️ 开源协议

本项目采用 MIT 开源协议。你可以自由使用、修改并分发该代码。