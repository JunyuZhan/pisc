/**
 * PIS 客户端 SDK
 * @see docs/tasklist.md 阶段 7.3
 */

export interface Photo {
  id: string;
  user_id: string;
  object_key: string;
  created_at: number;
  updated_at: number;
  tags?: { name: string; confidence: number; source: string }[];
  exif?: string | null;
  score?: number;
}

export interface SearchOptions {
  userId?: string;
  tags?: string[];
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
  orderBy?: "created_at" | "updated_at";
  order?: "ASC" | "DESC";
}

export interface SearchResult {
  photos: Photo[];
  total: number;
  hasMore: boolean;
}

export interface UploadResult {
  uploadUrl: string;
  publicId: string;
  expiresAt: number;
}

export interface PhotoStatus {
  photoId: string;
  status: "processing" | "completed" | "failed";
  details: {
    exists: boolean;
    hasTags: boolean;
    hasExif: boolean;
  };
}

export class PISClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.apiKey) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * 请求上传凭证
   */
  async requestUpload(): Promise<UploadResult> {
    return this.request<UploadResult>("/api/upload/request", {
      method: "POST",
    });
  }

  /**
   * 上传文件（获取预签名 URL 后直接上传）
   */
  async uploadFile(file: File | Blob): Promise<string> {
    const { uploadUrl, publicId, expiresAt } = await this.requestUpload();

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return publicId;
  }

  /**
   * 获取照片详情（解包 API 的 { success, data } 为 { photo }）
   */
  async getPhoto(photoId: string): Promise<{ photo: Photo }> {
    const res = await this.request<{ success: boolean; data: Photo }>(`/api/photos/${photoId}`);
    return { photo: res.data! };
  }

  /**
   * 获取照片列表（解包 API 的 { success, data, meta } 为 SearchResult）
   */
  async listPhotos(options: SearchOptions = {}): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (options.userId) params.set("userId", options.userId);
    if (options.tags) params.set("tags", options.tags.join(","));
    if (options.from) params.set("from", String(options.from));
    if (options.to) params.set("to", String(options.to));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    if (options.orderBy) params.set("orderBy", options.orderBy);
    if (options.order) params.set("order", options.order);

    const query = params.toString();
    const res = await this.request<{ success: boolean; data: Photo[]; meta?: { total: number; hasMore: boolean } }>(
      `/api/photos${query ? `?${query}` : ""}`
    );
    return {
      photos: res.data ?? [],
      total: res.meta?.total ?? 0,
      hasMore: res.meta?.hasMore ?? false,
    };
  }

  /**
   * 语义搜索照片（解包 API 的 { success, data, meta } 为 SearchResult）
   */
  async searchPhotos(
    query: string,
    options: {
      userId?: string;
      tags?: string[];
      from?: number;
      to?: number;
      limit?: number;
    } = {}
  ): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query });
    if (options.userId) params.set("userId", options.userId);
    if (options.tags) params.set("tags", options.tags.join(","));
    if (options.from) params.set("from", String(options.from));
    if (options.to) params.set("to", String(options.to));
    if (options.limit) params.set("limit", String(options.limit));

    const res = await this.request<{ success: boolean; data: Photo[]; meta?: { total: number; hasMore: boolean } }>(
      `/api/photos/search?${params}`
    );
    return {
      photos: res.data ?? [],
      total: res.meta?.total ?? 0,
      hasMore: res.meta?.hasMore ?? false,
    };
  }

  /**
   * 获取照片处理状态（解包 API 的 { success, data }）
   */
  async getPhotoStatus(photoId: string): Promise<PhotoStatus> {
    const res = await this.request<{ success: boolean; data: PhotoStatus }>(`/api/photos/${photoId}/status`);
    return res.data!;
  }

  /**
   * 删除照片（解包 API 的 { success, data }）
   */
  async deletePhoto(photoId: string): Promise<{ photoId: string; deleted: boolean }> {
    const res = await this.request<{ success: boolean; data: { photoId: string; deleted: boolean } }>(
      `/api/photos/${photoId}`,
      { method: "DELETE" }
    );
    return res.data!;
  }
}

export function createPISClient(baseUrl: string, apiKey?: string): PISClient {
  return new PISClient(baseUrl, apiKey);
}

export default PISClient;
