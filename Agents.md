# Agents

이 프로젝트에서 AI 에이전트가 코드 작업과 블로그 작성 작업을 일관된 방식으로 수행하기 위한 규칙과 스킬을 정의합니다.

## 1. Global Rules (모든 에이전트 공통)

- 프로젝트 기본 구조 우선: `apps/web`, `apps/api`, `packages/shared`를 중심으로 작업하고, 변경 범위를 한 파일로 고립하지 말고 도메인 단위로 분리한다.
- 기능 동작 유지 우선: API 엔드포인트, SSE 스펙(`type/status/chunk/complete/error`), DB 스키마/저장 동작은 기본값으로 보존한다.
- 타입 안정성 원칙: `as any`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`는 사용하지 않는다.
- 변경 전후 검증: 가능하면 `npm run typecheck -w apps/web`, `npm run typecheck -w apps/api`, `npm run build -w apps/web`, `npm run build -w apps/api`, 그리고 영향범위에 따라 테스트를 반드시 실행한다.
- 가독성/재사용성 우선: 중복 로직은 공용 함수/유형(`packages/shared`, `apps/web/lib`, `apps/web/features`)로 정리한다.
- 커밋 규칙: 한 번에 하나의 목적 단위만 수정하며, 기능 단위로 커밋한다.
- 문서화 우선: 새 규칙, 새 스킬, 영향 범위가 생기는 부분은 `Agents.md` 또는 적절한 리포트에 반영한다.

## 2. Code Agent

### Role
코드베이스를 직접 수정하고 기능을 구현/안정화하는 에이전트.

### Rule
- 대상은 `apps/web`, `apps/api`, `packages/shared`, 루트 빌드/검증 스크립트 설정.
- 새 코드는 기존 패턴(서비스/컨트롤러 경계, `packages/shared` 타입 공유, `api-client` 호출 레이어, `features` 도메인 컴포넌트)과 정렬해서 작성한다.
- 파일 분할의 단위는 기능 단위(Menu, Source, Session, Post, Generation)로 나누고, UI는 `apps/web/features/workspace/*`의 계층을 유지한다.
- 레거시/임시 데이터 패턴 사용은 피하고, 기존 상태흐름(`selectedSessionId`, `selectedPostId`, `generatedPost`, `isGenerating`) 보전.
- 새 라우트/엔드포인트 변경 시 `apps/api/src/app.module.ts`와 서비스 경로를 먼저 확인한다.

### Skills
- **Backend Navigation**: 컨트롤러(`sessions`, `sources`, `generation`, `posts`)와 서비스 간 호출 경계를 빠르게 추적한다.
- **Frontend Refactoring**: 페이지를 오케스트레이터(상태/사이드 이펙트)와 퍼블릭 UI 컴포넌트로 분리한다.
- **API Contract Hygiene**: `packages/shared/src/index.ts` 타입을 우선 확인하고 API payload/응답을 정렬한다.
- **Streaming Safety**: `GenerationController.generateStream`의 SSE 포맷을 유지하면서 수정한다.
- **Static Safety Checks**: TypeScript 컴파일러, build 결과를 바탕으로 회귀를 선제 차단한다.

### Working Context Map
- 핵심 Web entry: `apps/web/app/page.tsx`
- 핵심 Workspace 분리본: `apps/web/features/workspace/workspace-ui.tsx`, `apps/web/features/workspace/use-workspace-controller.ts`, `apps/web/features/workspace/types.ts`, `apps/web/features/workspace/constants.ts`, `apps/web/features/workspace/utils.ts`
- 핵심 API: `apps/api/src/sessions/sessions.controller.ts`, `apps/api/src/sessions/posts.controller.ts`, `apps/api/src/sources/sources.controller.ts`, `apps/api/src/generation/generation.controller.ts`, `apps/api/src/sessions/sessions.service.ts`
- 공용 타입: `packages/shared/src/index.ts`

## 3. Blog Agent

### Role
블로그 초안 생성 및 개선용 텍스트 생산을 담당.

### Rule
- 기본 프롬프트는 `buildPrompt`를 기준으로 작성하고, 본문 톤/형식은 `tone`, `format`을 우선 반영한다.
- `refinePostBody`가 있으면 리파인 모드로 간주하고 기존 초안 보강 문맥을 유지한다.
- 글 구조와 규칙은 기존 `buildPrompt`가 요구하는 Markdown 섹션 순서를 존중한다:
  1) `Executive Summary`
  2) `Timeline Review`
  3) `Thematic Insights`
  4) `Decisions & Trade-offs`
  5) `Next Iteration Plan`
- 소스 데이터 외부를 임의 추측해 채우지 않는다. 사용자 지시사항(`userInstruction`)이 있으면 우선 반영한다.
- 스타일은 개발자 대상이어도 비개발자도 이해할 수 있게 과도한 전문 용어를 자제한다.

### Skills
- **Prompt Mapping**: 입력(`title/tone/format/userInstruction/refinePostBody`)을 기존 작성 규칙으로 매핑한다.
- **Context Compression**: 길이 제한이 있을 경우 핵심 증거를 보존하며 압축한다.
- **Refine Mode Handling**: 기존 글 수정 요청(`refinePostBody`)을 반영해 논리적 일관성을 유지한다.
- **Section Discipline**: 5개 섹션 출력 형식을 그대로 사용한다.

## 4. buildPrompt Reference (for Blog Agent)

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
  - [EXISTING DRAFT — REFINE MODE] preamble(옵션)
  - `[USER INSTRUCTION]` 블록(옵션)
  - 기본 프롬프트 규칙 및 구성 안내
  - `[TIMELINE INPUT]` (시간순 입력)
  - `[THEME INPUT]` (테마 그룹)
  - `[EVIDENCE INPUT]` (근거 행)
- 제한/압축
  - 기본적으로 `PROMPT_MAX_CHARS`(기본 32000) 이하
  - 초과 시 body 길이를 축소해 compact 모드로 폴백

## 5. Review Checklist

- 코드 에이전트: 관련 파일 변경 후 기능 단위 커밋 + 검증 로그 보강.
- 블로그 에이전트: 요청과 출력이 위 `Rule` 5개 항목을 준수했는지 확인.
- 공통: 생성 산출물에서 API 변경/데이터 계약/파일 범위 확장 여부를 누락 없이 기록.
