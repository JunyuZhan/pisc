/**
 * 照片 API 处理器
 * @see docs/tasklist.md 阶段 7
 */

import { createDatabaseService, type PhotoWithTags, type SearchOptions } from "../services/database.js";
import { createVectorizeService } from "../services/vectorize.js";
import { createAIService } from "../services/ai.js";
import { successResponse, Errors, paginatedResponse } from "../utils/response.js";
import { authenticateUser, authorizeResourceAccess } from "../utils/auth.js";
import { parseLimit, parseOffset } from "../utils/pagination.js";

/**
 * GET /api/photos/:id - 获取单张照片详情
 */
export async function handleGetPhoto(
  request: Request,
  env: Env,
  photoId: string
): Promise<Response> {
  if (!env.DB) {
    return Errors.serviceUnavailable("Database");
  }

  // 认证用户
  const authContext = await authenticateUser(request, env);

  const db = createDatabaseService(env.DB);
  const photo = await db.getPhotoById(photoId);

  if (!photo) {
    return Errors.notFound("Photo");
  }

  // 授权检查：用户只能访问自己的照片
  if (authContext.authenticated && authContext.user) {
    if (!authorizeResourceAccess(authContext.user, photo.user_id)) {
      return Errors.forbidden("You don't have permission to access this photo");
    }
  }

  return successResponse(photo);
}

/**
 * GET /api/photos - 获取照片列表
 * Query params: userId, tags, from, to, limit, offset, orderBy, order
 */
export async function handleListPhotos(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.DB) {
    return Errors.serviceUnavailable("Database");
  }

  // 认证用户
  const authContext = await authenticateUser(request, env);

  const url = new URL(request.url);
  const params = url.searchParams;

  // 如果用户已认证，强制使用其 userId
  let userId = params.get("userId") ?? undefined;
  if (authContext.authenticated && authContext.user) {
    // 认证用户只能查看自己的照片
    userId = authContext.user.id;
  }

  const options: SearchOptions = {
    userId,
    tags: params.get("tags")?.split(",").filter(Boolean) ?? undefined,
    from: params.get("from") ? parseInt(params.get("from")!, 10) : undefined,
    to: params.get("to") ? parseInt(params.get("to")!, 10) : undefined,
    limit: parseLimit(params.get("limit")),
    offset: parseOffset(params.get("offset")),
    orderBy: (params.get("orderBy") as "created_at" | "updated_at") ?? "created_at",
    order: (params.get("order") as "ASC" | "DESC") ?? "DESC",
  };

  const db = createDatabaseService(env.DB);
  const result = await db.searchPhotos(options);

  return paginatedResponse(result.photos, result.total, options.limit!, options.offset!);
}

/**
 * GET /api/photos/search - 语义搜索
 * Query params: q, userId, tags, from, to, limit
 */
export async function handleSearchPhotos(
  request: Request,
  env: Env
): Promise<Response> {
  if (!env.DB || !env.VECTORIZE || !env.AI) {
    return Errors.serviceUnavailable("Database, Vectorize, or AI");
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  const query = params.get("q");
  if (!query) {
    return Errors.badRequest("Query parameter 'q' is required");
  }

  const authContext = await authenticateUser(request, env);
  let userId = params.get("userId") ?? undefined;
  if (authContext.authenticated && authContext.user) {
    userId = authContext.user.id;
  }
  const tags = params.get("tags")?.split(",").filter(Boolean) ?? undefined;
  const from = params.get("from") ? parseInt(params.get("from")!, 10) : undefined;
  const to = params.get("to") ? parseInt(params.get("to")!, 10) : undefined;
  const limit = parseLimit(params.get("limit"));

  // 1. 将查询文本转换为向量
  const aiService = createAIService(env);
  const { embedding } = await aiService.embedText(query);

  // 2. 向量搜索
  const vectorizeService = createVectorizeService(env.VECTORIZE);
  const vectorResults = await vectorizeService.hybridSearch(embedding, {
    topK: limit * 2, // 多取一些，用于后续过滤
    userId,
    from,
    to,
  });

  if (vectorResults.length === 0) {
    return paginatedResponse([], 0, limit, 0);
  }

  // 3. 从 D1 获取照片详情
  const db = createDatabaseService(env.DB);
  const photoIds = vectorResults.map((r) => r.id);
  const photos = await db.getPhotosByIds(photoIds);

  // 4. 构建结果（保持相似度排序）
  const scoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));
  const results = photos
    .map((photo) => ({
      ...photo,
      score: scoreMap.get(photo.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  // 5. 应用额外过滤（标签、时间范围）
  let filteredResults = results;

  if (tags && tags.length > 0) {
    filteredResults = filteredResults.filter((photo) =>
      photo.tags?.some((t) => tags.includes(t.name))
    );
  }

  if (from) {
    filteredResults = filteredResults.filter((photo) => photo.created_at! >= from);
  }

  if (to) {
    filteredResults = filteredResults.filter((photo) => photo.created_at! <= to);
  }

  // 6. 分页
  const paginatedResults = filteredResults.slice(0, limit);

  return paginatedResponse(paginatedResults, filteredResults.length, limit, 0);
}

/**
 * GET /api/photos/:id/status - 获取照片处理状态
 */
export async function handleGetPhotoStatus(
  request: Request,
  env: Env,
  photoId: string
): Promise<Response> {
  if (!env.DB) {
    return Errors.serviceUnavailable("Database");
  }

  const db = createDatabaseService(env.DB);
  const status = await db.getPhotoStatus(photoId);

  if (!status.exists) {
    return Errors.notFound("Photo");
  }

  // TODO: 从 Durable Object 获取更详细的状态

  return successResponse({
    photoId,
    status: status.hasTags && status.hasExif ? "completed" : "processing",
    details: status,
  });
}

/**
 * DELETE /api/photos/:id - 删除照片
 */
export async function handleDeletePhoto(
  request: Request,
  env: Env,
  photoId: string
): Promise<Response> {
  if (!env.DB || !env.VECTORIZE || !env.BUCKET) {
    return Errors.serviceUnavailable("Database, Vectorize, or R2");
  }

  const authContext = await authenticateUser(request, env);
  if (!authContext.authenticated || !authContext.user) {
    return Errors.unauthorized("Authentication required to delete a photo");
  }

  const db = createDatabaseService(env.DB);
  const photo = await db.getPhotoById(photoId);

  if (!photo) {
    return Errors.notFound("Photo");
  }

  if (!authorizeResourceAccess(authContext.user, photo.user_id)) {
    return Errors.forbidden("You don't have permission to delete this photo");
  }

  // 2. 删除 R2 对象
  try {
    await env.BUCKET.delete(photo.object_key);
  } catch (error) {
    console.error("Failed to delete R2 object:", error);
    // 继续删除其他资源
  }

  // 3. 删除向量
  const vectorizeService = createVectorizeService(env.VECTORIZE);
  try {
    await vectorizeService.deleteVector(photoId);
  } catch (error) {
    console.error("Failed to delete vector:", error);
    // 继续删除其他资源
  }

  // 4. 删除数据库记录（级联删除标签和 EXIF）
  await db.deletePhoto(photoId);

  return successResponse({ photoId, deleted: true });
}
