export type SourceType = "repo" | "notion";

/**
 * AI 에이전트 프로바이더 타입
 * - mock: 로컬 목 생성 (의존성 없음)
 * - claude: Anthropic Claude Code CLI (`claude --print`)
 * - codex: OpenAI Codex CLI (`codex --approval-mode full-auto`)
 * - opencode: Opencode CLI (`opencode run`)
 */
export type AgentProvider = "mock" | "claude" | "codex" | "opencode";

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
}

export interface CreateSessionDto {
  title: string;
}

export interface UpdateSessionConfigDto {
  tone?: string;
  format?: string;
}

export interface GenerateBlogDto {
  provider?: AgentProvider;
  tone?: string;
  format?: string;
}

export interface BlogPostResult {
  id: string;
  title: string;
  body: string;
  provider: AgentProvider;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

