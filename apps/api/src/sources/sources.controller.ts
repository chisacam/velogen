import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import type { CreateSourceDto } from "@velogen/shared";
import { SourcesService } from "./sources.service";

@Controller("sources")
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  listSources() {
    return this.sourcesService.listSources();
  }

  @Post()
  createSource(@Body() payload: CreateSourceDto) {
    return this.sourcesService.createSource(payload);
  }

  @Delete(":sourceId")
  removeSource(@Param("sourceId") sourceId: string): { ok: true } {
    this.sourcesService.removeSource(sourceId);
    return { ok: true };
  }
}
