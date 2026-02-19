# velogen

Next.js + NestJS + SQLite 기반으로, 커밋 히스토리와 Notion 콘텐츠를 읽어 블로그 글을 생성하는 로컬 우선 프로젝트입니다.

## 핵심 기능

- Repo 소스 등록: 기간(기본 3개월), 커미터 필터(기본 전체) 기반 커밋 수집
- Notion 소스 등록: 페이지 내용 수집, 기간(기본 3개월) 기반 필터
- 세션 기반 작업: 소스를 세션에 붙였다/뗐다 하면서 생성 컨텍스트를 동적으로 조합
- 블로그 생성: 연결된 모든 소스를 재수집 후 하나의 프롬프트로 합쳐 글 생성
- 옵션 지정: 글 형식(format)과 문체/톤(tone)을 세션별 또는 생성 요청별로 지정
- Markdown Draft Studio: 생성된 글을 Markdown으로 미리보기/수정/저장
- Revision 저장: 생성본과 수정본을 버전 이력으로 DB에 기록
- 회고형 생성 품질(P1): 타임라인/테마/근거 인용 중심 프롬프트로 구조화
- 수집 품질 강화(P2): 텍스트 정규화, 저신호 항목 필터링, 배치 중복 제거(fingerprint)
- 로컬 DB: SQLite(`better-sqlite3`) 사용

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

## AI 에이전트 연동

생성 provider를 `terminal-agent`로 선택하면, API는 지정된 터미널 커맨드를 실행해 결과를 받아옵니다.

- `AGENT_COMMAND`: 실행할 바이너리(예: `codex`, `opencode`, `claude` 또는 MCP 브리지 명령)
- `AGENT_ARGS`: 공백 구분 인자
- API는 `VELOGEN_PROMPT` 환경변수로 생성 프롬프트를 전달

예시:

```bash
AGENT_COMMAND=codex AGENT_ARGS="run --plain" npm run dev:api
```

에이전트가 없으면 자동으로 로컬 mock 생성기를 사용합니다.

## API 개요

- `POST /sources` 소스 생성(repo/notion)
- `GET /sources` 소스 목록
- `DELETE /sources/:sourceId` 소스 삭제
- `POST /sessions` 세션 생성
- `GET /sessions` 세션 목록
- `PATCH /sessions/:sessionId/config` 세션 tone/format 설정
- `POST /sessions/:sessionId/sources/:sourceId` 세션에 소스 연결
- `DELETE /sessions/:sessionId/sources/:sourceId` 세션에서 소스 제거
- `POST /sessions/:sessionId/sources/:sourceId/sync` 소스 수집 실행
- `POST /sessions/:sessionId/generate` 블로그 생성
- `GET /sessions/:sessionId/posts` 생성된 글 목록
- `GET /sessions/:sessionId/posts/:postId` 생성 글 단건 조회
- `PATCH /sessions/:sessionId/posts/:postId` Markdown 본문/제목/상태 수정 저장
- `GET /sessions/:sessionId/posts/:postId/revisions` revision 히스토리 조회
- `GET /sessions/:sessionId/posts/:postId/revisions/:revisionId` 특정 revision 본문 조회(롤백용 로드)

UI에서는 revision의 `Load` 버튼으로 과거 버전을 에디터에 불러온 뒤, `Save Markdown`을 눌러 현재 draft에 롤백 반영할 수 있습니다.

## 요구사항 매핑

- 커밋/Notion 단일 또는 혼합 입력 지원
- 입력 소스 중간 추가/제거 지원
- 기본 기간 3개월
- 기본 작성자 필터 없음
- SQLite 저장소 사용
- 터미널 에이전트/MCP 연동 가능한 생성 파이프라인 지원
