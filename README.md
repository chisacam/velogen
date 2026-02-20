# velogen

Next.js + NestJS + SQLite 기반으로, 커밋 히스토리와 Notion 콘텐츠를 읽어 블로그 글을 생성하는 로컬 우선 프로젝트입니다.

## 핵심 기능

- Repo 소스 등록: 기간(기본 3개월), 커미터 필터(기본 전체) 기반 커밋 수집
- Notion 소스 등록: 페이지 내용 수집, 기간(기본 3개월) 기반 필터
- 세션 기반 작업: 소스를 세션에 붙였다/뗐다 하면서 생성 컨텍스트를 동적으로 조합
- 블로그 생성: 연결된 모든 소스를 재수집 후 하나의 프롬프트로 합쳐 글 생성
- 옵션 지정: 글 형식(format), 문체/톤(tone), 에이전트(provider)를 세션별로 저장/복원
- 실시간 생성: SSE 기반 스트리밍으로 생성 중 텍스트를 에디터에 실시간 반영
- Markdown Draft Studio: 생성된 글을 Markdown으로 미리보기/수정/저장
- UI 워크스페이스: 좌측 메뉴바(Session/Sources/Posts/Editor) + 우측 편집/미리보기 영역
- Toast 피드백: 생성/저장/오류 상태를 상단 토스트로 표시
- Revision 저장: 생성본과 수정본을 버전 이력으로 DB에 기록
- 회고형 생성 품질(P1): 타임라인/테마/근거 인용 중심 프롬프트로 구조화
- Refinement (재생성): 기존 생성된 글을 기반으로 사용자 지시사항(instruction)을 반영하여 수정/보완
- 수집 품질 강화(P2): 텍스트 정규화, 저신호 항목 필터링, 배치 중복 제거(fingerprint)
- Generation Context 저장: 생성 시점의 provider/tone/format/instruction/refinePostId/소스 스냅샷을 post에 함께 저장
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

## API 개요

- `POST /sources` 소스 생성(repo/notion)
- `GET /sources` 소스 목록
- `DELETE /sources/:sourceId` 소스 삭제
- `POST /sessions` 세션 생성
- `GET /sessions` 세션 목록
- `PATCH /sessions/:sessionId/config` 세션 tone/format/provider 설정
- `POST /sessions/:sessionId/sources/:sourceId` 세션에 소스 연결
- `DELETE /sessions/:sessionId/sources/:sourceId` 세션에서 소스 제거
- `POST /sessions/:sessionId/sources/:sourceId/sync` 소스 수집 실행
- `POST /sessions/:sessionId/generate` 블로그 생성 (provider/tone/format/userInstruction/refinePostId)
- `GET /sessions/:sessionId/generate/stream` 블로그 생성 (Streaming)
- `GET /sessions/:sessionId/posts` 생성된 글 목록
- `GET /sessions/:sessionId/posts/:postId` 생성 글 단건 조회
- `PATCH /sessions/:sessionId/posts/:postId` Markdown 본문/제목/상태 수정 저장
- `GET /sessions/:sessionId/posts/:postId/revisions` revision 히스토리 조회
- `GET /sessions/:sessionId/posts/:postId/revisions/:revisionId` 특정 revision 본문 조회(롤백용 로드)

UI에서는 revision의 `Load` 버튼으로 과거 버전을 에디터에 불러온 뒤, `Save Markdown`을 눌러 현재 draft에 롤백 반영할 수 있습니다.

또한 post 상세에는 생성 시점의 `Generation Context`(사용 instruction, 사용된 소스, 옵션)가 함께 표시됩니다.

## 요구사항 매핑

- 커밋/Notion 단일 또는 혼합 입력 지원
- 입력 소스 중간 추가/제거 지원
- 기본 기간 3개월
- 기본 작성자 필터 없음
- SQLite 저장소 사용
- 터미널 에이전트/MCP 연동 가능한 생성 파이프라인 지원
