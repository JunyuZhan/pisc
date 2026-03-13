# Pisc CORS 配置说明

当 **API 被浏览器从不同源**（不同协议/域名/端口）调用时，浏览器会先发 **OPTIONS 预检**，再发实际请求。若未返回 CORS 头，浏览器会拦截请求。Pisc 提供可选的 CORS 支持，由**部署者在需要时**自行配置，不预设任何前端域名。

---

## 行为说明

- 配置了 **`CORS_ORIGIN`** 时：对所有响应附加 CORS 头，对 **OPTIONS** 请求直接返回 **204** 并带 CORS 头。
- **未配置** `CORS_ORIGIN`：不添加 CORS 头，行为与未启用 CORS 时一致。

---

## 响应头（由代码自动添加）

```
Access-Control-Allow-Origin: <CORS_ORIGIN 配置值>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

---

## 配置方式

在 Worker 的 **Variables and Secrets** 中设置 **`CORS_ORIGIN`**：

- **单源**：填一个完整 Origin，如 `https://your-app.example.com`。
- **多源**：逗号分隔，如 `https://app.example.com,https://admin.example.com`。服务按请求头 `Origin` 做白名单匹配，命中则返回该 Origin，否则返回列表中的第一个。

调用方（任意前端、控制台或脚本）若从浏览器跨源访问 Pisc，需在**部署 Pisc 的账号**里配置自己的 Origin，与 Pisc 代码无耦合。

---

## 实现位置

- `src/utils/cors.ts`：`getCorsHeaders`、`withCors`
- `src/worker/index.ts`：对所有响应统一附加 CORS，对 OPTIONS 直接 204

详见本仓库 [deploy.md](deploy.md) 中的环境变量说明。
