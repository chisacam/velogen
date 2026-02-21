# Code Agent Rules

## Role

코드베이스를 직접 수정하고 기능을 구현/안정화한다.

## Rules

- 대상은 `apps/web`, `apps/api`, `packages/shared`, 루트 빌드/검증 스크립트이다.
- 기존 패턴(서비스-컨트롤러 경계, `packages/shared` 타입 공유, `api-client` 호출 계층, `features` 도메인 컴포넌트)과 정렬한다.
- 파일 분할은 기능 단위(Menu, Source, Session, Post, Generation)로 수행한다.
- UI는 `apps/web/features/workspace/*`의 계층을 유지한다.
- 임시/레거시 패턴(섀도우 상태, 중복 요청, 하드코딩)은 신규 코드로 대체한다.
- 라우트/엔드포인트 변경 시 `apps/api/src/app.module.ts`와 서비스 의존성을 먼저 확인한다.
- 회귀 가능성이 높은 경로는 변경 전후 계약을 동일하게 유지한다.

## Skills

- **Backend Navigation**: `sessions`, `sources`, `generation`, `posts` 경계를 추적한다.
- **Frontend Refactoring**: 오케스트레이터를 컨트롤러 훅과 퍼블릭 UI 컴포넌트로 분리한다.
- **API Contract Hygiene**: `packages/shared/src/index.ts` 타입을 우선 확인해 payload/응답 계약을 정렬한다.
- **Streaming Safety**: `GenerationController.generateStream` SSE 포맷(`type/status/chunk/complete/error`) 유지.
- **Static Safety Checks**: 타입체크/빌드 결과 기반으로 회귀를 선제 차단한다.

## Working Context Map

- 핵심 Web entry: `apps/web/app/page.tsx`
- 핵심 Workspace 모듈: `apps/web/features/workspace/workspace-ui.tsx`, `apps/web/features/workspace/use-workspace-controller.ts`, `apps/web/features/workspace/types.ts`, `apps/web/features/workspace/constants.ts`, `apps/web/features/workspace/utils.ts`
- 핵심 API: `apps/api/src/sessions/sessions.controller.ts`, `apps/api/src/sessions/posts.controller.ts`, `apps/api/src/sources/sources.controller.ts`, `apps/api/src/generation/generation.controller.ts`, `apps/api/src/sessions/sessions.service.ts`
- 공용 타입: `packages/shared/src/index.ts`

## Handoff

`scope`, `assumptions`, `risks`, `next_step`를 포함해 다음 단계로 전달한다.
