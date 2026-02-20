export type SourceType = "repo" | "notion";

/**
 * AI 에이전트 프로바이더 타입
 * - mock: 로컬 목 생성 (의존성 없음)
 * - claude: Anthropic Claude Code CLI (`claude --print`)
 * - codex: OpenAI Codex CLI (`codex --approval-mode full-auto`)
 * - opencode: Opencode CLI (`opencode run`)
 * - gemini: Google Gemini CLI (`gemini`)
 */
export type AgentProvider = "mock" | "claude" | "codex" | "opencode" | "gemini";

export interface RepoSourceConfig {
  repoUrl?: string;
  repoPath?: string;
  sinceMonths?: number;
  committers?: string[];
}

export interface NotionSourceConfig {
  pageId: string;
  token: string;
  sinceMonths?: number;
  authors?: string[];
}

export interface CreateSourceDto {
  name: string;
  type: SourceType;
  repoConfig?: RepoSourceConfig;
  notionConfig?: NotionSourceConfig;
}

export interface SourceSummary {
  id: string;
  name: string;
  type: SourceType;
  active: boolean;
  createdAt: string;
  config?: RepoSourceConfig | NotionSourceConfig;
}

export interface CreateSessionDto {
  title: string;
}

export interface UpdateSessionConfigDto {
  tone?: string;
  format?: string;
  provider?: AgentProvider;
}

export interface GenerateBlogDto {
  provider?: AgentProvider;
  tone?: string;
  format?: string;
  /** 에이전트에게 전달할 추가 지시사항 (선택) */
  userInstruction?: string;
  /**
   * 지정하면 해당 포스트를 바탕으로 수정(refine) 모드로 생성합니다.
   * 미지정 시 소스 데이터를 기반으로 새 글을 작성합니다.
   */
  refinePostId?: string;
  /** 본문 생성 후 이미지를 자동으로 생성할지 여부 */
  generateImage?: boolean;
}

/** 블로그 포스트 생성 시 기록되는 메타데이터 */
export interface GenerationMeta {
  provider: string;
  tone?: string;
  format?: string;
  userInstruction?: string;
  refinePostId?: string;
  generateImage?: boolean;
  /** 생성 시점에 사용된 소스 스냅샷 */
  sources: Array<{ sourceId: string; name: string; type: string }>;
}

export interface BlogPostResult {
  id: string;
  title: string;
  body: string;
  provider: AgentProvider;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  generationMeta?: GenerationMeta;
}
