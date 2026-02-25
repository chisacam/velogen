# Velogen

Velogen(벨로젠)은 개발자의 기여 이력(Commit History)과 작업 노트(Notion)를 바탕으로, 자동으로 기술 블로그 포스트 초안을 작성해 주는 AI 기반 로컬 우선(Local-first) 애플리케이션입니다.
Next.js, NestJS, SQLite 환경을 기반으로 구축되었으며, 주요 AI 모델(Claude, Gemini 등)과 연동하여 사용자의 작업 맥락을 풍부하게 반영한 글을 생성합니다.
단순한 텍스트 생성을 넘어, 세션 기반의 컨텍스트 관리, 실시간 마크다운 스트리밍, 그리고 생성된 초안의 버전 관리(Revision)까지 지원하여 기술 블로그 작성의 생산성을 향상시킵니다.

## 주요 기능

- **다양한 지식 소스 연동**: GitHub 리포지토리(커밋 히스토리) 및 Notion 페이지 내용을 수집하여 블로그 작성 자료로 활용
- **세션 기반 컨텍스트 관리**: 생성할 블로그 글의 목적에 맞게 필요한 소스만 선택하여 작업 세션을 구성
- **맞춤형 AI 블로그 글 생성**: 포스트 형식, 문체, 생성에 사용할 AI 에이전트를 세션별로 설정해 글을 생성하고 개선(Refinement)
- **실시간 스트리밍 생성**: SSE(Server-Sent Events)를 통해 에디터에서 AI의 글 생성 과정을 실시간으로 확인 및 반영
- **자체 통합 에디터 내장**: 생성된 마크다운(Markdown) 초안을 바로 수정하고, 버전을 관리(Revision)할 수 있는 통합 에디터 지원
- **로컬 기반의 독립적 동작**: 메타데이터와 결과물은 로컬 SQLite DB에 안전하게 저장하여 외부 의존성을 최소화

## AI 에이전트 가이드

- 에이전트 운영 규칙(한글): [`AGENTS.md`](./AGENTS.md)
- Agent operating rules (English): [`AGENTS.en.md`](./AGENTS.en.md)
- 리팩토링 진행 요약: [`docs/refactor-report.md`](./docs/refactor-report.md)
- 에이전트 룰 문서(역할별): [`rules/code.md`](./rules/code.md), [`rules/code-analysis.md`](./rules/code-analysis.md), [`rules/blog-clarification.md`](./rules/blog-clarification.md), [`rules/blog.md`](./rules/blog.md), [`rules/blog-prompt.md`](./rules/blog-prompt.md), [`rules/code-review.md`](./rules/code-review.md), [`rules/blog-review.md`](./rules/blog-review.md)
- 리뷰 템플릿: [`review-guide/code.md`](./review-guide/code.md), [`review-guide/blog.md`](./review-guide/blog.md)

## 모노레포 구조

- `apps/api`: NestJS API
- `apps/web`: Next.js UI
- `packages/shared`: 공용 타입

## 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

- API: `http://localhost:4000`
- WEB: `http://localhost:3000`

## 데스크톱 배포(Electron)

비개발자도 실행 파일만으로 사용할 수 있도록 Electron 패키징을 지원합니다.

- 개발 모드(웹+API+Electron 동시 실행):

```bash
npm run dev:desktop
```

- 데스크톱 배포 빌드(웹 정적 export + API dist + Electron 패키징):

```bash
npm run build:desktop
```

산출물은 `apps/desktop/dist`에 생성됩니다.

배포 앱 동작 방식:
- 웹은 정적 export(`apps/web/out`)를 로드
- API는 앱 내부에서 로컬 프로세스로 실행(`PORT=4000`)
- SQLite는 사용자 전용 경로(`app.getPath('userData')`)에 저장

macOS(Apple Silicon)에서 `7za` 관련 오류가 나면 아래를 먼저 설치하세요.

```bash
brew install p7zip
```

## AI 에이전트 연동

지원 provider: `mock`, `claude`, `codex`, `opencode`, `gemini`

- `mock`: 의존성 없이 로컬 생성
- `claude`: `CLAUDE_COMMAND` / `CLAUDE_MODEL`
- `codex`: `CODEX_COMMAND` / `CODEX_MODEL`
- `opencode`: `OPENCODE_COMMAND` / `OPENCODE_MODEL`
- `gemini`: `GEMINI_COMMAND` / `GEMINI_MODEL`

상세 환경변수 예시는 `apps/api/.env.example` 참고.

## API 문서

백엔드 서버 API 목록과 설명은 [`API.md`](./API.md) 문서를 참고해 주세요.
