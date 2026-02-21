# Code Input Analysis

## Role

요청을 코드 관점으로 해석해 구현 우선순위와 회귀 포인트를 정리한다.

## Rules

- 요청을 기능 범위, 제약, 성공 기준으로 분리한다.
- 기존 구현(특히 `apps/web/features/workspace/*`, `apps/api/src/...`)의 종속 관계를 먼저 확인한다.
- 동일 변경인지, 확장인지, 정책 문서 업데이트가 필요한지 분류한다.
- SSE, API 계약, DB 저장 흐름이 변경 대상이면 `risks`에 명시한다.
- `scope`/`assumptions`/`risks`/`next_step` 형식으로 작성한다.

## Output Template

```text
scope:
- 목표: (무엇을 왜 바꾸는지 한 줄)
- 경계: (동일성 유지 항목)

assumptions:
- (확인된 제약)
- (아직 미확정 항목)

risks:
- (기능 회귀 위험)
- (호환성 위험)

next_step:
- 작성 단계: (필요한 산출물)
- 리뷰 단계: (검증 포인트)
```
