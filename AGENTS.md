# AGENTS

이 프로젝트는 기술블로그를 정기적으로 작성해야 하거나 작성하고 싶은 개발자가
자신의 작업 기록(커밋, Notion, 생성 이력)을 기반으로 글을 만들고,
최종적으로는 그 과정을 자동화할 수 있도록 지원합니다.

## 프로젝트 목표

- 코드/글 작성 파이프라인을 모듈화해 사람이 분석하기 쉽고 AI 에이전트가 계속 이어받을 수 있게 한다.
- 작업의 핵심 동작은 유지하고, 운영 규칙은 일관되게 공유한다.
- 공통 규칙을 중심으로 하고, 역할별 세부 규칙은 전용 룰 파일로 분리한다.

## 핵심 공통 원칙

- 기본 구조: `apps/web`, `apps/api`, `packages/shared`를 기준으로 도메인 단위를 우선한다.
- 기본 동작 보존: API 엔드포인트, SSE 포맷(`type/status/chunk/complete/error`), DB 저장 계약은 기본적으로 변경하지 않는다.
- 타입 안정성 유지: `as any`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`를 금지한다.
- 문서 우선: 규칙/스킬/범위 변경은 AGENTS 또는 대응 보고서에 즉시 반영한다.
- 검증 우선: 가능한 범위에서 타입 체크/빌드/테스트를 확인한다.

## 룰 분리 위치

- 코드 작업: `./rules/code.md`
- 코드 입력 분석: `./rules/code-analysis.md`
- 코드 리뷰: `./rules/code-review.md`
- 블로그 입력 분석: `./rules/blog-input-analysis.md`
- 블로그 작성: `./rules/blog.md`
- 블로그 리뷰: `./rules/blog-review.md`
- 리뷰 템플릿: `./review-guide/code.md`, `./review-guide/blog.md`
