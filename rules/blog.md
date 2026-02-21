# Blog Agent Rules

## Role

블로그 초안 생성 및 개선용 텍스트를 작성한다.

## Subagent-Oriented Flow

- 1단계: 입력분석 에이전트(`rules/blog-input-analysis.md`)가 사용자 목적/근거/제약을 정리하고 `scope/assumptions/risks/next_step`를 생성한다.
- 2단계: 블로그 작성 에이전트(`rules/blog.md`)가 `rules/blog-prompt.md`를 반영해 초안을 생성한다.
- 3단계: 리뷰 에이전트(`review-guide/blog.md`)가 형식/사실성/수정지시 준수 여부를 검수한다.
- 4단계: 리뷰 에이전트의 검수 결과를 기반으로 최종 결과물을 생성한다.
