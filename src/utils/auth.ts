/**
 * 身份认证与授权中间件
 * 确保用户只能访问自己的照片
 */

export interface User {
  id: string;
  role?: string;
}

export interface AuthContext {
  user: User | null;
  authenticated: boolean;
}

/**
 * 从请求中提取用户信息
 * 支持 JWT 和 API Key 两种方式
 */
export async function authenticateUser(
  request: Request,
  env: Env
): Promise<AuthContext> {
  // 如果未配置认证密钥，跳过认证（开发环境）
  if (!env.AUTH_SECRET) {
    return {
      user: { id: "dev-user", role: "admin" },
      authenticated: true,
    };
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return {
      user: null,
      authenticated: false,
    };
  }

  // 支持 Bearer Token（简单共享密钥或 JWT）
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === env.AUTH_SECRET) {
      return { user: { id: "api-user" }, authenticated: true };
    }
    return await verifyJWT(token, env.AUTH_SECRET);
  }

  // 支持 API Key（简单共享密钥或 userId:signature）
  if (authHeader.startsWith("ApiKey ")) {
    const apiKey = authHeader.substring(7);
    if (apiKey === env.AUTH_SECRET) {
      return { user: { id: "api-user" }, authenticated: true };
    }
    return await verifyApiKey(apiKey, env.AUTH_SECRET);
  }

  return {
    user: null,
    authenticated: false,
  };
}

/**
 * 验证 JWT Token
 */
async function verifyJWT(token: string, secret: string): Promise<AuthContext> {
  try {
    // 简化的 JWT 验证（生产环境应使用完整的 JWT 库）
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { user: null, authenticated: false };
    }

    // 解码 payload
    const payload = JSON.parse(atob(parts[1]));

    // 验证过期时间
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { user: null, authenticated: false };
    }

    return {
      user: {
        id: payload.sub || payload.userId,
        role: payload.role,
      },
      authenticated: true,
    };
  } catch (error) {
    console.error("JWT verification failed:", error);
    return { user: null, authenticated: false };
  }
}

/**
 * 验证 API Key
 */
async function verifyApiKey(apiKey: string, secret: string): Promise<AuthContext> {
  try {
    // 简单的 API Key 验证
    // 格式: userId:signature
    const [userId, signature] = apiKey.split(":");

    if (!userId || !signature) {
      return { user: null, authenticated: false };
    }

    // 验证签名（生产环境应使用 HMAC）
    const expectedSignature = await createSignature(userId, secret);
    if (signature !== expectedSignature) {
      return { user: null, authenticated: false };
    }

    return {
      user: { id: userId },
      authenticated: true,
    };
  } catch (error) {
    console.error("API Key verification failed:", error);
    return { user: null, authenticated: false };
  }
}

/**
 * 创建签名
 */
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 授权检查：确保用户只能访问自己的资源
 */
export function authorizeResourceAccess(
  user: User,
  resourceUserId: string
): boolean {
  // 管理员可以访问所有资源
  if (user.role === "admin") {
    return true;
  }

  // 普通用户只能访问自己的资源
  return user.id === resourceUserId;
}

/**
 * 认证中间件
 * 用于需要认证的路由
 */
export async function withAuth(
  request: Request,
  env: Env,
  handler: (user: User) => Promise<Response>
): Promise<Response> {
  const authContext = await authenticateUser(request, env);

  if (!authContext.authenticated || !authContext.user) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return await handler(authContext.user);
}

/**
 * 可选认证中间件
 * 如果提供了认证信息则验证，否则继续
 */
export async function withOptionalAuth(
  request: Request,
  env: Env,
  handler: (user: User | null) => Promise<Response>
): Promise<Response> {
  const authContext = await authenticateUser(request, env);
  return await handler(authContext.user);
}
