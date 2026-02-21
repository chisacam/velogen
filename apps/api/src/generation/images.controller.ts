import { Body, Controller, Post } from "@nestjs/common";
import { ImageGenService } from "./image-gen.service";

@Controller()
export class ImagesController {
  constructor(private readonly imageGenService: ImageGenService) {}

  @Post("generate-image")
  async generateImage(@Body() body: { prompt?: string }) {
    if (!body.prompt) {
      return { error: "prompt is required" };
    }
    const result = await this.imageGenService.generateImage(body.prompt);
    if (!result) {
      return { error: "Image generation failed. Check GEMINI_API_KEY." };
    }
    return result;
  }

  @Post("generate-blog-images")
  async generateBlogImages(@Body() body: { blogBody?: string; maxImages?: number }) {
    if (!body.blogBody) {
      return { images: [] };
    }
    const images = await this.imageGenService.generateBlogImages(body.blogBody, body.maxImages ?? 3);
    return { images };
  }
}
