PIS (Photo Intelligence System) Architecture
1. 核心架构设计哲学 (Core Philosophy)
PIS 不仅仅是一个存储图片的图床，它是一个边缘原生 (Edge-Native) 的 AI 媒体中间件。其设计遵循以下三个核心原则：

Serverless 优先：摒弃服务器维护成本，全链路部署在 Cloudflare Global Network。

事件驱动 (Event-Driven)：采用“上传-事件通知-队列-异步处理”的模式，实现上传与元数据处理的完全解耦。

数据与元数据分离：二进制文件存入 R2，结构化数据存入 D1，语义向量存入 Vectorize。

2. 宏观架构图 (System Architecture)
系统逻辑上分为四个平面：

接入平面 (Ingress)：处理鉴权、上传凭证生成及限流。

事件处理平面 (Event-Driven Pipeline)：利用 Cloudflare Queues 和 Durable Objects 进行任务编排。

智能推理平面 (AI Processing)：执行图像分析、语义提取及向量化。

数据存储平面 (Data Persistence)：存储二进制、元数据与向量索引。

3. 技术栈细分 (Technology Stack)
组件	技术选型	核心职责
运行时	Cloudflare Workers	处理 API 请求、逻辑控制、事件响应
存储层	Cloudflare R2	全球分布式对象存储 (二进制)
协调层	Durable Objects	状态机管理、任务重试、分布式锁
元数据存储	Cloudflare D1	关系型存储 (照片信息、EXIF、标签)
向量搜索	Cloudflare Vectorize	提供基于 AI 语义的相似度搜索
AI 计算	Workers AI	模型推理 (图像标签、Embedding)
4. 关键逻辑流 (Key Logic Flows)
4.1 异步处理状态机 (Durable Object Workflow)
为了保证处理过程的健壮性，我们采用基于状态机的编排逻辑：

系统状态流转逻辑：
Pending -> Extracting -> Tagging -> Vectorizing -> Persisting -> Completed

每个步骤都是幂等的，若在任一阶段失败，系统将触发指数退避重试 (Exponential Backoff)，确保最终一致性。

4.2 智能检索流程 (Search Pipeline)
系统支持“结构化 SQL”与“非结构化语义”的混合检索：

语义解析：用户输入的自然语言通过 Workers AI 转换为向量。

候选集筛选：在 Vectorize 中检索语义相似度最高的 TOP K 图片。

结构化过滤：在 D1 中根据 taken_at, location, tags 等条件对候选集进行二次精确过滤。

5. 可扩展性与容灾 (Scalability & Resilience)
水平扩展：Worker 与消费者队列能够根据流量自动扩容。

故障隔离：单个图片的处理被隔离在独立的 Durable Object 实例中，互不影响。

幂等性保障：所有写入操作在执行前都会校验处理记录表，防止因队列重试导致的冗余写入。

6. 开发者协议与扩展接口 (Interface Definitions)
为保证系统的持续可演进性，所有交互均通过强类型接口定义：

上传协议：遵循 S3 分片上传规范，兼容主流客户端。

AI 插件接口：定义统一 ImageProcessor 接口，支持轻松接入新的模型 (如 CLIP 或视觉大模型)。

数据模式：元数据遵循规范化的 SQLite Schema 设计，确保检索性能最优。