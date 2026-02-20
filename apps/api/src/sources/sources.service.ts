import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { CreateSourceDto, NotionSourceConfig, RepoSourceConfig, SourceSummary } from "@velogen/shared";
import { DatabaseService } from "../database/database.service";

interface SourceRow {
  id: string;
  name: string;
  type: "repo" | "notion";
  config_json: string;
  active: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SourcesService {
  constructor(private readonly databaseService: DatabaseService) { }

  listSources(): SourceSummary[] {
    const rows = this.databaseService.connection
      .prepare("SELECT id, name, type, active, config_json, created_at FROM sources ORDER BY created_at DESC")
      .all() as Array<Pick<SourceRow, "id" | "name" | "type" | "active" | "config_json" | "created_at">>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      active: row.active === 1,
      createdAt: row.created_at,
      config: JSON.parse(row.config_json) as RepoSourceConfig | NotionSourceConfig
    }));
  }

  getSourceById(sourceId: string): SourceRow {
    const row = this.databaseService.connection
      .prepare("SELECT * FROM sources WHERE id = ?")
      .get(sourceId) as SourceRow | undefined;

    if (!row) {
      throw new NotFoundException(`Source not found: ${sourceId}`);
    }

    return row;
  }

  createSource(payload: CreateSourceDto): SourceSummary {
    if (!payload.name || !payload.type) {
      throw new BadRequestException("name and type are required");
    }

    const config = this.normalizeSourceConfig(payload);
    const id = uuidv4();
    const now = new Date().toISOString();
    this.databaseService.connection
      .prepare(
        "INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
      )
      .run(id, payload.name, payload.type, JSON.stringify(config), now, now);

    return {
      id,
      name: payload.name,
      type: payload.type,
      active: true,
      createdAt: now
    };
  }

  removeSource(sourceId: string): void {
    const result = this.databaseService.connection.prepare("DELETE FROM sources WHERE id = ?").run(sourceId);
    if (result.changes === 0) {
      throw new NotFoundException(`Source not found: ${sourceId}`);
    }
  }

  private normalizeSourceConfig(payload: CreateSourceDto): RepoSourceConfig | NotionSourceConfig {
    if (payload.type === "repo") {
      const config = payload.repoConfig;
      if (!config || (!config.repoPath && !config.repoUrl)) {
        throw new BadRequestException("repoConfig.repoPath or repoConfig.repoUrl is required");
      }

      return {
        repoPath: config.repoPath,
        repoUrl: config.repoUrl,
        sinceMonths: config.sinceMonths ?? 3,
        committers: config.committers ?? []
      };
    }

    const notionConfig = payload.notionConfig;
    if (!notionConfig || !notionConfig.pageId || !notionConfig.token) {
      throw new BadRequestException("notionConfig.pageId and notionConfig.token are required");
    }

    return {
      pageId: notionConfig.pageId,
      token: notionConfig.token,
      sinceMonths: notionConfig.sinceMonths ?? 3,
      authors: notionConfig.authors ?? []
    };
  }
}
