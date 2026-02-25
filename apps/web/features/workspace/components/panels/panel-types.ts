import type { AgentProvider, GenerationClarificationAnswer, GenerationClarificationResponse, SourceSummary, BlogReviewResult } from "@velogen/shared";
import type { FormEvent } from "react";

import type {
  EditorMode,
  GenerationConversationTurn,
  GenerationMode,
  GeneratedPost,
  PostRevision,
  PostSummary,
  SessionSource,
  SessionSummary,
  ToastMessage,
  WorkspacePanel,
  WorkspaceNavItem
} from "../../types";

type PeriodOption = {
  label: string;
  value: string;
};

export type WorkspaceSidebarProps = {
  activePanel: WorkspacePanel;
  navItems: WorkspaceNavItem[];
  sessionSources: SessionSource[];
  posts: PostSummary[];
  generatedPost: GeneratedPost | null;
  selectedPostId: string;
  revisions: PostRevision[];
  onLoadRevision: (revisionId: string) => Promise<void>;
  selectedSession: SessionSummary | null;
  setPanel: (panel: WorkspacePanel) => void;
};

export type WorkspaceHeaderProps = {
  activePanel: WorkspacePanel;
  postTitleDraft: string;
};

export type ToastStackProps = {
  toasts: ToastMessage[];
};

export type SessionPanelProps = {
  sessionTitle: string;
  setSessionTitle: (title: string) => void;
  onCreateSession: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  selectedSessionId: string;
  setSelectedSessionId: (sessionId: string) => void;
  sessions: SessionSummary[];
  tone: string;
  setTone: (tone: string) => void;
  format: string;
  setFormat: (format: string) => void;
  provider: AgentProvider;
  setProvider: (provider: AgentProvider) => void;
  selectedSession: SessionSummary | null;
  onUpdateConfig: () => Promise<void>;
  onDeleteSession: () => Promise<void>;
};

export type SourcesPanelProps = {
  sources: SourceSummary[];
  sessionSources: SessionSource[];
  repoName: string;
  setRepoName: (name: string) => void;
  repoPath: string;
  setRepoPath: (path: string) => void;
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  repoMonths: string;
  setRepoMonths: (months: string) => void;
  repoCommitters: string;
  setRepoCommitters: (committers: string) => void;
  notionName: string;
  setNotionName: (name: string) => void;
  notionPageId: string;
  setNotionPageId: (id: string) => void;
  notionToken: string;
  setNotionToken: (token: string) => void;
  notionMonths: string;
  setNotionMonths: (months: string) => void;
  PERIOD_OPTIONS: readonly PeriodOption[];
  onCreateRepoSource: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateNotionSource: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAttachSource: (sourceId: string) => Promise<void>;
  onDetachSource: (sourceId: string) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onSyncSource: (sourceId: string) => Promise<void>;
  onFormatSourceDisplay: (source: SourceSummary) => string;
};

export type EditorPanelProps = GenerationPanelProps & {
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  setPostBodyDraft: (body: string) => void;
  flashHeading: boolean;
  flashCitation: boolean;
  clarification: GenerationClarificationResponse | null;
  clarificationAnswers: GenerationClarificationAnswer[];
  clarificationConversation: GenerationConversationTurn[];
  onClarificationAnswerChange: (questionId: string, question: string, answer: string) => void;
  onRetryAfterClarification: (clarificationDraftAnswers?: GenerationClarificationAnswer[], forceSkip?: boolean) => Promise<void>;
  onClearClarification: () => void;
  isReviewing: boolean;
  reviewResult: BlogReviewResult | null;
  onReviewPost: () => Promise<void>;
  onApplySuggestion: (index: number) => void;
  setReviewResult: (result: BlogReviewResult | null) => void;
  refinedPostBody: string | null;
  setRefinedPostBody: (body: string | null) => void;
};

export type PostsPanelProps = {
  posts: PostSummary[];
  selectPost: (postId: string) => void;
};

export type GenerationPanelProps = {
  genPanelOpen: boolean;
  setGenPanelOpen: (open: boolean) => void;
  generateMode: GenerationMode;
  setGenerateMode: (mode: GenerationMode) => void;
  postStatusDraft: "draft" | "published";
  setPostStatusDraft: (status: "draft" | "published") => void;
  autoGenerateImages: boolean;
  setAutoGenerateImages: (enabled: boolean) => void;
  isGenerating: boolean;
  isGeneratingImages: boolean;
  onGenerate: () => Promise<void>;
  onSavePost: () => Promise<void>;
  onExportMarkdown: () => void;
  userInstruction: string;
  setUserInstruction: (instruction: string) => void;
  generatedPost: GeneratedPost | null;
  selectedPostId: string;
  postBodyDraft: string;
  tone: string;
  setTone: (tone: string) => void;
  format: string;
  setFormat: (format: string) => void;
};
