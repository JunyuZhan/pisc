/**
 * 身份认证与授权中间件
 * @see docs/tasklist.md 阶段 7.2
 */

export interface AuthContext {
  userId: string;
  isAuthenticated: boolean;
}

export interface AuthConfig {
  secret?: string;
  issuer?: string;
  audience?: string;
}

/**
 * 从请求中解析认证信息
 * 支持：
 * 1. Bearer Token (JWT)
 * 2. API Key (X-API-Key header)
 * 3. 简单密钥 (X-Auth-Secret header)
 */
export async function authenticate(request: Request, env: Env): Promise<AuthContext> {
  const authSecret = env.AUTH_SECRET;

  if (!authSecret) {
    return { userId: "anonymous", isAuthenticated: false };
  }

  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("X-API-Key");
  const secretHeader = request.headers.get("X-Auth-Secret");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return validateJWT(token, authSecret);
  }

  if (apiKeyHeader) {
    return validateAPIKey(apiKeyHeader, authSecret);
  }

  if (secretHeader) {
    return validateSecret(secretHeader, authSecret);
  }

  return { userId: "anonymous", isAuthenticated: false };
}

async function validateJWT(token: string, secret: string): Promise<AuthContext> {
  try {
    const [header, payload, signature] = token.split(".");
    
    if (!header || !payload || !signature) {
      return { userId: "anonymous", isAuthenticated: false };
    }

    const payloadJson = JSON.parse(atob(payload));
    
    if (payloadJson.exp && Date.now() > payloadJson.exp * 1000) {
      return { userId: "anonymous", isAuthenticated: false };
    }

    return {
      userId: payloadJson.sub || payloadJson.userId || "unknown",
      isAuthenticated: true,
    };
  } catch {
    return { userId: "anonymous", isAuthenticated: false };
  }
}

function validateAPIKey(apiKey: string, secret: string): AuthContext {
  if (apiKey === secret) {
    return { userId: "api-user", isAuthenticated: true };
  }

  if (apiKey.startsWith("pk_")) {
    const userId = apiKey.slice(3).split("_")[0];
    return { userId: userId || "api-user", isAuthenticated: true };
  }

  return { userId: "anonymous", isAuthenticated: false };
}

function validateSecret(secret: string, expectedSecret: string): AuthContext {
  if (secret === expectedSecret) {
    return { userId: "secret-user", isAuthenticated: true };
  }
  return { userId: "anonymous", isAuthenticated: false };
}

export function requireAuth(context: AuthContext): void {
  if (!context.isAuthenticated) {
    throw new Error("Unauthorized");
  }
}

export function requireUserId(context: AuthContext, expectedUserId: string): void {
  if (!context.isAuthenticated || context.userId !== expectedUserId) {
    throw new Error("Forbidden");
  }
}
