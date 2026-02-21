# VELogen Refactor Report

## 1) Executive Summary
- 목적: 기능 동작은 유지하면서, 유지보수/확장 가능한 모듈 구조로 전환한다.
- 핵심 문제: `apps/api/src/main.ts`와 `apps/web/app/page.tsx`에 책임이 과집중되어 변경 파급 범위가 크다.
- 진행 원칙: 기능 단위 분리 -> 검증(typecheck/test/build) -> 단계별 원자 커밋.

## 2) Current State Analysis

### 2.1 Backend (`apps/api`)
- 현재 `main.ts`가 라우팅, 요청 파싱, 에러 응답, SSE 스트리밍, 이미지 생성 엔드포인트를 직접 관리한다.
- 서비스 계층(`sessions`, `sources`, `generation`, `sync`, `image-gen`)은 이미 분리되어 있어 컨트롤러 경계로 옮기기 유리하다.

### 2.2 Frontend (`apps/web`)
- `app/page.tsx`(1278 lines)가 상태, API 호출, 스트리밍 처리, 패널 렌더링, 유틸리티까지 모두 포함한다.
- UI 컴포넌트(`markdown-editor`, `markdown-viewer`)는 분리되어 있으나, 도메인 구조(세션/소스/포스트/생성)가 파일 레벨에서 분리되어 있지 않다.

### 2.3 Shared Contract (`packages/shared`)
- 공용 타입은 일부 존재하나, endpoint별 요청/응답 계약이 프론트에서 문자열/로컬 타입으로 분산되어 있다.

## 3) Refactor Objectives
- 기능 동일성 유지: API path/파라미터/SSE payload/데이터 저장 동작 보존.
- 모듈성 강화: 라우팅/서비스/DTO, UI/상태/유틸/API 클라이언트 경계 명확화.
- 재사용성 강화: 공용 타입, API 클라이언트, 상태 훅, 도메인 컴포넌트 분리.
- 점진적 안정화: 각 단계마다 검증과 커밋을 완료한 후 다음 단계 진행.

## 4) Phase Plan

### Phase A - API Route Decomposition
목표:
- `main.ts`의 직접 라우팅을 Nest Controller 기반으로 이동.

예상 산출물:
- `sources.controller.ts`
- `sessions.controller.ts`
- `posts.controller.ts`
- `generation.controller.ts` (SSE 포함)
- `images.controller.ts`
- `app.module.ts` controller 등록
- `main.ts`는 bootstrap/CORS/listen 중심으로 축소

검증:
- `npm run typecheck -w apps/api`
- `npm run test -w apps/api`
- `npm run build -w apps/api`

### Phase B - Web Domain/Client Split
목표:
- `page.tsx`에서 API, 타입, 상수, 유틸, 상태 책임을 분리.

예상 산출물:
- `apps/web/lib/api-client.ts`
- `apps/web/features/workspace/types.ts`
- `apps/web/features/workspace/constants.ts`
- `apps/web/features/workspace/utils.ts`
- 필요 시 `hooks/` 계층(`useToasts`, `useGenerationStream`) 추가

검증:
- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`

### Phase C - UI/UX and CSS Refinement
목표:
- 기존 시각 언어를 유지하면서 구조적 CSS 정리 및 UX 개선 적용.
- 별도 서브에이전트 리뷰를 통해 개선 포인트를 반영.

예상 산출물:
- panel/component 단위 class/스타일 구조 정리
- 모바일/데스크톱 레이아웃 안정화
- 상호작용 요소(생성패널, 토스트, 모드 토글) 접근성 및 피드백 개선

검증:
- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`

## 5) Commit Policy (Mandatory)
- 파일 수정이 발생한 단계는 반드시 별도 커밋으로 기록한다.
- 커밋은 기능 단위로 분리한다(혼합 커밋 금지).
- 권장 순서:
  1. API 라우팅 분해
  2. Web 도메인/클라이언트 분리
  3. CSS/UX 개선
  4. 필요 시 테스트/문서 보강

## 6) Risks and Mitigation
- SSE 회귀 위험: 기존 payload(`status/chunk/complete/error`) 포맷 동일성 검증으로 대응.
- 상태 동기화 위험: `selectedSessionId`, `selectedPostId`, `generatedPost` 간 effect 순서 유지.
- 계약 분산 위험: shared 타입/클라이언트 레이어에 계약 집중.

## 7) Acceptance Criteria
- API 엔드포인트 동작/응답 형식/SSE 동작이 기존과 동일하다.
- `apps/api`와 `apps/web`의 typecheck/build가 성공한다.
- 관련 테스트가 성공하고(또는 기존 실패 없음 확인), 단계별 커밋 히스토리가 명확하다.
- `main.ts`, `page.tsx`의 책임이 줄고 모듈 구조가 명확하다.

## 8) Execution Log (to be updated during work)
- [x] 리팩토링 브랜치 생성: `refactor/modular-architecture`
- [ ] Phase A 구현 및 검증/커밋
- [ ] Phase B 구현 및 검증/커밋
- [ ] Phase C(UX/CSS 서브에이전트 피드백 반영) 구현 및 검증/커밋
- [ ] 최종 통합 검증 및 결과 보고
