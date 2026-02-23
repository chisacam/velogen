# API 개요

**Sources**
- `GET /sources` 소스 목록
- `POST /sources` 소스 생성(repo/notion)
- `DELETE /sources/:sourceId` 소스 삭제

**Sessions**
- `GET /sessions` 세션 목록
- `POST /sessions` 세션 생성
- `DELETE /sessions/:sessionId` 세션 삭제
- `PATCH /sessions/:sessionId/config` 세션 tone/format/provider 설정

**Session Sources**
- `GET /sessions/:sessionId/sources` 세션에 연결된 소스 목록
- `POST /sessions/:sessionId/sources/:sourceId` 세션에 소스 연결
- `DELETE /sessions/:sessionId/sources/:sourceId` 세션에서 소스 제거
- `POST /sessions/:sessionId/sources/:sourceId/sync` 소스 수집 실행

**Generation**
- `POST /sessions/:sessionId/generate` 블로그 대기열 생성 (비동기)
- `POST /sessions/:sessionId/generate/stream` 블로그 생성 (Streaming)
- `GET /sessions/:sessionId/generate/stream` 블로그 생성 상태 스트리밍 SSE
- `POST /sessions/:sessionId/generate/:postId/review` 생성된 글 리뷰/피드백 반영

**Posts & Revisions**
- `GET /sessions/:sessionId/posts` 생성된 글 목록
- `GET /sessions/:sessionId/posts/:postId` 생성 글 단건 조회
- `PATCH /sessions/:sessionId/posts/:postId` Markdown 본문/제목/상태 등 수정 저장
- `GET /sessions/:sessionId/posts/:postId/revisions` 특정 글의 revision 히스토리 조회
- `GET /sessions/:sessionId/posts/:postId/revisions/:revisionId` 특정 revision 본문 조회 (롤백용)

**Images**
- `POST /generate-image` 단일 이미지 생성
- `POST /generate-blog-images` 블로그용 다중 이미지 생성

---

UI에서는 revision의 `Load` 버튼으로 과거 버전을 에디터에 불러온 뒤, `Save Markdown`을 눌러 현재 draft에 롤백 반영할 수 있습니다.

또한 post 상세에는 생성 시점의 `Generation Context`(사용 instruction, 사용된 소스, 옵션)가 함께 표시됩니다.
