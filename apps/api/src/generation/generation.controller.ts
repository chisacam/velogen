import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { AgentProvider, GenerateBlogDto } from "@velogen/shared";
import type { Response } from "express";
import { SessionsService } from "../sessions/sessions.service";

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
}

@Controller("sessions/:sessionId/generate")
export class GenerationController {
  constructor(private readonly sessionsService: SessionsService) {}

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
      request.generateImage
    );
  }

  @Get("stream")
  async generateStream(
    @Param("sessionId") sessionId: string,
    @Query() query: GenerateStreamQuery,
    @Res() res: Response
  ): Promise<void> {
    const providerParam = query.provider ?? "mock";
    const tone = query.tone;
    const format = query.format;
    const userInstruction = query.userInstruction;
    const refinePostId = query.refinePostId;
    const generateImage = query.generateImage === "true";

    const allowedProviders: AgentProvider[] = ["mock", "claude", "codex", "opencode", "gemini"];
    const provider = allowedProviders.includes(providerParam as AgentProvider)
      ? (providerParam as AgentProvider)
      : "mock";

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
        generateImage
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
