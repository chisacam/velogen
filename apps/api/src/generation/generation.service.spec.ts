import Database from "better-sqlite3";
import { GenerationService } from "./generation.service";
import type { DatabaseService } from "../database/database.service";
import type { ContentIngestionService } from "../sync/content-ingestion.service";
import type { AgentRunnerService } from "./agent-runner.service";

class RunnerStub {
  lastPrompt = "";

  async run(prompt: string): Promise<string> {
    this.lastPrompt = prompt;
    return "# generated";
  }
}

describe("GenerationService retrospective prompt", () => {
  function createDb(): Database.Database {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE content_items (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT,
        occurred_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(source_id, external_id)
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tone TEXT,
        format TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE session_sources (
        session_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(session_id, source_id)
      );
      CREATE TABLE blog_posts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        status TEXT NOT NULL DEFAULT 'draft'
      );
      CREATE TABLE blog_post_revisions (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    return db;
  }

  it("builds timeline/theme/evidence structured prompt with citations", async () => {
    const db = createDb();
    const runner = new RunnerStub();
    const ingestion = {
      ingestSource: async () => 0
    };
    const service = new GenerationService(
      { connection: db } as unknown as DatabaseService,
      ingestion as unknown as ContentIngestionService,
      runner as unknown as AgentRunnerService
    );

    const now = new Date().toISOString();
    db.prepare("INSERT INTO sessions (id, title, tone, format, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "s1",
      "Retrospective",
      "차분한",
      "회고",
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "repo1",
      "velogen-api",
      "repo",
      JSON.stringify({ repoUrl: "https://github.com/acme/velogen" }),
      now,
      now
    );
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s1", "repo1", now);
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c1",
      "repo1",
      "abc123",
      "commit",
      "feat: add markdown editor",
      "Implemented split mode editing and preview for draft workflow",
      "Alice <a@example.com>",
      "2026-01-03T12:00:00.000Z",
      JSON.stringify({ hash: "abc123", repoUrl: "https://github.com/acme/velogen" }),
      now
    );

    await service.generateFromSession("s1", "claude", "회고형", "마크다운");

    expect(runner.lastPrompt).toContain("[TIMELINE INPUT]");
    expect(runner.lastPrompt).toContain("[THEME INPUT]");
    expect(runner.lastPrompt).toContain("[EVIDENCE INPUT]");
    expect(runner.lastPrompt).toContain("C1");
    expect(runner.lastPrompt).toContain("https://github.com/acme/velogen/commit/abc123");
  });

  it("switches to compact prompt when prompt size exceeds budget", async () => {
    const previous = process.env.PROMPT_MAX_CHARS;
    process.env.PROMPT_MAX_CHARS = "400";

    try {
      const db = createDb();
      const runner = new RunnerStub();
      const ingestion = {
        ingestSource: async () => 0
      };
      const service = new GenerationService(
        { connection: db } as unknown as DatabaseService,
        ingestion as unknown as ContentIngestionService,
        runner as unknown as AgentRunnerService
      );

      const now = new Date().toISOString();
      db.prepare("INSERT INTO sessions (id, title, tone, format, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        "s2",
        "Long Retrospective",
        "차분한",
        "회고",
        now,
        now
      );
      db.prepare(
        "INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
      ).run("repo2", "velogen-web", "repo", JSON.stringify({ repoUrl: "https://github.com/acme/velogen" }), now, now);
      db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s2", "repo2", now);
      db.prepare(
        "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "c2",
        "repo2",
        "xyz999",
        "commit",
        "refactor: huge update",
        "x".repeat(2000),
        "Bob <b@example.com>",
        "2026-01-10T12:00:00.000Z",
        JSON.stringify({ hash: "xyz999", repoUrl: "https://github.com/acme/velogen" }),
        now
      );

      await service.generateFromSession("s2", "claude", "회고형", "마크다운");

      expect(runner.lastPrompt).toContain("[COMPACT EVIDENCE INPUT]");
    } finally {
      if (previous === undefined) {
        delete process.env.PROMPT_MAX_CHARS;
      } else {
        process.env.PROMPT_MAX_CHARS = previous;
      }
    }
  });
});
