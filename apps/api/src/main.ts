import { NestFactory } from "@nestjs/core";
import type { AgentProvider, CreateSessionDto, CreateSourceDto, GenerateBlogDto, UpdateSessionConfigDto } from "@velogen/shared";
import { json as expressJson } from "express";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";
import { SessionsService } from "./sessions/sessions.service";
import type { UpdatePostPayload } from "./sessions/sessions.service";
import { SourcesService } from "./sources/sources.service";
import { ImageGenService } from "./generation/image-gen.service";

type RouteHandler = (req: Request<Record<string, string>>, res: Response) => Promise<void>;

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function getStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "getStatus" in error && typeof error.getStatus === "function") {
    const status = error.getStatus();
    if (typeof status === "number") {
      return status;
    }
  }
  return 500;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });

  // raw Express httpServer에 직접 라우트를 등록하기 전에
  // body-parser를 먼저 미들웨어 스택에 추가해야 req.body가 파싱된다.
  // app.init()은 NestJS 내부 라우터를 교체하므로 사용하지 않는다.
  app.use(expressJson());

  const sourcesService = app.get(SourcesService);
  const sessionsService = app.get(SessionsService);
  const imageGenService = app.get(ImageGenService);

  const httpServer = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: RouteHandler) => void;
    post: (path: string, handler: RouteHandler) => void;
    patch: (path: string, handler: RouteHandler) => void;
    delete: (path: string, handler: RouteHandler) => void;
  };

  const route = (handler: (req: Request<Record<string, string>>) => Promise<unknown>): RouteHandler => {
    return async (req, res) => {
      try {
        const result = await handler(req);
        res.status(200).json(result);
      } catch (error) {
        res.status(getStatus(error)).json({ message: getMessage(error) });
      }
    };
  };

  httpServer.get(
    "/sources",
    route(async () => {
      return sourcesService.listSources();
    })
  );

  httpServer.post(
    "/sources",
    route(async (req) => {
      return sourcesService.createSource(req.body as CreateSourceDto);
    })
  );

  httpServer.delete(
    "/sources/:sourceId",
    route(async (req) => {
      sourcesService.removeSource(req.params.sourceId);
      return { ok: true };
    })
  );

  httpServer.get(
    "/sessions",
    route(async () => {
      return sessionsService.listSessions();
    })
  );

  httpServer.post(
    "/sessions",
    route(async (req) => {
      return sessionsService.createSession(req.body as CreateSessionDto);
    })
  );

  httpServer.patch(
    "/sessions/:sessionId/config",
    route(async (req) => {
      return sessionsService.updateSessionConfig(req.params.sessionId, req.body as UpdateSessionConfigDto);
    })
  );

  httpServer.get(
    "/sessions/:sessionId/sources",
    route(async (req) => {
      return sessionsService.listSessionSources(req.params.sessionId);
    })
  );

  httpServer.post(
    "/sessions/:sessionId/sources/:sourceId",
    route(async (req) => {
      return sessionsService.addSource(req.params.sessionId, req.params.sourceId);
    })
  );

  httpServer.delete(
    "/sessions/:sessionId/sources/:sourceId",
    route(async (req) => {
      return sessionsService.removeSource(req.params.sessionId, req.params.sourceId);
    })
  );

  httpServer.post(
    "/sessions/:sessionId/sources/:sourceId/sync",
    route(async (req) => {
      return sessionsService.syncSource(req.params.sessionId, req.params.sourceId);
    })
  );

  httpServer.delete(
    "/sessions/:sessionId",
    route(async (req) => {
      return sessionsService.deleteSession(req.params.sessionId);
    })
  );

  httpServer.post(
    "/sessions/:sessionId/generate",
    route(async (req) => {
      const payload = (req.body as GenerateBlogDto | undefined) ?? {};
      const provider: AgentProvider = payload.provider ?? "mock";
      return sessionsService.generate(
        req.params.sessionId,
        provider,
        payload.tone,
        payload.format,
        payload.userInstruction,
        payload.refinePostId,
        payload.generateImage
      );
    })
  );

  httpServer.get("/sessions/:sessionId/generate/stream", async (req: Request<Record<string, string>>, res: Response) => {
    const sessionId = req.params.sessionId;
    const providerParam = typeof req.query.provider === "string" ? req.query.provider : "mock";
    const tone = typeof req.query.tone === "string" ? req.query.tone : undefined;
    const format = typeof req.query.format === "string" ? req.query.format : undefined;
    const userInstruction = typeof req.query.userInstruction === "string" ? req.query.userInstruction : undefined;
    const refinePostId = typeof req.query.refinePostId === "string" ? req.query.refinePostId : undefined;
    const generateImage = req.query.generateImage === "true";

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
      const result = await sessionsService.generateStream(sessionId, provider, tone, format, (chunk) => {
        send({ type: "chunk", chunk });
      }, userInstruction, refinePostId, generateImage);
      send({ type: "complete", post: result });
      res.end();
    } catch (error) {
      send({
        type: "error",
        message: getMessage(error)
      });
      res.end();
    }
  });

  httpServer.get(
    "/sessions/:sessionId/posts",
    route(async (req) => {
      return sessionsService.listPosts(req.params.sessionId);
    })
  );

  httpServer.get(
    "/sessions/:sessionId/posts/:postId",
    route(async (req) => {
      return sessionsService.getPost(req.params.sessionId, req.params.postId);
    })
  );

  httpServer.patch(
    "/sessions/:sessionId/posts/:postId",
    route(async (req) => {
      return sessionsService.updatePost(req.params.sessionId, req.params.postId, req.body as UpdatePostPayload);
    })
  );

  httpServer.get(
    "/sessions/:sessionId/posts/:postId/revisions",
    route(async (req) => {
      return sessionsService.listPostRevisions(req.params.sessionId, req.params.postId);
    })
  );

  httpServer.get(
    "/sessions/:sessionId/posts/:postId/revisions/:revisionId",
    route(async (req) => {
      return sessionsService.getPostRevision(req.params.sessionId, req.params.postId, req.params.revisionId);
    })
  );

  const port = Number.parseInt(process.env.PORT ?? "4000", 10);

  // ─── Image Generation ───

  httpServer.post(
    "/generate-image",
    route(async (req) => {
      const body = req.body as { prompt?: string };
      if (!body.prompt) {
        return { error: "prompt is required" };
      }
      const result = await imageGenService.generateImage(body.prompt);
      if (!result) {
        return { error: "Image generation failed. Check GEMINI_API_KEY." };
      }
      return result;
    })
  );

  httpServer.post(
    "/generate-blog-images",
    route(async (req) => {
      const body = req.body as { blogBody?: string; maxImages?: number };
      if (!body.blogBody) {
        return { images: [] };
      }
      const images = await imageGenService.generateBlogImages(
        body.blogBody,
        body.maxImages ?? 3
      );
      return { images };
    })
  );

  await app.listen(port);
}

void bootstrap();
