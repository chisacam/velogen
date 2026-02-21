import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import type { UpdatePostPayload } from "./sessions.service";
import { SessionsService } from "./sessions.service";

@Controller("sessions/:sessionId/posts")
export class PostsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  listPosts(@Param("sessionId") sessionId: string) {
    return this.sessionsService.listPosts(sessionId);
  }

  @Get(":postId")
  getPost(@Param("sessionId") sessionId: string, @Param("postId") postId: string) {
    return this.sessionsService.getPost(sessionId, postId);
  }

  @Patch(":postId")
  updatePost(
    @Param("sessionId") sessionId: string,
    @Param("postId") postId: string,
    @Body() payload: UpdatePostPayload
  ) {
    return this.sessionsService.updatePost(sessionId, postId, payload);
  }

  @Get(":postId/revisions")
  listPostRevisions(@Param("sessionId") sessionId: string, @Param("postId") postId: string) {
    return this.sessionsService.listPostRevisions(sessionId, postId);
  }

  @Get(":postId/revisions/:revisionId")
  getPostRevision(
    @Param("sessionId") sessionId: string,
    @Param("postId") postId: string,
    @Param("revisionId") revisionId: string
  ) {
    return this.sessionsService.getPostRevision(sessionId, postId, revisionId);
  }
}
