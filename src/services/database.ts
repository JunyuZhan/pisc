/**
 * D1 数据访问层 - 元数据存储与查询
 * @see docs/tasklist.md 阶段 5
 * @see src/types/pipeline.ts IPhotoRepository 接口
 */

import type { PhotoRecord, PhotoTagRecord, IPhotoRepository } from "../types/pipeline.js";

export interface PhotoWithTags extends PhotoRecord {
  tags?: { name: string; confidence: number; source: string }[];
  exif?: string | null;
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
  photos: PhotoWithTags[];
  total: number;
  hasMore: boolean;
}

/**
 * D1 数据库访问服务
 * 实现 IPhotoRepository 接口，供 DO 调用
 */
export class DatabaseService implements IPhotoRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * 插入照片元数据
   */
  async insertPhoto(photo: PhotoRecord): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO photos (id, user_id, object_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    );

    const now = Math.floor(Date.now() / 1000);
    await stmt.bind(
      photo.id,
      photo.user_id,
      photo.object_key,
      photo.created_at ?? now,
      photo.updated_at ?? now
    ).run();
  }

  /**
   * 根据 ID 获取照片
   */
  async getPhotoById(id: string): Promise<PhotoWithTags | null> {
    const photoStmt = this.db.prepare(`SELECT * FROM photos WHERE id = ?`);
    const photoResult = await photoStmt.bind(id).first<PhotoRecord>();

    if (!photoResult) {
      return null;
    }

    // 获取标签
    const tagsStmt = this.db.prepare(`
      SELECT t.name, pt.confidence, pt.source
      FROM photo_tags pt
      JOIN tags t ON pt.tag_id = t.id
      WHERE pt.photo_id = ?
    `);
    const tagsResult = await tagsStmt.bind(id).all<{ name: string; confidence: number; source: string }>();

    // 获取 EXIF
    const exifStmt = this.db.prepare(`SELECT exif_json FROM photo_exif WHERE photo_id = ?`);
    const exifResult = await exifStmt.bind(id).first<{ exif_json: string | null }>();

    return {
      ...photoResult,
      tags: tagsResult.results,
      exif: exifResult?.exif_json ?? null,
    };
  }

  /**
   * 批量获取照片
   */
  async getPhotosByIds(ids: string[]): Promise<PhotoWithTags[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => "?").join(",");
    const stmt = this.db.prepare(`
      SELECT * FROM photos WHERE id IN (${placeholders})
    `);
    const result = await stmt.bind(...ids).all<PhotoRecord>();

    // 批量获取标签和 EXIF
    const photos = await Promise.all(
      result.results.map(async (photo) => {
        const tagsStmt = this.db.prepare(`
          SELECT t.name, pt.confidence, pt.source
          FROM photo_tags pt
          JOIN tags t ON pt.tag_id = t.id
          WHERE pt.photo_id = ?
        `);
        const tagsResult = await tagsStmt.bind(photo.id).all<{ name: string; confidence: number; source: string }>();

        const exifStmt = this.db.prepare(`SELECT exif_json FROM photo_exif WHERE photo_id = ?`);
        const exifResult = await exifStmt.bind(photo.id).first<{ exif_json: string | null }>();

        return {
          ...photo,
          tags: tagsResult.results,
          exif: exifResult?.exif_json ?? null,
        };
      })
    );

    return photos;
  }

  /**
   * 搜索照片（支持分页、过滤）
   */
  async searchPhotos(options: SearchOptions): Promise<SearchResult> {
    const {
      userId,
      tags,
      from,
      to,
      limit = 20,
      offset = 0,
      orderBy = "created_at",
      order = "DESC",
    } = options;

    // 构建查询条件
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (userId) {
      conditions.push("p.user_id = ?");
      params.push(userId);
    }

    if (from) {
      conditions.push("p.created_at >= ?");
      params.push(from);
    }

    if (to) {
      conditions.push("p.created_at <= ?");
      params.push(to);
    }

    // 标签过滤（需要 JOIN）
    let tagJoin = "";
    if (tags && tags.length > 0) {
      const tagPlaceholders = tags.map(() => "?").join(",");
      tagJoin = `
        INNER JOIN photo_tags pt_filter ON p.id = pt_filter.photo_id
        INNER JOIN tags t_filter ON pt_filter.tag_id = t_filter.id
        WHERE t_filter.name IN (${tagPlaceholders})
      `;
      params.push(...tags);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 查询总数
    const countStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT p.id) as total
      FROM photos p
      ${tagJoin}
      ${whereClause}
    `);
    const countResult = await countStmt.bind(...params).first<{ total: number }>();
    const total = countResult?.total ?? 0;

    // 查询列表
    const listStmt = this.db.prepare(`
      SELECT DISTINCT p.*
      FROM photos p
      ${tagJoin}
      ${whereClause}
      ORDER BY p.${orderBy} ${order}
      LIMIT ? OFFSET ?
    `);
    const listResult = await listStmt.bind(...params, limit, offset).all<PhotoRecord>();

    // 批量获取标签和 EXIF
    const photos = await Promise.all(
      listResult.results.map(async (photo) => {
        const tagsStmt = this.db.prepare(`
          SELECT t.name, pt.confidence, pt.source
          FROM photo_tags pt
          JOIN tags t ON pt.tag_id = t.id
          WHERE pt.photo_id = ?
        `);
        const tagsResult = await tagsStmt.bind(photo.id).all<{ name: string; confidence: number; source: string }>();

        const exifStmt = this.db.prepare(`SELECT exif_json FROM photo_exif WHERE photo_id = ?`);
        const exifResult = await exifStmt.bind(photo.id).first<{ exif_json: string | null }>();

        return {
          ...photo,
          tags: tagsResult.results,
          exif: exifResult?.exif_json ?? null,
        };
      })
    );

    return {
      photos,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * 更新照片元数据
   */
  async updatePhoto(id: string, updates: Partial<PhotoRecord>): Promise<void> {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (updates.object_key !== undefined) {
      fields.push("object_key = ?");
      values.push(updates.object_key);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    const stmt = this.db.prepare(
      `UPDATE photos SET ${fields.join(", ")} WHERE id = ?`
    );
    await stmt.bind(...values).run();
  }

  /**
   * 删除照片（级联删除标签关联）
   */
  async deletePhoto(id: string): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM photos WHERE id = ?`);
    await stmt.bind(id).run();
  }

  /**
   * 插入或更新照片标签
   */
  async upsertPhotoTags(
    photoId: string,
    tags: { name: string; confidence?: number; source?: string }[]
  ): Promise<void> {
    // 使用事务批量插入
    const statements: D1PreparedStatement[] = [];

    for (const tag of tags) {
      // 插入或忽略标签（确保标签存在）
      const insertTagStmt = this.db.prepare(
        `INSERT OR IGNORE INTO tags (name) VALUES (?)`
      );
      statements.push(insertTagStmt.bind(tag.name));

      // 获取标签 ID
      const getTagIdStmt = this.db.prepare(
        `SELECT id FROM tags WHERE name = ?`
      );
      const tagResult = await getTagIdStmt.bind(tag.name).first<{ id: number }>();

      if (tagResult) {
        // 插入或替换照片-标签关联
        const insertPhotoTagStmt = this.db.prepare(
          `INSERT OR REPLACE INTO photo_tags (photo_id, tag_id, confidence, source)
           VALUES (?, ?, ?, ?)`
        );
        statements.push(
          insertPhotoTagStmt.bind(photoId, tagResult.id, tag.confidence ?? 0, tag.source ?? "ai")
        );
      }
    }

    // 批量执行
    await this.db.batch(statements);
  }

  /**
   * 插入 EXIF 数据
   */
  async upsertExif(photoId: string, exifJson: string): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO photo_exif (photo_id, exif_json) VALUES (?, ?)`
    );
    await stmt.bind(photoId, exifJson).run();
  }

  /**
   * 获取照片处理状态（从 DO 状态表，如果有的话）
   * 这里先返回简单的存在性检查
   */
  async getPhotoStatus(id: string): Promise<{ exists: boolean; hasTags: boolean; hasExif: boolean }> {
    const photo = await this.db.prepare(`SELECT id FROM photos WHERE id = ?`).bind(id).first();
    const tags = await this.db.prepare(`SELECT photo_id FROM photo_tags WHERE photo_id = ? LIMIT 1`).bind(id).first();
    const exif = await this.db.prepare(`SELECT photo_id FROM photo_exif WHERE photo_id = ?`).bind(id).first();

    return {
      exists: !!photo,
      hasTags: !!tags,
      hasExif: !!exif,
    };
  }
}

/**
 * 创建数据库服务实例
 */
export function createDatabaseService(db: D1Database): DatabaseService {
  return new DatabaseService(db);
}
