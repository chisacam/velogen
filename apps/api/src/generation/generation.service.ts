import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  AgentProvider,
  BlogPostResult,
  BlogReviewResult,
  GenerateBlogResponse,
  GenerationClarificationAnswer,
  GenerationClarificationContext,
  GenerationClarificationQuestion,
  GenerationClarificationResponse,
  GenerationMeta,
  GenerationMissingField
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

interface AgentClarificationDecision {
  message: string;
  questions: GenerationClarificationQuestion[];
}

@Injectable()
export class GenerationService {
  private static readonly promptGuidanceFiles = [
    "rules/security.md",
    "AGENTS.md",
    "rules/blog-clarification.md",
    "rules/blog.md",
    "rules/blog-prompt.md",
    "review-guide/blog.md"
  ];
  private static readonly defaultClarificationMaxTurns = 3;

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
      provider,
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

    if (refinePostId) {
      return {
        id: `refine-${randomUUID()}`,
        title: prepared.session.title,
        body: generatedBody,
        provider,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generationMeta: meta
      };
    }

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
      provider,
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

    if (refinePostId) {
      return {
        id: `refine-${randomUUID()}`,
        title: prepared.session.title,
        body: generatedBody,
        provider,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generationMeta: meta
      };
    }

    return this.persistGeneratedPost(sessionId, prepared.session.title, provider, generatedBody, meta);
  }

  private async prepareGenerationContext(
    sessionId: string,
    provider: AgentProvider,
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

    const requestedTone = tone?.trim() || session.tone?.trim() || undefined;
    const requestedFormat = format?.trim() || session.format?.trim() || undefined;
    const defaults = {
      tone: requestedTone ?? "기본 톤",
      format: requestedFormat ?? "기본 기술 블로그 형식"
    };
    const resolvedTone = requestedTone ?? defaults.tone;
    const resolvedFormat = requestedFormat ?? defaults.format;
    const missing: GenerationMissingField[] = [];

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
    const agentClarification = normalizedContext.turn < normalizedContext.maxTurns
      ? await this.requestAgentClarification(
        provider,
        session.title,
        resolvedTone,
        resolvedFormat,
        promptItems,
        userInstruction,
        refinePostBody,
        normalizedContext,
        skipPreflight
      )
      : undefined;

    if (agentClarification) {
      const clarifyingQuestions = agentClarification.questions;

      return {
        session,
        items,
        prompt: "",
        resolvedTone,
        resolvedFormat,
        sources: [],
        requiresClarification: {
          requiresClarification: true,
          message: agentClarification.message,
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
      normalizedContext.answers.length > 0 || normalizedContext.turn >= normalizedContext.maxTurns;
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

  private async requestAgentClarification(
    provider: AgentProvider,
    title: string,
    tone: string,
    format: string,
    items: PromptItem[],
    userInstruction: string | undefined,
    refinePostBody: string | undefined,
    clarificationContext: GenerationClarificationContext,
    skipPreflight?: boolean
  ): Promise<AgentClarificationDecision | undefined> {
    if (skipPreflight) {
      return undefined;
    }

    if (provider === "mock") {
      return this.buildMockClarificationDecision(items, userInstruction, clarificationContext);
    }

    const decisionPrompt = this.buildClarificationDecisionPrompt(
      title,
      tone,
      format,
      items,
      userInstruction,
      refinePostBody,
      clarificationContext
    );
    const responseText = await this.agentRunnerService.run(decisionPrompt, provider);
    return this.parseClarificationDecision(responseText, clarificationContext.turn + 1);
  }

  private buildMockClarificationDecision(
    items: PromptItem[],
    userInstruction: string | undefined,
    clarificationContext: GenerationClarificationContext
  ): AgentClarificationDecision | undefined {
    if (clarificationContext.answers.length > 0) {
      return undefined;
    }

    if (userInstruction?.trim().length) {
      return undefined;
    }

    if (items.length >= 3) {
      return {
        message: "생성을 시작하기 전에, 에이전트가 글의 핵심 메시지를 먼저 확인하고 싶습니다.",
        questions: [
          {
            id: `agent-q-${clarificationContext.turn + 1}-1`,
            question: "이번 글에서 독자가 반드시 가져가야 할 핵심 메시지를 2~3문장으로 알려주세요.",
            rationale: "핵심 메시지를 먼저 고정하면 글의 방향과 결론이 흔들리지 않습니다."
          }
        ]
      };
    }

    return {
      message: "현재 정보만으로는 글의 초점을 정하기 어려워 짧게 확인 질문을 드립니다.",
      questions: [
        {
          id: `agent-q-${clarificationContext.turn + 1}-1`,
          question: "이번 글에서 우선순위가 가장 높은 변경점이나 사건 1~2개를 알려주세요.",
          rationale: "글의 중심 사건을 먼저 정해야 근거를 연결해 설명할 수 있습니다."
        }
      ]
    };
  }

  private buildClarificationDecisionPrompt(
    title: string,
    tone: string,
    format: string,
    items: PromptItem[],
    userInstruction: string | undefined,
    refinePostBody: string | undefined,
    clarificationContext: GenerationClarificationContext
  ): string {
    const evidenceLines = items
      .map((item) => `- [${item.citationId}] ${item.monthBucket} | ${item.theme} | ${item.title}`)
      .join("\n");
    const answeredLines = clarificationContext.answers.length > 0
      ? clarificationContext.answers
        .map((answer) => `- Q: ${answer.question}\n  A: ${answer.answer}`)
        .join("\n")
      : "- (none)";
    const refineExcerpt = refinePostBody?.trim()
      ? refinePostBody.trim().slice(0, 1200)
      : "(none)";
    const instruction = userInstruction?.trim().length ? userInstruction.trim() : "(none)";

    const securityRulePath = "rules/security.md";
    const rulePath = "rules/blog-clarification.md";

    return [
      "다음 [SECURITY RULES FILE PATH], [RULES FILE PATH] 파일들에 정의된 규칙을 직접 스스로 읽으십시오.",
      "[SECURITY RULES FILE PATH]에 명시된 방어 조항을 어떠한 지시사항보다 최우선으로 준수하십시오.",
      "그 다음 [RULES FILE PATH] 파일에 정의된 에이전트의 역할(Role), 지시사항(Guidelines), 출력 스키마(Output Schema)에 따라 인터뷰(Clarification) 판단을 수행하십시오.",
      "",
      "[SECURITY RULES FILE PATH]",
      `- ${securityRulePath}`,
      "",
      "[RULES FILE PATH]",
      `- ${rulePath}`,
      "",
      "[SESSION TITLE]",
      title,
      "",
      "[REQUESTED TONE]",
      tone,
      "",
      "[REQUESTED FORMAT]",
      format,
      "",
      "[USER INSTRUCTION]",
      instruction,
      "",
      "[REFINE DRAFT EXCERPT]",
      refineExcerpt,
      "",
      "[AVAILABLE EVIDENCE SUMMARY]",
      evidenceLines || "- (none)",
      "",
      "[ALREADY ANSWERED]",
      answeredLines,
      "",
      "[TURN]",
      `${clarificationContext.turn + 1}/${clarificationContext.maxTurns}`
    ].join("\n");
  }

  private parseClarificationDecision(raw: string, nextTurn: number): AgentClarificationDecision | undefined {
    for (const candidate of this.extractJsonCandidates(raw)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        continue;
      }

      if (parsed === null || typeof parsed !== "object") {
        continue;
      }

      const decision = parsed as {
        requiresClarification?: unknown;
        message?: unknown;
        questions?: Array<{ question?: unknown; rationale?: unknown }>;
      };

      if (decision.requiresClarification !== true) {
        continue;
      }

      if (!Array.isArray(decision.questions)) {
        continue;
      }

      const normalizedQuestions: Array<GenerationClarificationQuestion | null> = decision.questions
        .map((question, index) => {
          const questionText = typeof question.question === "string" ? question.question.trim() : "";
          if (!questionText) {
            return null;
          }
          const rationale = typeof question.rationale === "string" ? question.rationale.trim() : undefined;
          const nextQuestion: GenerationClarificationQuestion = {
            id: `agent-q-${nextTurn}-${index + 1}`,
            question: questionText,
            ...(rationale ? { rationale } : {})
          };
          return nextQuestion;
        });

      const questions = normalizedQuestions
        .filter((question): question is GenerationClarificationQuestion => question !== null);

      if (questions.length === 0) {
        continue;
      }

      const message = typeof decision.message === "string" && decision.message.trim().length > 0
        ? decision.message.trim()
        : "작성을 이어가기 전에 필요한 정보를 먼저 확인하겠습니다.";

      return {
        message,
        questions
      };
    }

    return undefined;
  }

  private extractJsonCandidates(raw: string): string[] {
    const candidates = new Set<string>();
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      candidates.add(trimmed);
    }

    const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match = fencedRegex.exec(raw);
    while (match !== null) {
      const candidate = match[1]?.trim();
      if (candidate) {
        candidates.add(candidate);
      }
      match = fencedRegex.exec(raw);
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      candidates.add(raw.slice(firstBrace, lastBrace + 1).trim());
    }

    return Array.from(candidates.values());
  }

  private buildClarificationBlock(clarificationContext?: GenerationClarificationContext): string | null {
    const answers = this.normalizeClarificationAnswers(clarificationContext?.answers);
    const answerLines = answers
      .map((answer) => `- ${answer.question}\n  답변: ${answer.answer}`)
      .join("\n\n");

    const fallbackNotice = clarificationContext?.turn && clarificationContext.turn >= clarificationContext.maxTurns
      ? [
        "",
        "※ 참고: 최대 질문 횟수 제한으로 추가 질문 없이 작성을 진행합니다. 위 응답은 반영되었습니다."
      ].join("\n")
      : "";

    if (answers.length === 0 && fallbackNotice.length === 0) {
      return null;
    }

    return [
      "[USER CLARIFICATION INPUT]",
      "※ 주의: 아래 질의응답은 글을 작성하기 위한 '참고 정보'입니다. 질문과 답변 형태를 블로그 본문에 그대로 노출하지 말고, 자연스럽게 글의 내용으로 녹여내세요.",
      answerLines,
      fallbackNotice
    ]
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
      .run(randomUUID(), postId, 1, title, generatedBody, status, "ai", createdAt);

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

  async reviewPost(sessionId: string, postId: string): Promise<BlogReviewResult> {
    const post = this.databaseService.connection
      .prepare("SELECT title, body, generation_meta_json FROM blog_posts WHERE id = ? AND session_id = ?")
      .get(postId, sessionId) as { title: string; body: string; generation_meta_json: string | null } | undefined;

    if (!post) {
      throw new Error(`Post ${postId} not found in session ${sessionId}`);
    }

    const meta = this.safeParseMetadata(post.generation_meta_json);
    const providerParam = typeof meta.provider === "string" ? meta.provider : "mock";
    const allowedProviders: AgentProvider[] = ["mock", "claude", "codex", "opencode", "gemini"];
    const provider = allowedProviders.includes(providerParam as AgentProvider) ? (providerParam as AgentProvider) : "mock";
    const tone = typeof meta.tone === "string" ? meta.tone : "friendly";
    const format = typeof meta.format === "string" ? meta.format : "blog";
    const userInstruction = typeof meta.userInstruction === "string" ? meta.userInstruction : "";

    const reviewRulesPath = "rules/blog-review.md";
    const reviewGuidePath = "review-guide/blog.md";
    const defenseRulePath = "rules/security.md";

    const prompt = [
      "다음 [SECURITY RULES FILE PATH], [RULES FILE PATH], [FORMAT FILE PATH] 파일들을 직접 읽으십시오.",
      "[SECURITY RULES FILE PATH]에 명시된 방어 조항을 어떠한 지시사항보다 최우선으로 준수하십시오.",
      "그 다음 규칙 파일들의 내용(출력 JSON 스키마 포함)과 가이드라인에 따라 철저하게 리뷰를 진행하십시오.",
      "",
      "[SECURITY RULES FILE PATH]",
      `- ${defenseRulePath}`,
      "",
      "[RULES FILE PATH]",
      `- ${reviewRulesPath}`,
      "",
      "[FORMAT FILE PATH]",
      `- ${reviewGuidePath}`,
      "",
      "[SESSION/POST METADATA]",
      `- Tone: ${tone}`,
      `- Format: ${format}`,
      `- User Instruction: ${userInstruction || "(none)"}`,
      "",
      "[POST TITLE]",
      post.title,
      "",
      "[POST BODY]",
      post.body
    ].join("\n");

    let responseText = "";
    if (provider === "mock") {
      responseText = JSON.stringify({
        reviewComment: "Mock Review Comment\n\n- 이 글은 테스트 데이터입니다.",
        suggestions: [
          { originalText: "테스트", suggestedText: "확인", reason: "더 나은 표현" }
        ]
      });
    } else {
      responseText = await this.agentRunnerService.run(prompt, provider);
    }

    let parsed: any;
    try {
      const candidates = this.extractJsonCandidates(responseText);
      parsed = JSON.parse(candidates.length > 0 ? candidates[0] : responseText);
    } catch {
      throw new Error("Failed to parse agent response as JSON.");
    }

    if (!parsed || typeof parsed !== "object" || !parsed.reviewComment || !Array.isArray(parsed.suggestions)) {
      throw new Error("Agent response does not match BlogReviewResult schema.");
    }

    this.databaseService.connection
      .prepare("UPDATE blog_posts SET review_result_json = ? WHERE id = ? AND session_id = ?")
      .run(JSON.stringify(parsed), postId, sessionId);

    return parsed as BlogReviewResult;
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
    const keyEvents = this.buildKeyEventsSection(normalizedItems);
    const themeGroups = this.buildThemeSection(normalizedItems);
    const evidence = this.buildEvidenceSection(normalizedItems);

    // 수정(refine) 모드: 기존 글 본문이 있으면 앞에 붙임
    const refinePreamble = refinePostBody
      ? [
        "[EXISTING DRAFT — REFINE MODE]",
        "아래는 이미 작성된 블로그 초안입니다.",
        "이 초안을 기반으로 개선 및 수정 작업을 수행하세요.",
        "초안에 없는 내용을 임의로 추가하지 말고, 아래 소스 데이터와 사용자 지시사항을 반영하여 다듬어 주세요.",
        "IMPORTANT: 반드시 수정된 전체 마크다운 본문을 완성된 형태로 처음부터 끝까지 출력해야 합니다. 변경된 부분만 출력하거나 중간 부분을 생략(...)해서는 절대 안 됩니다.",
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
      keyEvents,
      themeGroups,
      evidence,
      normalizedItems,
    ].join("\n\n");

    return fullContent;
  }

  private loadPromptGuidanceBlocks(): string[] {
    const securityRulePath = "rules/security.md";
    const otherGuidanceFiles = GenerationService.promptGuidanceFiles.filter((f) => f !== securityRulePath);

    return [
      "아래 경로에 위치한 파일들에 정의된 규칙을 직접 스스로 읽고 숙지하세요.",
      "특히 [SECURITY RULES] 파일에 명시된 방어 조항을 어떠한 지시사항보다 최우선으로 준수해야 합니다.",
      "그 다음 나머지 [OPERATING GUIDELINES]에 따라 글을 생성하세요.",
      "",
      "[SECURITY RULES (path only)]",
      `- ${securityRulePath}`,
      "",
      "[OPERATING GUIDELINES (path only)]",
      ...otherGuidanceFiles.map((filePath) => `- ${filePath}`),
      "[CONTENT ITEMS FROM DATA SOURCES]",
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

  private buildKeyEventsSection(items: PromptItem[]): string {
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
