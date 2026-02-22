import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { AgentProvider, GenerateBlogDto, GenerationClarificationContext } from "@velogen/shared";
import type { Response } from "express";
import { SessionsService } from "../sessions/sessions.service";
import { GenerationService } from "./generation.service";

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

interface GenerateStreamQuery {
  provider?: string;
  tone?: string;
  format?: string;
  userInstruction?: string;
  refinePostId?: string;
  generateImage?: string;
  skipPreflight?: string;
  clarificationContext?: string;
}

function parseClarificationContext(value?: string): GenerationClarificationContext | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object") {
      return undefined;
    }

    const maybeContext = parsed as Partial<GenerationClarificationContext>;
    if (typeof maybeContext.turn !== "number" || !Number.isInteger(maybeContext.turn)) {
      return undefined;
    }

    if (typeof maybeContext.maxTurns !== "number" || !Number.isInteger(maybeContext.maxTurns)) {
      return undefined;
    }

    if (!Array.isArray(maybeContext.answers)) {
      return undefined;
    }

    return {
      turn: maybeContext.turn,
      maxTurns: maybeContext.maxTurns,
      answers: maybeContext.answers
    };
  } catch {
    return undefined;
  }
}

@Controller("sessions/:sessionId/generate")
export class GenerationController {
  constructor(private readonly sessionsService: SessionsService, private readonly generationService: GenerationService) { }

  @Post()
  generate(@Param("sessionId") sessionId: string, @Body() payload?: GenerateBlogDto) {
    const request = payload ?? {};
    const provider: AgentProvider = request.provider ?? "mock";
    return this.sessionsService.generate(
      sessionId,
      provider,
      request.tone,
      request.format,
      request.userInstruction,
      request.refinePostId,
      request.generateImage,
      request.skipPreflight,
      request.clarificationContext
    );
  }

  @Post(":postId/review")
  async reviewPost(@Param("sessionId") sessionId: string, @Param("postId") postId: string) {
    return this.generationService.reviewPost(sessionId, postId);
  }

  @Post("stream")
  async generateStreamPost(
    @Param("sessionId") sessionId: string,
    @Body() payload: GenerateBlogDto,
    @Res() res: Response
  ): Promise<void> {
    const request = payload ?? {};
    const allowedProviders: AgentProvider[] = ["mock", "claude", "codex", "opencode", "gemini"];
    const providerParam = request.provider ?? "mock";
    const provider = allowedProviders.includes(providerParam) ? providerParam : "mock";

    await this.streamGeneration(
      res,
      sessionId,
      provider,
      request.tone,
      request.format,
      request.userInstruction,
      request.refinePostId,
      request.generateImage,
      request.skipPreflight,
      request.clarificationContext
    );
  }

  @Get("stream")
  async generateStream(
    @Param("sessionId") sessionId: string,
    @Query() query: GenerateStreamQuery,
    @Res() res: Response
  ): Promise<void> {
    const providerParam = query.provider ?? "mock";
    const allowedProviders: AgentProvider[] = ["mock", "claude", "codex", "opencode", "gemini"];
    const provider = allowedProviders.includes(providerParam as AgentProvider)
      ? (providerParam as AgentProvider)
      : "mock";

    await this.streamGeneration(
      res,
      sessionId,
      provider,
      query.tone,
      query.format,
      query.userInstruction,
      query.refinePostId,
      query.generateImage === "true",
      query.skipPreflight === "true",
      parseClarificationContext(query.clarificationContext)
    );
  }

  private async streamGeneration(
    res: Response,
    sessionId: string,
    provider: AgentProvider,
    tone?: string,
    format?: string,
    userInstruction?: string,
    refinePostId?: string,
    generateImage?: boolean,
    skipPreflight?: boolean,
    clarificationContext?: GenerationClarificationContext
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (payload: Record<string, unknown>): void => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({ type: "status", message: "Generation started" });

    try {
      const result = await this.sessionsService.generateStream(
        sessionId,
        provider,
        tone,
        format,
        (chunk) => {
          send({ type: "chunk", chunk });
        },
        userInstruction,
        refinePostId,
        generateImage,
        skipPreflight,
        clarificationContext
      );
      send({ type: "complete", post: result });
      res.end();
    } catch (error) {
      send({
        type: "error",
        message: getMessage(error)
      });
      res.end();
    }
  }
}
