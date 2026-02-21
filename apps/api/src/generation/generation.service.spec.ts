import Database from "better-sqlite3";
import { GenerationService } from "./generation.service";
import type { DatabaseService } from "../database/database.service";
import type { ContentIngestionService } from "../sync/content-ingestion.service";
import type { AgentRunnerService } from "./agent-runner.service";

class RunnerStub {
  lastPrompt = "";
  prompts: string[] = [];
  private readonly queuedOutputs: string[] = [];

  enqueueOutput(output: string): void {
    this.queuedOutputs.push(output);
  }

  async run(prompt: string): Promise<string> {
    this.lastPrompt = prompt;
    this.prompts.push(prompt);
    return this.queuedOutputs.shift() ?? "# generated";
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
        status TEXT NOT NULL DEFAULT 'draft',
        generation_meta_json TEXT
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
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "notion1",
      "release-notes",
      "notion",
      JSON.stringify({ pageId: "1111-2222-3333" }),
      now,
      now
    );
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s1", "repo1", now);
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s1", "notion1", now);
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
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c2",
      "repo1",
      "abc124",
      "commit",
      "fix: tighten error handling",
      "Improved retry policy and guard rails for flaky operations.",
      "Bob <b@example.com>",
      "2026-01-12T10:00:00.000Z",
      JSON.stringify({ hash: "abc124", repoUrl: "https://github.com/acme/velogen" }),
      now
    );
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "n1",
      "notion1",
      "n-1",
      "notion",
      "release notes",
      "Added launch checklist and review comments summary.",
      "Team",
      "2026-02-01T14:00:00.000Z",
      JSON.stringify({ pageId: "page-1" }),
      now
    );
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "n2",
      "notion1",
      "n-2",
      "notion",
      "test: release verification",
      "Regression checks for migration and rollout tasks.",
      "Team",
      "2026-02-03T14:00:00.000Z",
      JSON.stringify({ pageId: "page-2" }),
      now
    );

    await service.generateFromSession("s1", "claude", "회고형", "마크다운");

    expect(runner.lastPrompt).toContain("[KEY EVENTS INPUT]");
    expect(runner.lastPrompt).toContain("[THEME INPUT]");
    expect(runner.lastPrompt).toContain("[EVIDENCE INPUT]");
    expect(runner.lastPrompt).toContain("C1");
    expect(runner.lastPrompt).toContain("https://github.com/acme/velogen/commit/abc123");
    expect(runner.lastPrompt).toContain("[OPERATING GUIDELINES (path only)]");
    expect(runner.lastPrompt).toContain("- rules/blog-prompt.md");
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
      db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
        "notion2",
        "release-notes",
        "notion",
        JSON.stringify({ pageId: "1111-2222-3333" }),
        now,
        now
      );
      db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s2", "repo2", now);
      db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s2", "notion2", now);
      db.prepare(
        "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "c2a",
        "repo2",
        "xyz999",
        "commit",
        "refactor: huge update",
        `feat: huge update ${"x".repeat(2000)}`,
        "Bob <b@example.com>",
        "2026-01-10T12:00:00.000Z",
        JSON.stringify({ hash: "xyz999", repoUrl: "https://github.com/acme/velogen" }),
        now
      );
      db.prepare(
        "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "c2b",
        "repo2",
        "xyz998",
        "commit",
        "fix: CI pipeline hardening",
        `fix: CI pipeline hardening ${"x".repeat(1200)}`,
        "Bob <b@example.com>",
        "2026-01-16T08:30:00.000Z",
        JSON.stringify({ hash: "xyz998", repoUrl: "https://github.com/acme/velogen" }),
        now
      );
      db.prepare(
        "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "n2a",
        "notion2",
        "n2-1",
        "notion",
        "test: rollout checklist",
        "Added release regression checklist and QA notes.",
        "Team",
        "2026-02-02T10:00:00.000Z",
        JSON.stringify({ pageId: "page-a" }),
        now
      );
      db.prepare(
        "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "n2b",
        "notion2",
        "n2-2",
        "notion",
        "deploy: release notes",
        "Deployed feature gates and rollback plan details.",
        "Team",
        "2026-02-08T15:00:00.000Z",
        JSON.stringify({ pageId: "page-b" }),
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

  it("returns agent-led clarification when tone and format are missing", async () => {
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
      "s3",
      "Clarification Session",
      null,
      null,
      now,
      now
    );

    const result = await service.generateFromSession("s3", "mock");

    expect((result as { requiresClarification: boolean }).requiresClarification).toBe(true);
    expect((result as { clarifyingQuestions?: Array<{ id: string }> }).clarifyingQuestions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "agent-q-1-1" })])
    );
    expect((result as { missing: Array<{ field: string }> }).missing).toHaveLength(0);
    expect((result as { defaults: { tone: string; format: string } }).defaults.tone).toBe("기본 톤");
    expect((result as { defaults: { tone: string; format: string } }).defaults.format).toBe("기본 기술 블로그 형식");
  });

  it("skips clarification when skipPreflight is true", async () => {
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
      "s4",
      "Clarification Skip",
      null,
      null,
      now,
      now
    );

    const result = await service.generateFromSession(
      "s4",
      "mock",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      {
        turn: 3,
        maxTurns: 3,
        answers: []
      }
    );

    expect((result as { requiresClarification: boolean }).requiresClarification).toBeUndefined();
    expect((result as { generationMeta?: { tone?: string; format?: string } }).generationMeta?.tone).toBe("기본 톤");
    expect((result as { generationMeta?: { tone?: string; format?: string } }).generationMeta?.format).toBe("기본 기술 블로그 형식");
  });

  it("returns data-coverage clarifying questions when context is insufficient", async () => {
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
      "s5",
      "Coverage",
      "회고형",
      "기술 블로그",
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "repo1",
      "velogen-repo",
      "repo",
      JSON.stringify({ repoUrl: "https://github.com/acme/velogen" }),
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "notion1",
      "release-notes",
      "notion",
      JSON.stringify({ pageId: "0000-0000-0000" }),
      now,
      now
    );
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s5", "repo1", now);
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s5", "notion1", now);
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c5a",
      "repo1",
      "abc123",
      "commit",
      "chore: refine docs",
      "Refined deployment notes and review workflow.",
      "Alice",
      "2026-01-01T12:00:00.000Z",
      JSON.stringify({ hash: "abc123", repoUrl: "https://github.com/acme/velogen" }),
      now
    );
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c5b",
      "repo1",
      "abc125",
      "commit",
      "chore: update docs",
      "Added release documentation for deployment playbook.",
      "Chris",
      "2026-01-11T11:00:00.000Z",
      JSON.stringify({ hash: "abc125", repoUrl: "https://github.com/acme/velogen" }),
      now
    );

    const result = await service.generateFromSession("s5", "mock");

    expect((result as { requiresClarification: boolean }).requiresClarification).toBe(true);
    expect((result as { clarifyingQuestions?: Array<{ id: string }> }).clarifyingQuestions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "agent-q-1-1" })])
    );
    expect((result as { missing: Array<{ field: string }> }).missing).toHaveLength(0);
  });

  it("uses provider response to ask conversational clarification questions", async () => {
    const db = createDb();
    const runner = new RunnerStub();
    runner.enqueueOutput(JSON.stringify({
      requiresClarification: true,
      message: "초안을 만들기 전에 방향을 조금만 더 정하고 싶습니다.",
      questions: [
        {
          question: "이번 글에서 독자가 가장 먼저 이해해야 하는 한 가지를 알려주세요.",
          rationale: "핵심 메시지를 먼저 고정하면 글 구조가 안정됩니다."
        }
      ]
    }));
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
      "s8",
      "Agent Clarification",
      "회고형",
      "기술 블로그",
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "repo8",
      "velogen-repo",
      "repo",
      JSON.stringify({ repoUrl: "https://github.com/acme/velogen" }),
      now,
      now
    );
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s8", "repo8", now);
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c8a",
      "repo8",
      "aaa100",
      "commit",
      "feat: add workspace timeline",
      "Implemented timeline summary for generated drafts.",
      "Alice",
      "2026-01-01T08:00:00.000Z",
      JSON.stringify({ hash: "aaa100", repoUrl: "https://github.com/acme/velogen" }),
      now
    );

    const result = await service.generateFromSession("s8", "claude", "회고형", "마크다운");

    expect((result as { requiresClarification: boolean }).requiresClarification).toBe(true);
    expect((result as { message: string }).message).toContain("방향");
    expect((result as { clarifyingQuestions?: Array<{ id: string; question: string }> }).clarifyingQuestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "agent-q-1-1",
          question: "이번 글에서 독자가 가장 먼저 이해해야 하는 한 가지를 알려주세요."
        })
      ])
    );
    expect(runner.prompts[0]).toContain("[ALREADY ANSWERED]");
  });

  it("filters already answered clarification questions and proceeds with generation", async () => {
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
      "s6",
      "Coverage Retry",
      "회고형",
      "기술 블로그",
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "repo2",
      "velogen-repo",
      "repo",
      JSON.stringify({ repoUrl: "https://github.com/acme/velogen" }),
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "notion2",
      "release-notes",
      "notion",
      JSON.stringify({ pageId: "1111-2222-3333" }),
      now,
      now
    );
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s6", "repo2", now);
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s6", "notion2", now);
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c6a",
      "repo2",
      "abc124",
      "commit",
      "chore: optimize logging",
      "Added request tracing and error aggregation for observability.",
      "Alice",
      "2026-01-04T09:00:00.000Z",
      JSON.stringify({ hash: "abc124", repoUrl: "https://github.com/acme/velogen" }),
      now
    );
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c6b",
      "notion2",
      "n-2",
      "notion",
      "retrospective notes",
      "Added checklists and release risk notes for the rollout.",
      "Bob",
      "2026-01-08T10:00:00.000Z",
      JSON.stringify({ pageId: "page-2" }),
      now
    );

    const result = await service.generateFromSession("s6", "claude", undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
      turn: 3,
      maxTurns: 3,
      answers: [
        {
          questionId: "insufficient-items",
          question: "현재 데이터가 적어 ...",
          answer: "아키텍처 변경과 배포 이슈 중심으로 다뤄주세요"
        }
      ]
    });

    expect((result as { requiresClarification: boolean }).requiresClarification).toBeUndefined();
    expect(runner.lastPrompt).toContain("[USER CLARIFICATION INPUT]");
    expect(runner.lastPrompt).toContain("아키텍처 변경과 배포 이슈 중심으로 다뤄주세요");
  });

  it("forces generation at max clarification turn with fallback notice in prompt", async () => {
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
      "s7",
      "Coverage Max Turn",
      "회고형",
      "기술 블로그",
      now,
      now
    );
    db.prepare("INSERT INTO sources (id, name, type, config_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(
      "repo3",
      "velogen-repo",
      "repo",
      JSON.stringify({ repoUrl: "https://github.com/acme/velogen" }),
      now,
      now
    );
    db.prepare("INSERT INTO session_sources (session_id, source_id, created_at) VALUES (?, ?, ?)").run("s7", "repo3", now);
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c7a",
      "repo3",
      "aaa111",
      "commit",
      "feat: add observability",
      "Improved logging details for production incidents.",
      "Alice",
      "2026-01-02T11:00:00.000Z",
      JSON.stringify({ hash: "aaa111", repoUrl: "https://github.com/acme/velogen" }),
      now
    );
    db.prepare(
      "INSERT INTO content_items (id, source_id, external_id, kind, title, body, author, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      "c7b",
      "repo3",
      "aaa112",
      "commit",
      "fix: reduce downtime",
      "Stabilized rollout checks and alerting flow.",
      "Bob",
      "2026-01-06T16:00:00.000Z",
      JSON.stringify({ hash: "aaa112", repoUrl: "https://github.com/acme/velogen" }),
      now
    );

    const result = await service.generateFromSession("s7", "claude", undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
      turn: 3,
      maxTurns: 3,
      answers: []
    });

    expect((result as { requiresClarification: boolean }).requiresClarification).toBeUndefined();
    expect(runner.lastPrompt).toContain("최대 질문 횟수 제한으로 추가 질문 없이 작성을 진행합니다");
  });
});
