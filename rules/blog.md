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

## buildPrompt Reference

- 구현 위치: `apps/api/src/generation/generation.service.ts`
- 메서드: `private buildPrompt(title, tone, format, items, userInstruction?, refinePostBody?): string`
- 입력
  - `title`: 세션 기반 제목
  - `tone`: 톤/문체
  - `format`: 글 형식
  - `items`: 소스 항목 배열(커밋/노션)
  - `userInstruction?`: 사용자 추가 지시사항
  - `refinePostBody?`: 수정 모드용 기존 초안
- 출력 구성
  - `[EXISTING DRAFT — REFINE MODE]`(옵션)
  - `[USER INSTRUCTION]`(옵션)
  - 기본 규칙 블록
  - `[TIMELINE INPUT]`
  - `[THEME INPUT]`
  - `[EVIDENCE INPUT]`
- 제한/축소
  - 기본 상한 `PROMPT_MAX_CHARS`(기본 `32000`)
  - 초과 시 compact 모드로 축약 증거 사용
