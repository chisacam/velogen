import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { CreateSessionDto, UpdateSessionConfigDto } from "@velogen/shared";
import { SessionsService } from "./sessions.service";

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  listSessions() {
    return this.sessionsService.listSessions();
  }

  @Post()
  createSession(@Body() payload: CreateSessionDto) {
    return this.sessionsService.createSession(payload);
  }

  @Patch(":sessionId/config")
  updateSessionConfig(@Param("sessionId") sessionId: string, @Body() payload: UpdateSessionConfigDto) {
    return this.sessionsService.updateSessionConfig(sessionId, payload);
  }

  @Get(":sessionId/sources")
  listSessionSources(@Param("sessionId") sessionId: string) {
    return this.sessionsService.listSessionSources(sessionId);
  }

  @Post(":sessionId/sources/:sourceId")
  addSource(@Param("sessionId") sessionId: string, @Param("sourceId") sourceId: string) {
    return this.sessionsService.addSource(sessionId, sourceId);
  }

  @Delete(":sessionId/sources/:sourceId")
  removeSource(@Param("sessionId") sessionId: string, @Param("sourceId") sourceId: string) {
    return this.sessionsService.removeSource(sessionId, sourceId);
  }

  @Post(":sessionId/sources/:sourceId/sync")
  syncSource(@Param("sessionId") sessionId: string, @Param("sourceId") sourceId: string) {
    return this.sessionsService.syncSource(sessionId, sourceId);
  }

  @Delete(":sessionId")
  deleteSession(@Param("sessionId") sessionId: string) {
    return this.sessionsService.deleteSession(sessionId);
  }
}
