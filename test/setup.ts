/**
 * 测试环境：为加载含 Durable Object 的 Worker 模块提供全局 DurableObject 桩
 * 仅用于让模块解析通过；实际 DO 逻辑在 workerd 中运行
 */
if (typeof globalThis.DurableObject === "undefined") {
  (globalThis as unknown as { DurableObject: unknown }).DurableObject = class DurableObject {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  };
}
