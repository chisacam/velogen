import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SourcesService } from "./sources/sources.service";
import { DatabaseService } from "./database/database.service";
import { SessionsService } from "./sessions/sessions.service";
import { ContentIngestionService } from "./sync/content-ingestion.service";
import { GenerationService } from "./generation/generation.service";
import { AgentRunnerService } from "./generation/agent-runner.service";
import { ImageGenService } from "./generation/image-gen.service";
import { SourcesController } from "./sources/sources.controller";
import { SessionsController } from "./sessions/sessions.controller";
import { PostsController } from "./sessions/posts.controller";
import { GenerationController } from "./generation/generation.controller";
import { ImagesController } from "./generation/images.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    SourcesController,
    SessionsController,
    PostsController,
    GenerationController,
    ImagesController
  ],
  providers: [
    DatabaseService,
    SourcesService,
    SessionsService,
    ContentIngestionService,
    GenerationService,
    AgentRunnerService,
    ImageGenService
  ]
})
export class AppModule { }
