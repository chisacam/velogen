# AGENTS

이 문서는 AI 에이전트가 **코드 작업**과 **블로그 작성 작업**을 동일한 규칙으로 수행하기 위한 가이드입니다.

## 1. Global Rules (모든 에이전트 공통)

- 프로젝트 기본 구조 우선: `apps/web`, `apps/api`, `packages/shared` 기준으로 작업하고, 변경 범위를 한 파일에 고립하지 말고 도메인 단위로 분리한다.
- 기능 동작 유지 우선: API 엔드포인트, SSE 스펙(`type/status/chunk/complete/error`), DB 스키마/저장 동작은 기본 동작을 유지한다.
- 타입 안정성 원칙: `as any`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`는 사용하지 않는다.
- 검증은 기본 수행: 가능하면 `npm run typecheck -w apps/web`, `npm run typecheck -w apps/api`, `npm run build -w apps/web`, `npm run build -w apps/api`, 영향범위 기반 테스트를 실행한다.
- 재사용성 우선: 공용 타입/유틸(`packages/shared`, `apps/web/lib`, `apps/web/features`)로 중복 코드를 줄인다.
- 커밋 규칙: 단일 목적 단위로 분리 커밋하고, 기능 단위를 혼합하지 않는다.
- 문서 우선: 새로운 규칙/스킬/범위가 생길 때 `AGENTS.md` 또는 대응 보고서에 즉시 반영한다.

## 2. Mandatory Handoff Workflow (입력 분석 -> 작성 -> 리뷰)

모든 작업은 아래 순서를 기본으로 진행한다.

1. **입력 데이터 분석 에이전트 (Input Analysis Agent)**: 사용자 요청, 컨텍스트, 제약 조건을 구조화.
2. **블로그/콘텐츠 작성 에이전트 (Blog Writing Agent)**: 분석된 입력을 기반으로 산출물 작성.
3. **리뷰 에이전트 (Review Agent)**: 요청 적합성, 형식, 정확성, 위험 항목을 검증하고 승인 가능성 판단.

각 단계는 다음 단계로 전달 시 다음 정보를 같이 붙인다.

- `scope`: 변경/생성 범위
- `assumptions`: 전제 조건 및 미확정 항목
- `risks`: 회귀·호환성 위험
- `next_step`: 다음 에이전트에게 필요한 액션

## 3. Input Analysis Agent

### Role
요청된 문제를 코드/도메인 관점으로 해석하고, 필요한 입력 항목을 빠짐없이 정리한다.

### Rule
- 입력을 기능 범위, 제약, 성공 기준으로 분리한다.
- 동일한 의미의 변경인지, 새 기능인지, 정책 문서 업데이트가 필요한지 분류한다.
- `AGENTS.md`와 기존 구현(특히 `apps/web/features/workspace/*`, `apps/api/src/...`)의 종속 관계를 확인한다.
- SSE, API 계약, 상태 흐름이 변경 대상인지 별도 라벨링한다.

## 4. Code Agent

### Role
코드베이스를 직접 수정하고 기능을 구현/안정화한다.

### Rule
- 대상은 `apps/web`, `apps/api`, `packages/shared`, 루트 빌드/검증 스크립트.
- 새 코드는 기존 패턴(서비스-컨트롤러 경계, `packages/shared` 타입 공유, `api-client` 호출 계층, `features` 도메인 컴포넌트)과 정렬한다.
- 파일 분할은 기능 단위(Menu, Source, Session, Post, Generation)로 수행하며, UI는 `apps/web/features/workspace/*`의 계층을 유지한다.
- 임시/레거시 패턴(섀도우 상태, 중복 요청, 하드코딩)를 신규 코드로 대체한다.
- 라우트/엔드포인트 변경 시 `apps/api/src/app.module.ts`와 서비스 의존성을 먼저 확인한다.

### Skills
- **Backend Navigation**: 컨트롤러(`sessions`, `sources`, `generation`, `posts`)와 서비스 간 호출 경계를 추적한다.
- **Frontend Refactoring**: 페이지 오케스트레이터를 컨트롤러(Hook)와 퍼블릭 UI 컴포넌트로 분리한다.
- **API Contract Hygiene**: `packages/shared/src/index.ts` 타입을 우선 확인하고 payload/응답 계약을 정렬한다.
- **Streaming Safety**: `GenerationController.generateStream` SSE 포맷 유지.
- **Static Safety Checks**: 타입 체크/빌드 결과 기반으로 회귀를 선제 차단한다.

### Working Context Map
- 핵심 Web entry: `apps/web/app/page.tsx`
- 핵심 Workspace 분리본: `apps/web/features/workspace/workspace-ui.tsx`, `apps/web/features/workspace/use-workspace-controller.ts`, `apps/web/features/workspace/types.ts`, `apps/web/features/workspace/constants.ts`, `apps/web/features/workspace/utils.ts`
- 핵심 API: `apps/api/src/sessions/sessions.controller.ts`, `apps/api/src/sessions/posts.controller.ts`, `apps/api/src/sources/sources.controller.ts`, `apps/api/src/generation/generation.controller.ts`, `apps/api/src/sessions/sessions.service.ts`
- 공용 타입: `packages/shared/src/index.ts`

## 5. Blog Agent

### Role
블로그 초안 생성 및 개선용 텍스트를 작성한다.

### Rule
- 기본 프롬프트 기준은 `buildPrompt`이며, 톤/형식은 `tone`, `format`을 최우선 반영한다.
- `refinePostBody` 존재 시 기존 초안을 이어받아 보강한다.
- 출력 구조는 아래 5개 섹션 순서를 준수한다.
  1. `Executive Summary`
  2. `Timeline Review`
  3. `Thematic Insights`
  4. `Decisions & Trade-offs`
  5. `Next Iteration Plan`
- 소스 데이터 외 추측은 금지하고, `userInstruction`을 항상 우선 반영한다.
- 독자 진입점을 고려해 지나친 전문 용어 과다 사용을 피한다.

## 6. Review Agent

### Role
완료된 산출물(코드/블로그)을 요청 기준, 품질, 계약 준수 관점에서 검증한다.

### Rule
- 출력은 `입력 데이터 분석 -> 작성 -> 리뷰` 흐름의 증빙을 포함해 피드백한다.
- 기능 동작 변화와 계약 변경을 명확히 구분해 기록한다.
- 회귀 위험이 있으면 구체적으로 원인 경로(파일/시작점/영향 범위)까지 표기한다.

## 7. buildPrompt Reference (for Blog Agent)

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
  - 초과 시 compact 모드로 축약된 증거 형태로 폴백

## 8. Code Review Template

### Template

```text
Scope:
- 기능 범위:
- 영향 파일:

Checks:
- [ ] 요청 범위 일치 (무엇을 왜 바꾸는지 명확)
- [ ] 타입 안전성 위반 없음 (`as any`/`@ts-*` 없음)
- [ ] API 계약 및 SSE 포맷 변화 없음 또는 변경 시 변경 사유/영향 기록
- [ ] 핵심 상태 흐름 보존(`selectedSessionId`, `selectedPostId`, `generatedPost`, `isGenerating`)
- [ ] 공통 타입 및 계층 경계 준수(`packages/shared`, 컨트롤러/서비스/컴포넌트 분리)
- [ ] 검증 통과 기록 (typecheck/build/test)

Findings:
- 위험:
- 개선 포인트:
- 승인:
```

## 9. Blog Review Template

### Template

```text
Scope:
- 글 제목 / 세션:
- 입력 `tone`/`format`:
- refine 모드: [ ]ON [ ]OFF

Checklist:
- [ ] `Executive Summary` ~ `Next Iteration Plan` 순서 준수
- [ ] `Timeline Review`, `Thematic Insights`에 소스 근거 반영
- [ ] `userInstruction` 반영 여부
- [ ] refine 모드일 경우 기존 초안 연속성 보존
- [ ] 과도한 추측/허위 근거 없음 (source-based)
- [ ] `Next Iteration Plan`은 실행 가능한 액션 중심, TODO 블록 과다 사용 없음

Risk:
- 사실성/용어 혼동:
- 보완 요청:
- 승인:
```
