import { Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type { AgentProvider, BlogPostResult } from "@velogen/shared";
import { DatabaseService } from "../database/database.service";
import { AgentRunnerService } from "./agent-runner.service";
import { ContentIngestionService } from "../sync/content-ingestion.service";

interface SessionInfo {
  id: string;
  title: string;
  tone: string | null;
  format: string | null;
}

interface ContentItemRow {
  source_name: string;
  source_type: "repo" | "notion";
  kind: "commit" | "notion";
  title: string;
  body: string;
  author: string | null;
  occurred_at: string | null;
  metadata_json: string | null;
}

interface PromptItem {
  citationId: string;
  sourceName: string;
  sourceType: "repo" | "notion";
  kind: "commit" | "notion";
  title: string;
  body: string;
  author: string;
  occurredAt: string;
  monthBucket: string;
  theme: string;
  evidence: string;
}

@Injectable()
export class GenerationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ingestionService: ContentIngestionService,
    private readonly agentRunnerService: AgentRunnerService
  ) { }

  async generateFromSession(
    sessionId: string,
    provider: AgentProvider,
    tone?: string,
    format?: string,
    userInstruction?: string,
    refinePostBody?: string
  ): Promise<BlogPostResult> {
    const prepared = await this.prepareGenerationContext(sessionId, tone, format, userInstruction, refinePostBody);
    const generatedBody =
      provider === "mock"
        ? this.mockGenerate(prepared.prompt, prepared.items)
        : await this.agentRunnerService.run(prepared.prompt, provider);

    return this.persistGeneratedPost(sessionId, prepared.session.title, provider, generatedBody);
  }

  async generateFromSessionStream(
    sessionId: string,
    provider: AgentProvider,
    tone: string | undefined,
    format: string | undefined,
    onChunk: (chunk: string) => void,
    userInstruction?: string,
    refinePostBody?: string
  ): Promise<BlogPostResult> {
    const prepared = await this.prepareGenerationContext(sessionId, tone, format, userInstruction, refinePostBody);
    const generatedBody =
      provider === "mock"
        ? this.mockGenerate(prepared.prompt, prepared.items)
        : await this.agentRunnerService.runStream(prepared.prompt, provider, onChunk);

    if (provider === "mock") {
      for (const line of generatedBody.split("\n")) {
        onChunk(`${line}\n`);
      }
    }

    return this.persistGeneratedPost(sessionId, prepared.session.title, provider, generatedBody);
  }

  private async prepareGenerationContext(
    sessionId: string,
    tone?: string,
    format?: string,
    userInstruction?: string,
    refinePostBody?: string
  ): Promise<{
    session: SessionInfo;
    items: ContentItemRow[];
    prompt: string;
  }> {
    const session = this.databaseService.connection
      .prepare("SELECT id, title, tone, format FROM sessions WHERE id = ?")
      .get(sessionId) as SessionInfo | undefined;
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const sourceIds = this.databaseService.connection
      .prepare("SELECT source_id FROM session_sources WHERE session_id = ?")
      .all(sessionId) as Array<{ source_id: string }>;

    for (const source of sourceIds) {
      await this.ingestionService.ingestSource(source.source_id);
    }

    const items = this.databaseService.connection
      .prepare(
        `SELECT s.name as source_name, s.type as source_type, c.kind, c.title, c.body, c.author, c.occurred_at, c.metadata_json
         FROM content_items c
         JOIN sources s ON s.id = c.source_id
         JOIN session_sources ss ON ss.source_id = s.id
         WHERE ss.session_id = ?
         ORDER BY c.occurred_at ASC, c.created_at ASC`
      )
      .all(sessionId) as ContentItemRow[];

    const requestedTone = tone ?? session.tone ?? "기본 톤";
    const requestedFormat = format ?? session.format ?? "기본 기술 블로그 형식";
    const prompt = this.buildPrompt(session.title, requestedTone, requestedFormat, items, userInstruction, refinePostBody);

    return { session, items, prompt };
  }

  private persistGeneratedPost(
    sessionId: string,
    title: string,
    provider: AgentProvider,
    generatedBody: string
  ): BlogPostResult {
    const postId = uuidv4();
    const createdAt = new Date().toISOString();
    const status = "draft";

    this.databaseService.connection
      .prepare(
        "INSERT INTO blog_posts (id, session_id, title, body, provider, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(postId, sessionId, title, generatedBody, provider, createdAt, createdAt, status);

    this.databaseService.connection
      .prepare(
        "INSERT INTO blog_post_revisions (id, post_id, version, title, body, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(uuidv4(), postId, 1, title, generatedBody, status, "generated", createdAt);

    return {
      id: postId,
      title,
      body: generatedBody,
      provider,
      status,
      createdAt,
      updatedAt: createdAt
    };
  }

  private buildPrompt(
    title: string,
    tone: string,
    format: string,
    items: ContentItemRow[],
    userInstruction?: string,
    refinePostBody?: string
  ): string {
    const normalizedItems = this.toPromptItems(items);
    const timeline = this.buildTimelineSection(normalizedItems);
    const themeGroups = this.buildThemeSection(normalizedItems);
    const evidence = this.buildEvidenceSection(normalizedItems);

    // 수정(refine) 모드: 기존 글 본문이 있으면 앞에 붙임
    const refinePreamble = refinePostBody
      ? [
        "[EXISTING DRAFT — REFINE MODE]",
        "아래는 이미 작성된 블로그 초안입니다.",
        "이 초안을 기반으로 개선 및 수정 작업을 수행하세요.",
        "초안에 없는 내용을 임의로 추가하지 말고, 아래 소스 데이터와 사용자 지시사항을 반영하여 다듬어 주세요.",
        "",
        refinePostBody,
        ""
      ].join("\n")
      : null;

    // 사용자 추가 지시사항
    const instructionBlock = userInstruction?.trim()
      ? ["[USER INSTRUCTION]", userInstruction.trim(), ""].join("\n")
      : null;

    const basePrompt = [
      `블로그 제목: ${title}`,
      `톤/문체 요청: ${tone}`,
      `형식 요청: ${format}`,
      refinePostBody
        ? "목표: 제공된 엔지니어링 회고형 테크 블로그 초안을 소스 데이터와 사용자 지시사항을 반영하여 개선합니다."
        : "목표: 엔지니어링 회고형 테크 블로그를 작성합니다.",
      "규칙: 반드시 입력된 소스를 기반으로 글을 작성하고, 소스에 없는 내용을 추가하지 않습니다.",
      "제목은 반드시 주어진 제목만 사용할 필요는 없고, 내용에 어울리는 제목으로 수정되어도 괜찮습니다.",
      "각 섹션은 내용에 어울리는 부제를 붙이고, 블로그 글 이므로 지나친 요약대신 독자가 이탈하지 않고 읽을 수 있도록 내용 전개가 필요합니다.",
      "[WRITING GUIDELINES]",
      "- chronology를 유지하되, 독자가 이해하기 쉽게 문제-시도-결과-학습 흐름으로 재구성합니다.",
      "- commit/notion 원문을 복붙하지 말고 의미를 통합 요약합니다.",
      "- 마지막에 후속 액션 아이템을 실행 가능한 checklist로 작성합니다.",
      "- 출력 형식은 아래 순서와 내용을 따르고, 반드시 Markdown 문법을 따라야 합니다.",
      "1) Executive Summary",
      "2) Timeline Review",
      "3) Thematic Insights",
      "4) Decisions & Trade-offs",
      "5) Next Iteration Plan",
      "",
    ];

    const fullContent = [
      ...(refinePreamble ? [refinePreamble] : []),
      ...(instructionBlock ? [instructionBlock] : []),
      ...basePrompt,
      "[TIMELINE INPUT]",
      timeline,
      "[THEME INPUT]",
      themeGroups,
      "[EVIDENCE INPUT]",
      evidence,
    ].join("\n\n");

    const maxPromptChars = Number.parseInt(process.env.PROMPT_MAX_CHARS ?? "32000", 10);
    if (fullContent.length <= maxPromptChars) {
      return fullContent;
    }

    // 압축 모드 (너무 길 때)
    const compactItems = normalizedItems.map((item) => ({
      ...item,
      body: item.body.slice(0, 240)
    }));

    const compactContent = [
      ...(refinePreamble ? [refinePreamble] : []),
      ...(instructionBlock ? [instructionBlock] : []),
      ...basePrompt,
      "[COMPACT EVIDENCE INPUT]",
      "입력 데이터가 길어 압축 모드로 전환되었습니다.",
      "입력 데이터가 다소 압축된 점을 감안하여 핵심 내용을 놓치지 않도록 주의하세요.",
      ...compactItems.map(
        (item) =>
          `${item.citationId} | ${item.monthBucket} | ${item.theme} | ${item.sourceName}/${item.sourceType}/${item.kind} | ${item.title}\n${item.body}`
      )
    ].join("\n\n");

    return compactContent;
  }

  private toPromptItems(items: ContentItemRow[]): PromptItem[] {
    return items.map((item, index) => {
      const citationId = `C${index + 1}`;
      const body = item.body.trim().length > 0 ? item.body.trim() : "(본문 없음)";
      const occurredAt = item.occurred_at ?? "unknown";
      const monthBucket = this.toMonthBucket(item.occurred_at);
      const metadata = this.safeParseMetadata(item.metadata_json);
      const evidence = this.resolveEvidence(item, metadata);
      return {
        citationId,
        sourceName: item.source_name,
        sourceType: item.source_type,
        kind: item.kind,
        title: item.title,
        body,
        author: item.author ?? "unknown",
        occurredAt,
        monthBucket,
        theme: this.detectTheme(item.title, body, item.kind),
        evidence
      };
    });
  }

  private buildTimelineSection(items: PromptItem[]): string {
    return items
      .map(
        (item) =>
          `${item.citationId} | ${item.monthBucket} | ${item.occurredAt} | ${item.sourceName}/${item.sourceType}/${item.kind}\n${item.title}\n${item.body}`
      )
      .join("\n\n");
  }

  private buildThemeSection(items: PromptItem[]): string {
    const grouped = new Map<string, PromptItem[]>();
    for (const item of items) {
      const list = grouped.get(item.theme) ?? [];
      list.push(item);
      grouped.set(item.theme, list);
    }

    return Array.from(grouped.entries())
      .map(([theme, list]) => {
        const lines = list.map((item) => `${item.citationId} ${item.title}`).join("\n");
        return `### ${theme}\n${lines}`;
      })
      .join("\n\n");
  }

  private buildEvidenceSection(items: PromptItem[]): string {
    return items
      .map(
        (item) =>
          `${item.citationId}: source=${item.sourceName}/${item.sourceType}/${item.kind}; author=${item.author}; occurred_at=${item.occurredAt}; evidence=${item.evidence}`
      )
      .join("\n");
  }

  private toMonthBucket(occurredAt: string | null): string {
    if (!occurredAt) {
      return "unknown";
    }
    const date = new Date(occurredAt);
    if (Number.isNaN(date.valueOf())) {
      return "unknown";
    }
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private detectTheme(title: string, body: string, kind: "commit" | "notion"): string {
    const text = `${title} ${body}`.toLowerCase();
    if (text.includes("fix") || text.includes("bug") || text.includes("hotfix")) {
      return "Stability & Fixes";
    }
    if (text.includes("test") || text.includes("spec") || text.includes("qa")) {
      return "Quality & Testing";
    }
    if (text.includes("refactor") || text.includes("cleanup") || text.includes("simplify")) {
      return "Refactoring";
    }
    if (text.includes("deploy") || text.includes("infra") || text.includes("pipeline") || text.includes("ci")) {
      return "Infra & Delivery";
    }
    if (text.includes("docs") || text.includes("notion") || kind === "notion") {
      return "Knowledge & Documentation";
    }
    if (text.includes("feat") || text.includes("feature") || text.includes("add")) {
      return "Feature Development";
    }
    return "General Engineering";
  }

  private safeParseMetadata(value: string | null): Record<string, unknown> {
    if (!value) {
      return {};
    }
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private resolveEvidence(item: ContentItemRow, metadata: Record<string, unknown>): string {
    const hash = typeof metadata.hash === "string" ? metadata.hash : "";
    const repoUrl = typeof metadata.repoUrl === "string" ? metadata.repoUrl : "";
    if (item.kind === "commit" && hash && repoUrl) {
      return `${repoUrl.replace(/\.git$/, "")}/commit/${hash}`;
    }
    if (item.kind === "commit" && hash) {
      return hash;
    }
    const pageId = typeof metadata.pageId === "string" ? metadata.pageId : "";
    if (pageId) {
      return `notion:${pageId}`;
    }
    return "n/a";
  }

  private mockGenerate(prompt: string, items: ContentItemRow[]): string {
    const outline = items
      .map((item, index) => `- [${index + 1}] ${item.title} (${item.source_type}/${item.kind})`)
      .join("\n");
    return [
      "# 작업 히스토리 기반 블로그",
      "",
      "## 개요",
      "수집된 커밋/노션 데이터를 바탕으로 작업 흐름을 정리했습니다.",
      `총 ${items.length}개의 콘텐츠를 반영했습니다.`,
      "",
      "## 핵심 변경점",
      outline || "- 수집된 항목이 없습니다.",
      "",
      "## 참고 프롬프트",
      "```text",
      prompt.slice(0, 2000),
      "```"
    ].join("\n");
  }
}
