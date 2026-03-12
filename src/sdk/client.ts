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
   * 获取照片详情
   */
  async getPhoto(photoId: string): Promise<{ photo: Photo }> {
    return this.request<{ photo: Photo }>(`/api/photos/${photoId}`);
  }

  /**
   * 获取照片列表
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
    return this.request<SearchResult>(`/api/photos${query ? `?${query}` : ""}`);
  }

  /**
   * 语义搜索照片
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

    return this.request<SearchResult>(`/api/photos/search?${params}`);
  }

  /**
   * 获取照片处理状态
   */
  async getPhotoStatus(photoId: string): Promise<PhotoStatus> {
    return this.request<PhotoStatus>(`/api/photos/${photoId}/status`);
  }

  /**
   * 删除照片
   */
  async deletePhoto(photoId: string): Promise<{ success: boolean; photoId: string }> {
    return this.request<{ success: boolean; photoId: string }>(`/api/photos/${photoId}`, {
      method: "DELETE",
    });
  }
}

export function createPISClient(baseUrl: string, apiKey?: string): PISClient {
  return new PISClient(baseUrl, apiKey);
}

export default PISClient;
