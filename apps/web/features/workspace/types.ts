import type {
  AgentProvider,
  GenerationClarificationAnswer,
  GenerationClarificationQuestion,
  GenerationMeta,
  SourceType
} from "@velogen/shared";

type EditorMode = "edit" | "preview" | "split";

type GenerationMode = "new" | "refine";

interface SessionSummary {
  id: string;
  title: string;
  tone: string | null;
  format: string | null;
  provider: AgentProvider;
  updatedAt: string;
}

interface SessionSource {
  sourceId: string;
  name: string;
  type: SourceType;
}

interface PostSummary {
  id: string;
  title: string;
  provider: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

interface GeneratedPost {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  provider: string;
  createdAt: string;
  updatedAt: string;
  generationMeta?: GenerationMeta;
}

interface PostRevision {
  id: string;
  version: number;
  title: string;
  status: "draft" | "published";
  source: "generated" | "manual-edit";
  createdAt: string;
}

interface PostRevisionDetail extends PostRevision {
  body: string;
}

type WorkspacePanel = "session" | "sources" | "editor" | "posts";
type ToastKind = "info" | "success" | "error";

interface WorkspaceNavItem {
  key: WorkspacePanel;
  icon: string;
  label: string;
}

interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

interface GenerationConversationTurn {
  id: string;
  role: "agent" | "user";
  message: string;
  questions?: GenerationClarificationQuestion[];
  answers?: GenerationClarificationAnswer[];
}

export type {
  EditorMode,
  GenerationConversationTurn,
  GenerationMode,
  GeneratedPost,
  PostRevision,
  PostRevisionDetail,
  PostSummary,
  SessionSource,
  SessionSummary,
  WorkspaceNavItem,
  ToastKind,
  ToastMessage,
  WorkspacePanel
};
