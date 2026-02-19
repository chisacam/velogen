import { Injectable } from "@nestjs/common";
import { Client } from "@notionhq/client";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { v4 as uuidv4 } from "uuid";
import type { NotionSourceConfig, RepoSourceConfig } from "@velogen/shared";
import { DatabaseService } from "../database/database.service";

const execFileAsync = promisify(execFile);

interface SourceRecord {
  id: string;
  type: "repo" | "notion";
  config_json: string;
}

interface IngestedItem {
  externalId: string;
  kind: "commit" | "notion";
  title: string;
  body: string;
  author?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ContentIngestionService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ingestSource(sourceId: string): Promise<number> {
    const source = this.databaseService.connection
      .prepare("SELECT id, type, config_json FROM sources WHERE id = ?")
      .get(sourceId) as SourceRecord | undefined;

    if (!source) {
      return 0;
    }

    const config = JSON.parse(source.config_json) as RepoSourceConfig | NotionSourceConfig;
    const items = source.type === "repo" ? await this.ingestRepo(config as RepoSourceConfig) : await this.ingestNotion(config as NotionSourceConfig);
    const normalizedItems = this.normalizeAndDedupe(items);

    const now = new Date().toISOString();
    const stmt = this.databaseService.connection.prepare(`
      INSERT INTO content_items (
        id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, external_id)
      DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        author = excluded.author,
        occurred_at = excluded.occurred_at,
        metadata_json = excluded.metadata_json
    `);

    const tx = this.databaseService.connection.transaction((rows: IngestedItem[]) => {
      for (const item of rows) {
        stmt.run(
          uuidv4(),
          source.id,
          item.externalId,
          item.kind,
          item.title,
          item.body,
          item.author ?? null,
          item.occurredAt ?? null,
          item.metadata ? JSON.stringify(item.metadata) : null,
          now
        );
      }
    });

    tx(normalizedItems);
    return normalizedItems.length;
  }

  private async ingestRepo(config: RepoSourceConfig): Promise<IngestedItem[]> {
    const repoDir = await this.resolveRepoPath(config);
    const sinceMonths = config.sinceMonths ?? 3;
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - sinceMonths);

    const { stdout } = await execFileAsync(
      "git",
      [
        "log",
        `--since=${sinceDate.toISOString()}`,
        "--date=iso-strict",
        "--pretty=format:%H%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%b%x1e"
      ],
      { cwd: repoDir, maxBuffer: 1024 * 1024 * 8 }
    );

    const requestedCommitters = (config.committers ?? []).map((v) => v.toLowerCase());
    const requiresFilter = requestedCommitters.length > 0;

    return stdout
      .split("\u001e")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        const [hash, authorName, authorEmail, authoredAt, subject, body] = entry.split("\u001f");
        const normalizedSubject = this.normalizeText(subject || "");
        const normalizedBody = this.normalizeText(body || "");
        return {
          externalId: hash,
          kind: "commit" as const,
          title: normalizedSubject.length > 0 ? normalizedSubject : "(no subject)",
          body: normalizedBody,
          author: `${authorName} <${authorEmail}>`,
          occurredAt: authoredAt,
          metadata: {
            hash,
            authorName,
            authorEmail,
            repoUrl: config.repoUrl ?? "",
            repoPath: config.repoPath ?? ""
          }
        };
      })
      .filter((item) => {
        if (!requiresFilter) {
          return true;
        }

        const lower = (item.author ?? "").toLowerCase();
        return requestedCommitters.some((committer) => lower.includes(committer));
      });
  }

  private async resolveRepoPath(config: RepoSourceConfig): Promise<string> {
    if (config.repoPath) {
      return config.repoPath;
    }

    const repoUrl = config.repoUrl;
    if (!repoUrl) {
      throw new Error("repoPath or repoUrl is required");
    }

    const hash = createHash("sha1").update(repoUrl).digest("hex");
    const cloneDir = join(tmpdir(), "velogen-repos", hash);
    mkdirSync(join(tmpdir(), "velogen-repos"), { recursive: true });

    if (!existsSync(cloneDir)) {
      await execFileAsync("git", ["clone", "--quiet", repoUrl, cloneDir], { maxBuffer: 1024 * 1024 * 8 });
      return cloneDir;
    }

    await execFileAsync("git", ["fetch", "--all", "--prune"], { cwd: cloneDir, maxBuffer: 1024 * 1024 * 8 });
    return cloneDir;
  }

  private async ingestNotion(config: NotionSourceConfig): Promise<IngestedItem[]> {
    const notion = new Client({ auth: config.token });
    const page = await notion.pages.retrieve({ page_id: config.pageId });
    const sinceMonths = config.sinceMonths ?? 3;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - sinceMonths);

    const occurredAt = "last_edited_time" in page ? page.last_edited_time : undefined;
    if (occurredAt) {
      const occurred = new Date(occurredAt);
      if (!Number.isNaN(occurred.valueOf()) && occurred < cutoff) {
        return [];
      }
    }

    const requestedAuthors = (config.authors ?? []).map((author) => author.toLowerCase());
    if (requestedAuthors.length > 0) {
      const lastEditedBy =
        "last_edited_by" in page && typeof page.last_edited_by === "object" && page.last_edited_by !== null
          ? (page.last_edited_by as { name?: string; id?: string })
          : null;
      const pageAuthorName = String(lastEditedBy?.name ?? "");
      const pageAuthorId = String(lastEditedBy?.id ?? "");
      const searchable = `${pageAuthorName} ${pageAuthorId}`.toLowerCase();
      if (!requestedAuthors.some((author) => searchable.includes(author))) {
        return [];
      }
    }

    const blocks = await this.collectBlocks(notion, config.pageId);
    const content = this.normalizeText(blocks.map((line) => `- ${line}`).join("\n"));

    const title = "properties" in page ? this.extractTitle(page.properties) : "Notion Content";

    return [
      {
        externalId: config.pageId,
        kind: "notion",
        title,
        body: content,
        author: "notion",
        occurredAt,
        metadata: {
          pageId: config.pageId,
          authors: config.authors ?? []
        }
      }
    ];
  }

  private normalizeAndDedupe(items: IngestedItem[]): IngestedItem[] {
    const seen = new Set<string>();
    const result: IngestedItem[] = [];

    for (const item of items) {
      const title = this.normalizeText(item.title);
      const body = this.normalizeText(item.body);
      const hasSignal = title.length > 0 || body.length >= 20;
      if (!hasSignal) {
        continue;
      }

      const fingerprint = createHash("sha1")
        .update(`${item.kind}|${title.toLowerCase()}|${body.slice(0, 400).toLowerCase()}`)
        .digest("hex");
      if (seen.has(fingerprint)) {
        continue;
      }
      seen.add(fingerprint);

      result.push({
        ...item,
        title: title.length > 0 ? title : "(untitled)",
        body,
        metadata: {
          ...(item.metadata ?? {}),
          fingerprint
        }
      });
    }

    return result;
  }

  private normalizeText(value: string): string {
    return value.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  private async collectBlocks(notion: Client, blockId: string): Promise<string[]> {
    const lines: string[] = [];
    let cursor: string | undefined;

    while (true) {
      const response = await notion.blocks.children.list({ block_id: blockId, page_size: 100, start_cursor: cursor });

      for (const block of response.results) {
        if (!("type" in block)) {
          continue;
        }

        const text = this.blockToPlainText(block as Record<string, unknown>);
        if (text) {
          lines.push(text);
        }

        if ("has_children" in block && block.has_children && "id" in block && typeof block.id === "string") {
          const childLines = await this.collectBlocks(notion, block.id);
          lines.push(...childLines);
        }
      }

      if (!response.has_more || !response.next_cursor) {
        break;
      }

      cursor = response.next_cursor;
    }

    return lines;
  }

  private extractTitle(properties: Record<string, unknown>): string {
    for (const value of Object.values(properties)) {
      if (typeof value === "object" && value !== null && "type" in value && (value as { type: string }).type === "title") {
        const titleObj = value as { title?: Array<{ plain_text?: string }> };
        return (titleObj.title ?? []).map((item) => item.plain_text ?? "").join("") || "Notion Content";
      }
    }

    return "Notion Content";
  }

  private blockToPlainText(block: Record<string, unknown>): string | null {
    const type = block.type;
    if (typeof type !== "string") {
      return null;
    }

    const payload = block[type] as { rich_text?: Array<{ plain_text?: string }>; text?: Array<{ plain_text?: string }> } | undefined;
    if (!payload) {
      return null;
    }

    if (Array.isArray(payload.rich_text)) {
      return payload.rich_text.map((item) => item.plain_text ?? "").join("").trim() || null;
    }

    if (Array.isArray(payload.text)) {
      return payload.text.map((item) => item.plain_text ?? "").join("").trim() || null;
    }

    return null;
  }
}
