# Code Review Template

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
