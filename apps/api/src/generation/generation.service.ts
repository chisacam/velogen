import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AgentProvider,
  BlogPostResult,
  GenerationClarificationResponse,
  GenerationMeta,
  GenerateBlogResponse,
  GenerationMissingField,
  GenerationClarificationContext,
  GenerationClarificationQuestion,
  GenerationClarificationAnswer
} from "@velogen/shared";
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

interface ClarificationQuestionCandidate {
  id: string;
  question: string;
  rationale: string;
}

@Injectable()
export class GenerationService {
  private static readonly promptGuidanceFiles = [
    "AGENTS.md",
    "rules/blog-input-analysis.md",
    "rules/blog.md",
    "rules/blog-prompt.md",
    "review-guide/blog.md"
  ];
  private static readonly defaultClarificationMaxTurns = 3;
  private static readonly minItemsForSufficientData = 4;

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
    refinePostBody?: string,
    refinePostId?: string,
    generateImage?: boolean,
    skipPreflight?: boolean,
    clarificationContext?: GenerationClarificationContext
  ): Promise<GenerateBlogResponse> {
    const prepared = await this.prepareGenerationContext(
      sessionId,
      tone,
      format,
      userInstruction,
      refinePostBody,
      skipPreflight,
      clarificationContext
    );
    if (prepared.requiresClarification) {
      return prepared.requiresClarification;
    }
    const generatedBody =
      provider === "mock"
        ? this.mockGenerate(prepared.prompt, prepared.items)
        : await this.agentRunnerService.run(prepared.prompt, provider);

    const meta: GenerationMeta = {
      provider,
      tone: prepared.resolvedTone,
      format: prepared.resolvedFormat,
      userInstruction: userInstruction || undefined,
      refinePostId: refinePostId || undefined,
      generateImage,
      sources: prepared.sources
    };

    return this.persistGeneratedPost(sessionId, prepared.session.title, provider, generatedBody, meta);
  }

  async generateFromSessionStream(
    sessionId: string,
    provider: AgentProvider,
    tone: string | undefined,
    format: string | undefined,
    onChunk: (chunk: string) => void,
    userInstruction?: string,
    refinePostBody?: string,
    refinePostId?: string,
    generateImage?: boolean,
    skipPreflight?: boolean,
    clarificationContext?: GenerationClarificationContext
  ): Promise<GenerateBlogResponse> {
    const prepared = await this.prepareGenerationContext(
      sessionId,
      tone,
      format,
      userInstruction,
      refinePostBody,
      skipPreflight,
      clarificationContext
    );
    if (prepared.requiresClarification) {
      return prepared.requiresClarification;
    }
    const generatedBody =
      provider === "mock"
        ? this.mockGenerate(prepared.prompt, prepared.items)
        : await this.agentRunnerService.runStream(prepared.prompt, provider, onChunk);

    if (provider === "mock") {
      for (const line of generatedBody.split("\n")) {
        onChunk(`${line}\n`);
      }
    }

    const meta: GenerationMeta = {
      provider,
      tone: prepared.resolvedTone,
      format: prepared.resolvedFormat,
      userInstruction: userInstruction || undefined,
      refinePostId: refinePostId || undefined,
      generateImage,
      sources: prepared.sources
    };

    return this.persistGeneratedPost(sessionId, prepared.session.title, provider, generatedBody, meta);
  }

  private async prepareGenerationContext(
    sessionId: string,
    tone?: string,
    format?: string,
    userInstruction?: string,
    refinePostBody?: string,
    skipPreflight?: boolean,
    clarificationContext?: GenerationClarificationContext
  ): Promise<{
    session: SessionInfo;
    items: ContentItemRow[];
    prompt: string;
    sources: Array<{ sourceId: string; name: string; type: string }>;
    resolvedTone: string;
    resolvedFormat: string;
    requiresClarification?: GenerationClarificationResponse;
  }> {
    const normalizedContext = this.normalizeClarificationContext(clarificationContext);

    const session = this.databaseService.connection
      .prepare("SELECT id, title, tone, format FROM sessions WHERE id = ?")
      .get(sessionId) as SessionInfo | undefined;
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const normalizedTone = tone?.trim();
    const normalizedFormat = format?.trim();
    const hasTone = Boolean(normalizedTone && normalizedTone.length > 0);
    const hasFormat = Boolean(normalizedFormat && normalizedFormat.length > 0);

    const requestedTone = normalizedTone ?? session.tone?.trim() ?? undefined;
    const requestedFormat = normalizedFormat ?? session.format?.trim() ?? undefined;
    const defaults = {
      tone: requestedTone ?? "기본 톤",
      format: requestedFormat ?? "기본 기술 블로그 형식"
    };
    const resolvedTone = requestedTone ?? defaults.tone;
    const resolvedFormat = requestedFormat ?? defaults.format;

    const missing: GenerationMissingField[] = [];
    if (!hasTone && !session.tone?.trim()) {
      missing.push({
        field: "tone",
        question: "톤/문체를 입력해주세요.",
        suggestion: defaults.tone
      });
    }
    if (!hasFormat && !session.format?.trim()) {
      missing.push({
        field: "format",
        question: "글 형식(예: 회고, 튜토리얼, 기술 분석)을 입력해주세요.",
        suggestion: defaults.format
      });
    }

    if (!skipPreflight && missing.length > 0) {
      return {
        session,
        items: [],
        sources: [],
        prompt: "",
        resolvedTone: defaults.tone,
        resolvedFormat: defaults.format,
        requiresClarification: {
          requiresClarification: true,
          message: "생성 전에 톤과 형식을 확인해야 합니다.",
          defaults,
          missing,
          context: normalizedContext
        }
      };
    }

    const sourceIds = this.databaseService.connection
      .prepare("SELECT source_id FROM session_sources WHERE session_id = ?")
      .all(sessionId) as Array<{ source_id: string }>;

    for (const source of sourceIds) {
      await this.ingestionService.ingestSource(source.source_id);
    }

    // 소스 스냅샷 (메타 저장용)
    const sourcesSnapshot = this.databaseService.connection
      .prepare(
        "SELECT s.id as sourceId, s.name, s.type FROM session_sources ss JOIN sources s ON s.id = ss.source_id WHERE ss.session_id = ?"
      )
      .all(sessionId) as Array<{ sourceId: string; name: string; type: string }>;

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

    const promptItems = this.toPromptItems(items);
    const sourceCoverageIssues = this.findDataCoverageGaps(promptItems, userInstruction, refinePostBody, normalizedContext);

    if (sourceCoverageIssues.length > 0 && normalizedContext.turn < normalizedContext.maxTurns) {
      const clarifyingQuestions = sourceCoverageIssues.map((issue) => ({
        id: issue.id,
        question: issue.question,
        rationale: issue.rationale
      }));

      return {
        session,
        items,
        prompt: "",
        resolvedTone,
        resolvedFormat,
        sources: [],
        requiresClarification: {
          requiresClarification: true,
          message: "현재 수집 데이터만으로는 글의 방향을 확정하기 어렵습니다. 추가 정보를 받아 정확도를 높입니다.",
          defaults,
          missing,
          clarifyingQuestions,
          context: {
            ...normalizedContext,
            turn: normalizedContext.turn + 1
          }
        }
      };
    }

    const shouldIncludeClarificationContext =
      normalizedContext.answers.length > 0 ||
      (sourceCoverageIssues.length > 0 && normalizedContext.turn >= normalizedContext.maxTurns);
    const prompt = this.buildPrompt(
      session.title,
      resolvedTone,
      resolvedFormat,
      items,
      userInstruction,
      refinePostBody,
      shouldIncludeClarificationContext ? normalizedContext : undefined
    );

    return {
      session,
      items,
      prompt,
      resolvedTone,
      resolvedFormat,
      sources: sourcesSnapshot
    };
  }

  private normalizeClarificationContext(clarificationContext?: GenerationClarificationContext): GenerationClarificationContext {
    const nextContext: Partial<GenerationClarificationContext> = clarificationContext ?? {};
    const maxTurns = nextContext.maxTurns !== undefined && Number.isFinite(nextContext.maxTurns)
      ? Math.max(1, Math.floor(nextContext.maxTurns))
      : GenerationService.defaultClarificationMaxTurns;
    const turn = nextContext.turn !== undefined && Number.isFinite(nextContext.turn)
      ? Math.max(0, Math.floor(nextContext.turn))
      : 0;

    return {
      turn,
      maxTurns,
      answers: this.normalizeClarificationAnswers(clarificationContext?.answers)
    };
  }

  private normalizeClarificationAnswers(answers?: GenerationClarificationAnswer[]): GenerationClarificationAnswer[] {
    if (!Array.isArray(answers)) {
      return [];
    }

    const byQuestionId = new Map<string, GenerationClarificationAnswer>();
    for (const answer of answers) {
      const questionId = answer?.questionId?.trim();
      const question = answer?.question?.trim();
      const answerText = answer?.answer?.trim();
      if (!questionId || !question || !answerText) {
        continue;
      }
      byQuestionId.set(questionId, {
        questionId,
        question,
        answer: answerText
      });
    }
    return Array.from(byQuestionId.values());
  }

  private findDataCoverageGaps(
    items: PromptItem[],
    userInstruction?: string,
    refinePostBody?: string,
    clarificationContext?: GenerationClarificationContext
  ): ClarificationQuestionCandidate[] {
    const candidates: ClarificationQuestionCandidate[] = [];

    if (items.length === 0) {
      return [
        {
          id: "insufficient-items",
          question:
            "수집된 항목이 충분하지 않습니다. 어떤 작업 흐름이나 변경 포인트를 중심으로 글을 쓰고 싶은지 3~5개 항목으로 정리해 주세요.",
          rationale: "메인 근거 데이터가 없어 대상 내용의 범위를 정할 수 없음"
        }
      ];
    }

    const answeredIds = new Set((clarificationContext?.answers ?? []).map((answer) => answer.questionId));
    const uniqueMonths = new Set(items
      .map((item) => item.monthBucket)
      .filter((monthBucket) => monthBucket !== "unknown"));
    const uniqueThemes = new Set(items.map((item) => item.theme));
    const sourceTypes = new Set(items.map((item) => item.sourceType));
    const authors = new Set(items.map((item) => item.author).filter((author) => author !== "unknown"));

    const request = `${userInstruction ?? ""}`.toLowerCase();
    const toneRef = `${refinePostBody ?? ""}`.toLowerCase();
    const isRetrospective = request.includes("회고") || request.includes("리뷰") || request.includes("postmortem");
    const isTutorial = request.includes("튜토리얼") || request.includes("안내") || request.includes("가이드");

    if (items.length < GenerationService.minItemsForSufficientData) {
      const id = "insufficient-items";
      if (!answeredIds.has(id)) {
        candidates.push({
          id,
          question:
            "현재 데이터가 적어 이야기할 근거가 제한적입니다. 글에서 꼭 다루고 싶은 변경 포인트를 2~4개 더 구체적으로 넣어 주세요.",
          rationale: "근거 항목 수가 목표 글 양식에 비해 적음"
        });
      }
    }

    if (uniqueMonths.size < 2 && items.length >= 3) {
      const id = "time-range-context";
      if (!answeredIds.has(id)) {
        candidates.push({
          id,
          question: "시간축이 짧거나 불명확합니다. 기간 구분(예: 월별/단계별) 기준으로 글의 시작~끝을 정해 주세요.",
          rationale: "시간 순서를 바탕으로 문제-시도-결과 흐름을 구성하려면 기간 컨텍스트가 필요"
        });
      }
    }

    if (uniqueThemes.size < 2 && items.length >= 4) {
      const id = "theme-focus";
      if (!answeredIds.has(id)) {
        candidates.push({
          id,
          question: "핵심 테마가 좁습니다. 글에서 다룰 대표 테마(예: 안정성, 성능, UX, 운영)을 2개 이상 제시해 주세요.",
          rationale: "테마 분류가 제한되면 Thematic Insights 섹션 구성이 부족해질 수 있음"
        });
      }
    }

    if (!answeredIds.has("audience-depth") && (isTutorial || isRetrospective)) {
      const id = "audience-depth";
      if (isTutorial || isRetrospective) {
        candidates.push({
          id,
          question:
            "독자 수준(초급/중급/실무팀)과 깊이를 선택해 주세요. 특히 '결론 메시지(주요 인사이트)'를 먼저 알려주세요.",
          rationale: "요청된 글 형태에 맞는 설명 깊이와 서술 톤을 고정하기 위해 필요"
        });
      }
    }

    if (sourceTypes.size === 1 && !answeredIds.has("source-balance")) {
      candidates.push({
        id: "source-balance",
        question: `현재는 ${sourceTypes.values().next().value} 소스가 주입니다. 운영 맥락(회의록/문서/리뷰 의견) 또는 배포 이슈 정보가 있으면 보충해 주세요.`,
        rationale: "단일 소스 데이터만으로는 의사결정 근거나 트레이드오프 설명이 부족함"
      });
    }

    if (authors.size <= 1 && items.length >= 5 && !answeredIds.has("stakeholder-impact")) {
      candidates.push({
        id: "stakeholder-impact",
        question: "이 작업에서 이해관계자/협업 대상이 있었다면 영향권(팀, 사용자, 사용자 요청)을 알려주세요.",
        rationale: "결과 및 학습 섹션의 파급효과 설명을 강화하기 위해 필요"
      });
    }

    if (toneRef.includes("refine") && !answeredIds.has("refine-focus")) {
      candidates.push({
        id: "refine-focus",
        question: "수정 모드에서 특히 중점 보완할 부분(문장 톤, 근거 보강, 누락된 위험/트레이드오프)을 2~3개로 정리해 주세요.",
        rationale: "기존 초안을 재작성할 때 수정 방향을 정확히 고정해야 일관성 유지"
      });
    }

    return candidates.slice(0, 2);
  }

  private buildClarificationBlock(clarificationContext?: GenerationClarificationContext): string | null {
    const answers = this.normalizeClarificationAnswers(clarificationContext?.answers);
    const answerLines = answers
      .map((answer) => `- ${answer.question}\n  답변: ${answer.answer}`)
      .join("\n\n");

    const fallbackNotice = clarificationContext?.turn && clarificationContext.turn >= clarificationContext.maxTurns
      ? [
        "",
        "※ 참고: 최대 질문 횟수 제한으로 추가 질문 없이 작성을 진행합니다. 위 응답은 반영에 반영되었습니다."
      ].join("\n")
      : "";

    if (answers.length === 0 && fallbackNotice.length === 0) {
      return null;
    }

    return ["[USER CLARIFICATION INPUT]", answerLines, fallbackNotice]
      .filter((line) => line.length > 0)
      .join("\n");
  }

  private persistGeneratedPost(
    sessionId: string,
    title: string,
    provider: AgentProvider,
    generatedBody: string,
    meta?: GenerationMeta
  ): BlogPostResult {
    const postId = randomUUID();
    const createdAt = new Date().toISOString();
    const status = "draft";
    const metaJson = meta ? JSON.stringify(meta) : null;

    this.databaseService.connection
      .prepare(
        "INSERT INTO blog_posts (id, session_id, title, body, provider, created_at, updated_at, status, generation_meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(postId, sessionId, title, generatedBody, provider, createdAt, createdAt, status, metaJson);

    this.databaseService.connection
      .prepare(
        "INSERT INTO blog_post_revisions (id, post_id, version, title, body, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(randomUUID(), postId, 1, title, generatedBody, status, "generated", createdAt);

    return {
      id: postId,
      title,
      body: generatedBody,
      provider,
      status,
      createdAt,
      updatedAt: createdAt,
      generationMeta: meta
    };
  }

  private buildPrompt(
    title: string,
    tone: string,
    format: string,
    items: ContentItemRow[],
    userInstruction?: string,
    refinePostBody?: string,
    clarificationContext?: GenerationClarificationContext
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

    const clarificationBlock = this.buildClarificationBlock(clarificationContext);

    const basePrompt = [
      ...this.loadPromptGuidanceBlocks(),
    ];

    const fullContent = [
      ...(refinePreamble ? [refinePreamble] : []),
      ...(instructionBlock ? [instructionBlock] : []),
      ...(clarificationBlock ? [clarificationBlock] : []),
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

  private loadPromptGuidanceBlocks(): string[] {
    return [
      "아래 경로에 위치한 룰을 먼저 숙지하고, 그에 따라 글을 생성하세요.",
      "[OPERATING GUIDELINES (path only)]",
      ...GenerationService.promptGuidanceFiles.map((filePath) => `- ${filePath}`),
      ""
    ];
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
