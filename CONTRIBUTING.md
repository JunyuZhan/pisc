Contributing to PIS (Photo Intelligence System)
感谢你对 PIS 的关注！我们致力于构建一个高性能、AI 原生、边缘优先的摄影媒体基础设施。无论你是想修复一个 Bug、添加一个新的 AI 处理模型，还是改进我们的边缘调度逻辑，我们都非常欢迎。

1. 行为准则 (Code of Conduct)
通过参与本项目，请保持专业、包容且友好的态度。我们推崇技术上的严谨与探索精神。**请勿在 Issue/PR 或公开讨论中粘贴真实 API Key、Account ID、Secret 或 .dev.vars 内容**；配置与密钥仅限本地或通过 Cloudflare 控制台 / `wrangler secret` 管理。

2. 开发环境准备 (Getting Started)
要参与开发，请确保你已安装以下环境：

Node.js: v18+

Wrangler: npm install -g wrangler

Cloudflare 账号: 拥有可用的 Cloudflare Workers 权限

设置步骤：
Fork 本仓库 到你的 GitHub 账号。

克隆项目: `git clone https://github.com/JunyuZhan/pisc.git`

安装依赖: npm install

配置开发环境: 在 **wrangler.toml** 中将占位符（`<YOUR_CF_ACCOUNT_ID>`、`<YOUR_D1_DATABASE_ID>`）替换为你自己的 Cloudflare 资源 ID；复制 **.dev.vars.example** 为 **.dev.vars** 并填入 R2 等密钥（**.dev.vars 勿提交到 Git**）。详见 README 快速开始与 [docs/setup-vectorize-queue.md](docs/setup-vectorize-queue.md)。

本地开发: 运行 `npx wrangler dev` 启动边缘模拟环境。

3. 开发规范与分支 (Development Norms)
- **日常开发请在 `development` 分支进行**，不要直接在 `main` 上提交。
- 仅在测试通过、运行稳定且维护者确认后再将 `development` 合并到 `main`。
- **部署说明**：本仓库若已在 Cloudflare 中关联 GitHub，则**推送到所配置分支（如 `main`）会触发自动部署**。合并前请确认改动无敏感信息、通过测试且符合安全与兼容性要求。
- 首次参与开发时：克隆后执行 `git checkout -b development`（若尚无该分支则创建并推送）。
- 开发任务顺序以 [docs/tasklist.md](docs/tasklist.md) 为准，从阶段 1 开始。
- **多人同一目录协作**：三人共用同一仓库、同一物理目录可行；分工、目录边界与分支约定见 tasklist 中「协同开发与任务分配」→「同一物理目录 / 同一仓库协同」。

4. 贡献工作流 (Contribution Workflow)
我们将项目划分为三大核心平面，请在提交前确定你的更改属于哪个领域：

接入平面 (Ingress): 优化预签名 URL 生成与鉴权逻辑。

处理平面 (Processing): 改进 Durable Objects 的状态流转、重试机制或 AI 任务编排。

数据平面 (Data): 优化 D1 SQL 查询、Vectorize 索引策略或 Schema 设计。

提交流程：
创建分支: git checkout -b feature/your-feature-name

编写代码: 请确保逻辑与现有 异步事件驱动流水线 兼容。

编写测试: 所有的处理逻辑（特别是 DO 状态机）必须包含 vitest 集成测试。

运行测试: npm test（确保所有 pool-workers 测试通过）。

提交 PR: 请详细描述你的更改如何解决特定问题，并附上必要的架构变更说明。

5. 关键原则 (Engineering Principles)
状态幂等性: 任何改变对象状态的操作必须是幂等的，防止重复入库。

异步优先: 所有 I/O 操作必须是 await 的，严禁阻塞事件循环。

边缘亲和: 优先使用 Cloudflare 原生绑定（Workers AI, Vectorize, D1），减少对外部 API 的依赖。

代码即文档: 对于复杂的 DO 流转逻辑，请在代码块旁添加流程注释或 ASCII 状态图。

6. 项目结构 (Project Structure)
与 `docs/tasklist.md` 阶段 1.1 中定义保持一致，统一命名如下：

```
src/
  worker/          # Worker 入口与路由
  handlers/        # 请求处理函数（API 控制器）
  services/        # 业务逻辑（AI 推理、元数据、D1/Vectorize 访问等）
  durable-objects/ # Durable Object 类
  utils/           # 工具函数
  types/           # 类型定义
test/              # 测试文件
migrations/        # D1 数据库迁移
wrangler.toml      # 配置文件
```

与三大核心平面对应关系：
- **接入平面** → `src/worker`、`src/handlers`
- **处理平面** → `src/durable-objects`（及 Worker 内队列消费逻辑）
- **数据平面** → `src/services`（D1/Vectorize）、`migrations/`
7. 如何提出改进意见
如果你有关于架构的重大调整（例如引入新的存储适配器或向量模型）：

请先提交一个 Issue，选择 Architecture Proposal 模板。

说明该调整在边缘侧的性能影响。

等待 Maintainer 确认后再进行编码。

再次感谢你的贡献！让我们一起构建下一代摄影媒体架构。