import { Injectable, Logger } from "@nestjs/common";

/**
 * Google Gemini Nano Banana API를 사용한 이미지 생성 서비스.
 *
 * 환경변수:
 * - `GOOGLE_API_KEY`: Google AI Studio에서 발급받은 API 키
 * - `GEMINI_IMAGE_MODEL`: 사용할 모델 (기본: gemini-2.5-flash-image)
 */
@Injectable()
export class ImageGenService {
    private readonly logger = new Logger(ImageGenService.name);
    private readonly apiKey = process.env.GOOGLE_API_KEY ?? "";
    private readonly model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

    /**
     * 텍스트 프롬프트로부터 이미지를 생성하고 base64 데이터를 반환합니다.
     * @returns { mimeType: string, base64: string } 또는 null (실패 시)
     */
    async generateImage(prompt: string): Promise<{ mimeType: string; base64: string } | null> {
        if (!this.apiKey) {
            this.logger.warn("GOOGLE_API_KEY is not set. Skipping image generation.");
            return null;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

        const body = {
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                responseModalities: ["Image"],
            },
        };

        try {
            this.logger.log(`Generating image: "${prompt.slice(0, 80)}..."`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "x-goog-api-key": this.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.warn(`Image generation failed (${response.status}): ${errorText.slice(0, 300)}`);
                return null;
            }

            const data = (await response.json()) as {
                candidates?: Array<{
                    content?: {
                        parts?: Array<{
                            text?: string;
                            inlineData?: { mimeType: string; data: string };
                        }>;
                    };
                }>;
            };

            const parts = data.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
                if (part.inlineData) {
                    this.logger.log("Image generated successfully.");
                    return {
                        mimeType: part.inlineData.mimeType,
                        base64: part.inlineData.data,
                    };
                }
            }

            this.logger.warn("No image data in response.");
            return null;
        } catch (error) {
            this.logger.warn(
                `Image generation error: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }

    /**
     * 블로그 본문에서 주요 섹션 제목들을 추출하고,
     * 각 섹션에 어울리는 일러스트레이션 이미지를 생성합니다.
     *
     * @returns 생성된 이미지 목록 [{ sectionTitle, mimeType, base64 }]
     */
    async generateBlogImages(
        blogBody: string,
        maxImages: number = 3
    ): Promise<Array<{ sectionTitle: string; mimeType: string; base64: string }>> {
        if (!this.apiKey) {
            return [];
        }

        // H2 헤더(## 제목) 추출
        const headings = blogBody.match(/^##\s+(.+)$/gm) ?? [];
        const sectionTitles = headings
            .map((h) => h.replace(/^##\s+/, "").trim())
            .filter((t) => t.length > 0)
            .slice(0, maxImages);

        if (sectionTitles.length === 0) {
            return [];
        }

        const results: Array<{ sectionTitle: string; mimeType: string; base64: string }> = [];

        for (const title of sectionTitles) {
            const prompt = [
                "Create a minimal, modern tech blog illustration for the following section topic.",
                "Style: flat design, soft gradient colors, clean lines, no text in the image.",
                "The illustration should be abstract but conceptually related to the topic.",
                "Aspect ratio: 16:9, suitable as a blog section header image.",
                "",
                `Section topic: "${title}"`,
            ].join("\n");

            const image = await this.generateImage(prompt);
            if (image) {
                results.push({
                    sectionTitle: title,
                    mimeType: image.mimeType,
                    base64: image.base64,
                });
            }
        }

        return results;
    }
}
