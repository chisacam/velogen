import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { AgentProvider, CreateSessionDto, UpdateSessionConfigDto } from "@velogen/shared";
import { DatabaseService } from "../database/database.service";
import { GenerationService } from "../generation/generation.service";
import { ContentIngestionService } from "../sync/content-ingestion.service";

interface SessionRow {
  id: string;
  title: string;
  tone: string | null;
  format: string | null;
  provider: AgentProvider;
  created_at: string;
  updated_at: string;
}

export interface UpdatePostPayload {
  title?: string;
  body?: string;
  status?: "draft" | "published";
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly generationService: GenerationService,
    private readonly ingestionService: ContentIngestionService
  ) { }

  createSession(payload: CreateSessionDto): { id: string; title: string; createdAt: string } {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.databaseService.connection
      .prepare("INSERT INTO sessions (id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, payload.title, "mock", now, now);

    return { id, title: payload.title, createdAt: now };
  }

  listSessions(): Array<{ id: string; title: string; tone: string | null; format: string | null; provider: AgentProvider; updatedAt: string }> {
    const rows = this.databaseService.connection
      .prepare("SELECT id, title, tone, format, provider, updated_at FROM sessions ORDER BY updated_at DESC")
      .all() as Array<Pick<SessionRow, "id" | "title" | "tone" | "format" | "provider" | "updated_at">>;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      tone: row.tone,
      format: row.format,
      provider: row.provider,
      updatedAt: row.updated_at
    }));
  }

  updateSessionConfig(sessionId: string, payload: UpdateSessionConfigDto): { ok: true } {
    const now = new Date().toISOString();
    const result = this.databaseService.connection
      .prepare("UPDATE sessions SET tone = ?, format = ?, provider = COALESCE(?, provider), updated_at = ? WHERE id = ?")
      .run(payload.tone ?? null, payload.format ?? null, payload.provider ?? null, now, sessionId);

    if (result.changes === 0) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    return { ok: true };
  }

  addSource(sessionId: string, sourceId: string): { ok: true } {
    this.assertSessionExists(sessionId);
    this.assertSourceExists(sourceId);
    const now = new Date().toISOString();
    this.databaseService.connection
      .prepare("INSERT OR IGNORE INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)")
      .run(sessionId, sourceId, now);
    return { ok: true };
  }

  removeSource(sessionId: string, sourceId: string): { ok: true } {
    this.assertSessionExists(sessionId);
    this.databaseService.connection
      .prepare("DELETE FROM session_sources WHERE session_id = ? AND source_id = ?")
      .run(sessionId, sourceId);
    return { ok: true };
  }

  listSessionSources(sessionId: string): Array<{ sourceId: string; name: string; type: string }> {
    this.assertSessionExists(sessionId);
    return this.databaseService.connection
      .prepare(
        "SELECT s.id as sourceId, s.name as name, s.type as type FROM session_sources ss JOIN sources s ON s.id = ss.source_id WHERE ss.session_id = ? ORDER BY ss.created_at DESC"
      )
      .all(sessionId) as Array<{ sourceId: string; name: string; type: string }>;
  }

  async generate(
    sessionId: string,
    provider: AgentProvider,
    tone?: string,
    format?: string,
    userInstruction?: string,
    refinePostId?: string
  ) {
    this.assertSessionExists(sessionId);
    const sourceCountRow = this.databaseService.connection
      .prepare("SELECT COUNT(*) as count FROM session_sources WHERE session_id = ?")
      .get(sessionId) as { count: number };
    if (sourceCountRow.count === 0) {
      throw new BadRequestException("At least one source must be attached before generation");
    }

    let refinePostBody: string | undefined;
    if (refinePostId) {
      const postRow = this.databaseService.connection
        .prepare("SELECT body FROM blog_posts WHERE id = ? AND session_id = ?")
        .get(refinePostId, sessionId) as { body: string } | undefined;
      refinePostBody = postRow?.body;
    }

    return this.generationService.generateFromSession(
      sessionId, provider, tone, format, userInstruction, refinePostBody, refinePostId
    );
  }

  async generateStream(
    sessionId: string,
    provider: AgentProvider,
    tone: string | undefined,
    format: string | undefined,
    onChunk: (chunk: string) => void,
    userInstruction?: string,
    refinePostId?: string
  ) {
    this.assertSessionExists(sessionId);
    const sourceCountRow = this.databaseService.connection
      .prepare("SELECT COUNT(*) as count FROM session_sources WHERE session_id = ?")
      .get(sessionId) as { count: number };
    if (sourceCountRow.count === 0) {
      throw new BadRequestException("At least one source must be attached before generation");
    }

    let refinePostBody: string | undefined;
    if (refinePostId) {
      const postRow = this.databaseService.connection
        .prepare("SELECT body FROM blog_posts WHERE id = ? AND session_id = ?")
        .get(refinePostId, sessionId) as { body: string } | undefined;
      refinePostBody = postRow?.body;
    }

    return this.generationService.generateFromSessionStream(
      sessionId, provider, tone, format, onChunk, userInstruction, refinePostBody, refinePostId
    );
  }

  async syncSource(sessionId: string, sourceId: string): Promise<{ ingested: number }> {
    this.assertSessionExists(sessionId);
    this.assertSourceAttached(sessionId, sourceId);
    const ingested = await this.ingestionService.ingestSource(sourceId);
    return { ingested };
  }

  listPosts(sessionId: string): Array<{ id: string; title: string; provider: string; createdAt: string }> {
    this.assertSessionExists(sessionId);
    return this.databaseService.connection
      .prepare(
        "SELECT id, title, provider, status, created_at as createdAt, updated_at as updatedAt FROM blog_posts WHERE session_id = ? ORDER BY updated_at DESC"
      )
      .all(sessionId) as Array<{ id: string; title: string; provider: string; status: string; createdAt: string; updatedAt: string }>;
  }

  getPost(sessionId: string, postId: string) {
    this.assertSessionExists(sessionId);
    const row = this.databaseService.connection
      .prepare(
        "SELECT id, title, body, provider, status, created_at as createdAt, updated_at as updatedAt, generation_meta_json as generationMetaJson FROM blog_posts WHERE session_id = ? AND id = ?"
      )
      .get(sessionId, postId) as
      | {
        id: string;
        title: string;
        body: string;
        provider: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        generationMetaJson: string | null;
      }
      | undefined;

    if (!row) {
      throw new NotFoundException(`Post not found: ${postId}`);
    }

    const { generationMetaJson, ...rest } = row;
    return {
      ...rest,
      generationMeta: generationMetaJson
        ? (JSON.parse(generationMetaJson) as Record<string, unknown>)
        : undefined
    };
  }

  updatePost(
    sessionId: string,
    postId: string,
    payload: UpdatePostPayload
  ): { id: string; title: string; body: string; provider: string; status: string; createdAt: string; updatedAt: string } {
    this.assertSessionExists(sessionId);
    const current = this.getPost(sessionId, postId);
    const nextTitle = payload.title ?? current.title;
    const nextBody = payload.body ?? current.body;
    const nextStatus = payload.status ?? (current.status as "draft" | "published");

    if (nextBody.trim().length === 0) {
      throw new BadRequestException("Post body cannot be empty");
    }

    const now = new Date().toISOString();
    this.databaseService.connection
      .prepare("UPDATE blog_posts SET title = ?, body = ?, status = ?, updated_at = ? WHERE id = ? AND session_id = ?")
      .run(nextTitle, nextBody, nextStatus, now, postId, sessionId);

    const versionRow = this.databaseService.connection
      .prepare("SELECT COALESCE(MAX(version), 0) as maxVersion FROM blog_post_revisions WHERE post_id = ?")
      .get(postId) as { maxVersion: number };
    const nextVersion = versionRow.maxVersion + 1;
    this.databaseService.connection
      .prepare(
        "INSERT INTO blog_post_revisions (id, post_id, version, title, body, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(uuidv4(), postId, nextVersion, nextTitle, nextBody, nextStatus, "manual-edit", now);

    return this.getPost(sessionId, postId);
  }

  listPostRevisions(
    sessionId: string,
    postId: string
  ): Array<{ id: string; version: number; title: string; status: string; source: string; createdAt: string }> {
    this.assertSessionExists(sessionId);
    this.getPost(sessionId, postId);

    return this.databaseService.connection
      .prepare(
        "SELECT id, version, title, status, source, created_at as createdAt FROM blog_post_revisions WHERE post_id = ? ORDER BY version DESC"
      )
      .all(postId) as Array<{ id: string; version: number; title: string; status: string; source: string; createdAt: string }>;
  }

  getPostRevision(
    sessionId: string,
    postId: string,
    revisionId: string
  ): { id: string; version: number; title: string; body: string; status: string; source: string; createdAt: string } {
    this.assertSessionExists(sessionId);
    this.getPost(sessionId, postId);

    const row = this.databaseService.connection
      .prepare(
        "SELECT id, version, title, body, status, source, created_at as createdAt FROM blog_post_revisions WHERE post_id = ? AND id = ?"
      )
      .get(postId, revisionId) as
      | { id: string; version: number; title: string; body: string; status: string; source: string; createdAt: string }
      | undefined;

    if (!row) {
      throw new NotFoundException(`Revision not found: ${revisionId}`);
    }

    return row;
  }

  deleteSession(sessionId: string): { ok: true } {
    this.assertSessionExists(sessionId);
    this.databaseService.connection
      .prepare("DELETE FROM sessions WHERE id = ?")
      .run(sessionId);
    return { ok: true };
  }

  private assertSessionExists(sessionId: string): void {
    const row = this.databaseService.connection
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(sessionId) as { id: string } | undefined;

    if (!row) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
  }

  private assertSourceExists(sourceId: string): void {
    const row = this.databaseService.connection
      .prepare("SELECT id FROM sources WHERE id = ?")
      .get(sourceId) as { id: string } | undefined;

    if (!row) {
      throw new NotFoundException(`Source not found: ${sourceId}`);
    }
  }

  private assertSourceAttached(sessionId: string, sourceId: string): void {
    const row = this.databaseService.connection
      .prepare("SELECT source_id FROM session_sources WHERE session_id = ? AND source_id = ?")
      .get(sessionId, sourceId) as { source_id: string } | undefined;

    if (!row) {
      throw new NotFoundException(`Source ${sourceId} is not attached to session ${sessionId}`);
    }
  }
}
