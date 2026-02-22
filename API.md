# API 개요

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
