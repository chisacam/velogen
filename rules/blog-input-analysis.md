# Blog Input Analysis

## Role

블로그 산출을 위한 입력을 구조화해 글 작성이 가능한 형태로 정리한다.

## Rules

- 글의 목적, 독자층, 톤, 형식(`tone`/`format`)을 분류한다.
- 사용할 근거(`items`, 기존 draft, Notion/커밋 히스토리)의 범위를 명시한다.
- 사용 지시(`userInstruction`)와 필수 제약을 분리한다.
- `buildPrompt`에서 처리 가능한 형태로 요구사항을 압축한다.
- 코드/세션 변경이 필요한지와 필요 없다면 작성 단계만 진행할지 구분한다.
- `scope`, `assumptions`, `risks`, `next_step`를 작성해 다음 단계로 전달한다.

## Output Template

```text
scope:
- 목표: (어떤 글을, 어떤 근거로, 어떤 독자에 대해 쓰는지)

assumptions:
- (필수 입력 데이터)
- (추가 가정)

risks:
- (사실 오류/추측 위험)
- (구조 누락 위험)

next_step:
- Writing: (tone/format 반영 포인트)
- Review: (검수 항목)
```
