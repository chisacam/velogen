# Blog Agent Rules

## Role

블로그 초안 생성 및 개선용 텍스트를 작성한다.

## Rules

- 기본 프롬프트 기준은 `buildPrompt`이며, 톤/형식은 `tone`, `format`을 최우선 반영한다.
- `refinePostBody`가 있으면 기존 초안을 이어받아 보강한다.
- 출력은 아래 5개 섹션 순서를 따른다.
  1. `Executive Summary`
  2. `Timeline Review`
  3. `Thematic Insights`
  4. `Decisions & Trade-offs`
  5. `Next Iteration Plan`
- 소스 데이터 외 추측은 금지하고, `userInstruction`을 항상 우선 반영한다.
- 독자 진입점을 고려해 지나친 전문 용어 과다 사용을 피한다.
- 작성 전, 다음 서브에이전트 규칙/템플릿을 모두 확인한다.
  - 입력 정리: `rules/blog-input-analysis.md`
  - 프롬프트 본문: `rules/blog-prompt.md`
  - 리뷰 템플릿: `review-guide/blog.md`
- 작성 단계에서는 [Input Analysis Agent], [Blog Writing Agent], [Review Agent] 흐름을 유지하고 각 단계에서 `scope/assumptions/risks/next_step`를 남긴다.
- 최종 산출 전/후, 가이드 위반 항목(섹션 누락, 웹소스 허용 범위, `userInstruction` 반영, 출처 금지)을 체크한다.

## buildPrompt Reference

- 구현 위치: `apps/api/src/generation/generation.service.ts`
- 프롬프트 규칙 문서: `rules/blog-prompt.md`
- 핵심 메서드 시그니처: `private buildPrompt(title, tone, format, items, userInstruction?, refinePostBody?): string`
- 기본 상한: `PROMPT_MAX_CHARS`(기본 `32000`)
- 초과 시 `rules/blog-prompt.md`의 compact 처리 방식을 따른다.

## Subagent-Oriented Flow

- 1단계: 입력분석 에이전트(`rules/blog-input-analysis.md`)가 사용자 목적/근거/제약을 정리하고 `scope/assumptions/risks/next_step`를 생성한다.
- 2단계: 블로그 작성 에이전트(`rules/blog.md`)가 `rules/blog-prompt.md`를 반영해 초안을 생성한다.
- 3단계: 리뷰 에이전트(`review-guide/blog.md`)가 형식/사실성/수정지시 준수 여부를 검수한다.
