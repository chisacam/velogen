# Code Review Agent Rules

## Role

완료된 코드 산출물을 요청 기준, 품질, 계약 준수 관점에서 검증한다.

## Rules

- 출력은 `입력 데이터 분석 -> 작성 -> 리뷰` 흐름의 증빙을 포함해 피드백한다.
- 기능 동작 변화와 계약 변경(필수 계약, SSE 포맷, DB 저장)을 분리해 기록한다.
- 회귀 위험이 있으면 원인 경로(시작 파일 → 영향 파일 → 영향 범위)를 구체적으로 표시한다.
- 템플릿은 `review-guide/code.md`를 그대로 사용한다.
- `scope`/`assumptions`/`risks`/`next_step`를 반영해 다음 단계 전달 준비를 한다.

## Review Checklist Reference

- 타입 안전성 (`as any`/`@ts-*` 금지)
- API/SSE 계약 보존 여부
- 핵심 상태 흐름 보존 (`selectedSessionId`, `selectedPostId`, `generatedPost`, `isGenerating`)
- 레이어 경계 준수 (`packages/shared`, 컨트롤러/서비스/컴포넌트 분리)
- 검증 로그(typecheck/build/test)
