import type { AgentProvider, GenerationMeta, SourceType } from "@velogen/shared";

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

interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

export type {
  GeneratedPost,
  PostRevision,
  PostRevisionDetail,
  PostSummary,
  SessionSource,
  SessionSummary,
  ToastKind,
  ToastMessage,
  WorkspacePanel
};
