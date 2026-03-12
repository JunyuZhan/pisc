/**
 * API 响应工具函数
 * 统一响应格式，便于前端处理
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    hasMore?: boolean;
    limit?: number;
    offset?: number;
  };
}

/**
 * 成功响应
 */
export function successResponse<T>(
  data: T,
  meta?: ApiResponse['meta']
): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * 错误响应
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: any
): Response {
  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * 常见错误响应
 */
export const Errors = {
  notFound: (resource: string = 'Resource') =>
    errorResponse('NOT_FOUND', `${resource} not found`, 404),

  badRequest: (message: string, details?: any) =>
    errorResponse('BAD_REQUEST', message, 400, details),

  unauthorized: (message: string = 'Unauthorized') =>
    errorResponse('UNAUTHORIZED', message, 401),

  forbidden: (message: string = 'Forbidden') =>
    errorResponse('FORBIDDEN', message, 403),

  internalError: (message: string = 'Internal server error', details?: any) =>
    errorResponse('INTERNAL_ERROR', message, 500, details),

  serviceUnavailable: (service: string) =>
    errorResponse('SERVICE_UNAVAILABLE', `${service} not configured`, 500),
};

/**
 * 分页响应
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): Response {
  return successResponse(items, {
    total,
    hasMore: offset + limit < total,
    limit,
    offset,
  });
}
