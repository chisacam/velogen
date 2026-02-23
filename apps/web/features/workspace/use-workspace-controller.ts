"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentProvider,
  GenerationClarificationAnswer,
  GenerationClarificationContext,
  GenerationClarificationResponse,
  SourceSummary,
  BlogReviewResult
} from "@velogen/shared";
import { API_BASE, apiRequest } from "../../lib/api-client";
import { PERIOD_OPTIONS } from "./constants";
import type {
  EditorMode,
  GenerationConversationTurn,
  GenerationMode,
  GeneratedPost,
  PostRevision,
  PostRevisionDetail,
  PostSummary,
  SessionSource,
  SessionSummary,
  ToastKind,
  ToastMessage,
  WorkspaceNavItem,
  WorkspacePanel
} from "./types";
import { buildMarkdownFileName, extractTitleFromMarkdown, formatSourceDisplayValue } from "./utils";

const NAV_ITEMS: WorkspaceNavItem[] = [
  { key: "session", icon: "S", label: "Session" },
  { key: "sources", icon: "R", label: "Sources" },
  { key: "editor", icon: "E", label: "Editor" },
  { key: "posts", icon: "P", label: "Posts" },
];

const CLARIFICATION_CONVERSATION_STORAGE_KEY = "velogen:clarification-conversations:v2";

function buildConversationThreadKey(
  sessionId: string,
  postId: string | null,
  revisionId: string | null,
  mode: GenerationMode
): string {
  if (!sessionId) {
    return "";
  }

  if (mode === "new" || !postId) {
    return `${sessionId}:draft:new`;
  }

  return `${sessionId}:post:${postId}:revision:${revisionId ?? "head"}`;
}

function mergeConversationTurns(
  existing: GenerationConversationTurn[],
  incoming: GenerationConversationTurn[]
): GenerationConversationTurn[] {
  const byId = new Map<string, GenerationConversationTurn>();
  for (const turn of [...existing, ...incoming]) {
    byId.set(turn.id, turn);
  }
  return Array.from(byId.values());
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;

export function useWorkspaceController() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionSources, setSessionSources] = useState<SessionSource[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("split");
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("session");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [autoGenerateImages, setAutoGenerateImages] = useState(false);
  const [flashHeading, setFlashHeading] = useState(false);
  const [flashCitation, setFlashCitation] = useState(false);
  const [postTitleDraft, setPostTitleDraft] = useState("");
  const [postBodyDraft, setPostBodyDraft] = useState("");
  const [postStatusDraft, setPostStatusDraft] = useState<"draft" | "published">("draft");
  const [clarification, setClarification] = useState<GenerationClarificationResponse | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<GenerationClarificationAnswer[]>([]);
  const [clarificationConversation, setClarificationConversation] = useState<GenerationConversationTurn[]>([]);
  const [clarificationConversationByThread, setClarificationConversationByThread] = useState<Record<string, GenerationConversationTurn[]>>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<BlogReviewResult | null>(null);
  const [activeConversationThreadKey, setActiveConversationThreadKey] = useState("");
  const [revisions, setRevisions] = useState<PostRevision[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sessionTitle, setSessionTitle] = useState("Weekly Engineering Digest");
  const [tone, setTone] = useState("");
  const [format, setFormat] = useState("");
  const [provider, setProvider] = useState<AgentProvider>("mock");
  const [userInstruction, setUserInstruction] = useState("");
  const [generateMode, setGenerateMode] = useState<GenerationMode>("new");
  const [repoName, setRepoName] = useState("My Repo");
  const [repoPath, setRepoPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoMonths, setRepoMonths] = useState("3");
  const [repoCommitters, setRepoCommitters] = useState("");
  const [notionName, setNotionName] = useState("Product Notes");
  const [notionPageId, setNotionPageId] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [notionMonths, setNotionMonths] = useState("3");
  const [status, setStatus] = useState("Ready");
  const [genPanelOpen, setGenPanelOpen] = useState(true);

  const streamAbortRef = useRef<AbortController | null>(null);
  const previousHeadingCountRef = useRef(0);
  const previousCitationCountRef = useRef(0);
  const previousConversationThreadKeyRef = useRef("");
  const generationConversationThreadKeyRef = useRef("");

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const navItems = useMemo<WorkspaceNavItem[]>(() => NAV_ITEMS.slice(), []);

  const pushToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CLARIFICATION_CONVERSATION_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        return;
      }

      const normalized: Record<string, GenerationConversationTurn[]> = {};
      for (const [threadKey, turns] of Object.entries(parsed as Record<string, unknown>)) {
        if (!Array.isArray(turns)) {
          continue;
        }

        const validTurns = turns
          .map((turn) => {
            if (!turn || typeof turn !== "object") {
              return null;
            }

            const candidate = turn as Record<string, unknown>;
            const id = typeof candidate.id === "string" ? candidate.id : "";
            const role = candidate.role;

            if (!id || (role !== "agent" && role !== "user")) {
              return null;
            }

            if (role === "agent") {
              const message = typeof candidate.message === "string" ? candidate.message : "";
              const questions = Array.isArray(candidate.questions) ? candidate.questions : [];
              const normalizedQuestions = questions
                .map((question) => {
                  if (!question || typeof question !== "object") {
                    return null;
                  }
                  const item = question as Record<string, unknown>;
                  const questionId = typeof item.id === "string" ? item.id : "";
                  const questionText = typeof item.question === "string" ? item.question : "";
                  const rationale = typeof item.rationale === "string" ? item.rationale : undefined;
                  if (!questionId || !questionText) {
                    return null;
                  }
                  return {
                    id: questionId,
                    question: questionText,
                    ...(rationale ? { rationale } : {})
                  };
                })
                .filter((question): question is { id: string; question: string; rationale?: string } => question !== null);

              return {
                id,
                role,
                message,
                questions: normalizedQuestions
              } satisfies GenerationConversationTurn;
            }

            const answers = Array.isArray(candidate.answers) ? candidate.answers : [];
            const normalizedAnswers = answers
              .map((answer) => {
                if (!answer || typeof answer !== "object") {
                  return null;
                }
                const item = answer as Record<string, unknown>;
                const questionId = typeof item.questionId === "string" ? item.questionId : "";
                const question = typeof item.question === "string" ? item.question : "";
                const answerText = typeof item.answer === "string" ? item.answer : "";
                if (!questionId || !question || !answerText) {
                  return null;
                }
                return {
                  questionId,
                  question,
                  answer: answerText
                };
              })
              .filter((answer): answer is GenerationClarificationAnswer => answer !== null);

            return {
              id,
              role,
              answers: normalizedAnswers
            } satisfies GenerationConversationTurn;
          })
          .filter((turn): turn is GenerationConversationTurn => turn !== null);

        if (validTurns.length > 0) {
          normalized[threadKey] = validTurns;
        }
      }

      setClarificationConversationByThread(normalized);
    } catch {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        CLARIFICATION_CONVERSATION_STORAGE_KEY,
        JSON.stringify(clarificationConversationByThread)
      );
    } catch {
      // ignore storage write failures
    }
  }, [clarificationConversationByThread]);

  const appendConversationTurn = useCallback((turn: GenerationConversationTurn): void => {
    const threadKey = generationConversationThreadKeyRef.current || activeConversationThreadKey;
    if (!threadKey) {
      return;
    }

    setClarificationConversationByThread((current) => ({
      ...current,
      [threadKey]: [...(current[threadKey] ?? []), turn]
    }));
  }, [activeConversationThreadKey]);

  const clearConversationForCurrentThread = useCallback((): void => {
    if (!activeConversationThreadKey) {
      return;
    }

    setClarificationConversationByThread((current) => {
      if (!(activeConversationThreadKey in current)) {
        return current;
      }
      return {
        ...current,
        [activeConversationThreadKey]: []
      };
    });
  }, [activeConversationThreadKey]);

  const insertImagesIntoMarkdown = useCallback(
    (body: string, images: Array<{ sectionTitle: string; mimeType: string; base64: string }>): string => {
      let result = body;
      for (const img of images) {
        const escapedTitle = img.sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(^##\\s+${escapedTitle}.*$)`, "m");
        const dataUri = `data:${img.mimeType};base64,${img.base64}`;
        const imgMarkdown = `\n\n![${img.sectionTitle}](${dataUri})\n`;
        result = result.replace(regex, `$1${imgMarkdown}`);
      }
      return result;
    },
    []
  );

  const generateAndInsertImages = useCallback(
    async (body: string): Promise<string> => {
      setIsGeneratingImages(true);
      setStatus("Generating section images...");
      pushToast("Generating section images...", "info");
      try {
        const resp = await apiRequest<{ images: Array<{ sectionTitle: string; mimeType: string; base64: string }> }>(
          "/generate-blog-images",
          { method: "POST", body: JSON.stringify({ blogBody: body, maxImages: 3 }) }
        );
        if (resp.images.length > 0) {
          const enriched = insertImagesIntoMarkdown(body, resp.images);
          pushToast(`${resp.images.length} images generated`, "success");
          return enriched;
        }
        pushToast("No images generated (check GEMINI_API_KEY)", "info");
        return body;
      } catch (error) {
        pushToast(`Image generation failed: ${error instanceof Error ? error.message : "unknown error"}`, "error");
        return body;
      } finally {
        setIsGeneratingImages(false);
        setStatus("Ready");
      }
    },
    [insertImagesIntoMarkdown, pushToast]
  );

  const setPanel = useCallback((panel: WorkspacePanel) => {
    setActivePanel(panel);
  }, []);

  const refreshSources = useCallback(async (): Promise<void> => {
    const data = await apiRequest<SourceSummary[]>("/sources");
    setSources(data);
  }, []);

  const refreshSessions = useCallback(async (): Promise<void> => {
    const data = await apiRequest<SessionSummary[]>("/sessions");
    setSessions(data);
    if (!selectedSessionId && data.length > 0) {
      setSelectedSessionId(data[0].id);
    }
  }, [selectedSessionId]);

  const refreshSessionDetails = useCallback(async (sessionId: string): Promise<void> => {
    const [attachedSources, postList] = await Promise.all([
      apiRequest<SessionSource[]>(`/sessions/${sessionId}/sources`),
      apiRequest<PostSummary[]>(`/sessions/${sessionId}/posts`)
    ]);
    setSessionSources(attachedSources);
    setPosts(postList);

    if (postList.length > 0 && !selectedPostId) {
      setSelectedPostId(postList[0].id);
    }
    if (postList.length === 0) {
      setSelectedPostId("");
      setGeneratedPost(null);
      setPostTitleDraft("");
      setPostBodyDraft("");
      setPostStatusDraft("draft");
      setRevisions([]);
      setReviewResult(null);
    }
  }, [selectedPostId]);

  const loadPost = useCallback(async (sessionId: string, postId: string): Promise<void> => {
    const [post, revisionsData] = await Promise.all([
      apiRequest<GeneratedPost>(`/sessions/${sessionId}/posts/${postId}`),
      apiRequest<PostRevision[]>(`/sessions/${sessionId}/posts/${postId}/revisions`)
    ]);
    setGeneratedPost(post);
    setPostTitleDraft(post.title);
    setPostBodyDraft(post.body);
    setPostStatusDraft(post.status);
    setSelectedPostId(post.id);
    setActiveRevisionId(null);
    setRevisions(revisionsData);
    setReviewResult(post.reviewResult ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([refreshSources(), refreshSessions()]);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to initialize");
      }
    })();
  }, [refreshSessions, refreshSources]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionSources([]);
      setPosts([]);
      setClarification(null);
      setClarificationAnswers([]);
      setClarificationConversation([]);
      setActiveConversationThreadKey("");
      previousConversationThreadKeyRef.current = "";
      generationConversationThreadKeyRef.current = "";
      setActiveRevisionId(null);
      return;
    }

    void (async () => {
      try {
        await refreshSessionDetails(selectedSessionId);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to refresh session details");
      }
    })();
  }, [refreshSessionDetails, selectedSessionId]);

  useEffect(() => {
    const nextThreadKey = buildConversationThreadKey(
      selectedSessionId,
      selectedPostId || null,
      activeRevisionId,
      generateMode
    );
    setActiveConversationThreadKey(nextThreadKey);
  }, [activeRevisionId, generateMode, selectedPostId, selectedSessionId]);

  useEffect(() => {
    if (!activeConversationThreadKey) {
      setClarificationConversation([]);
      return;
    }

    const threadChanged = previousConversationThreadKeyRef.current !== activeConversationThreadKey;
    previousConversationThreadKeyRef.current = activeConversationThreadKey;

    if (threadChanged) {
      setClarification(null);
      setClarificationAnswers([]);
    }

    setClarificationConversation(clarificationConversationByThread[activeConversationThreadKey] ?? []);
  }, [activeConversationThreadKey, clarificationConversationByThread]);

  useEffect(() => {
    if (!selectedSessionId || !selectedPostId) {
      return;
    }

    void (async () => {
      try {
        await loadPost(selectedSessionId, selectedPostId);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load post");
      }
    })();
  }, [loadPost, selectedPostId, selectedSessionId]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }
    setTone(selectedSession.tone ?? "");
    setFormat(selectedSession.format ?? "");
    setProvider(selectedSession.provider ?? "mock");
  }, [selectedSession]);

  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const headingCount = (postBodyDraft.match(/^#{1,6}\s+/gm) ?? []).length;
    const citationCount = (postBodyDraft.match(/\[C\d+\]/g) ?? []).length;

    if (headingCount > previousHeadingCountRef.current) {
      setFlashHeading(true);
      setTimeout(() => setFlashHeading(false), 900);
    }

    if (citationCount > previousCitationCountRef.current) {
      setFlashCitation(true);
      setTimeout(() => setFlashCitation(false), 900);
    }

    previousHeadingCountRef.current = headingCount;
    previousCitationCountRef.current = citationCount;
  }, [postBodyDraft]);

  useEffect(() => {
    const extracted = extractTitleFromMarkdown(postBodyDraft);
    if (isGenerating || !extracted) {
      return;
    }
    setPostTitleDraft(extracted);
  }, [isGenerating, postBodyDraft]);

  const onCreateSession = useCallback(async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus("Creating session...");
    try {
      const created = await apiRequest<{ id: string; title: string }>("/sessions", {
        method: "POST",
        body: JSON.stringify({ title: sessionTitle })
      });
      await refreshSessions();
      setSelectedSessionId(created.id);
      setPanel("session");
      setStatus("Session created");
      pushToast("Session created", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create session");
    }
  }, [pushToast, refreshSessions, sessionTitle, setPanel]);

  const onCreateRepoSource = useCallback(async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus("Creating repo source...");
    try {
      await apiRequest<SourceSummary>("/sources", {
        method: "POST",
        body: JSON.stringify({
          name: repoName,
          type: "repo",
          repoConfig: {
            repoPath: repoPath || undefined,
            repoUrl: repoUrl || undefined,
            sinceMonths: Number.parseInt(repoMonths, 10) || 3,
            committers: repoCommitters
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
          }
        })
      });
      await refreshSources();
      setStatus("Repo source created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create repo source");
    }
  }, [refreshSources, repoCommitters, repoMonths, repoName, repoPath, repoUrl]);

  const onCreateNotionSource = useCallback(async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStatus("Creating notion source...");
    try {
      await apiRequest<SourceSummary>("/sources", {
        method: "POST",
        body: JSON.stringify({
          name: notionName,
          type: "notion",
          notionConfig: {
            pageId: notionPageId,
            token: notionToken,
            sinceMonths: Number.parseInt(notionMonths, 10) || 3
          }
        })
      });
      await refreshSources();
      setStatus("Notion source created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create notion source");
    }
  }, [notionMonths, notionName, notionPageId, notionToken, refreshSources]);

  const onAttachSource = useCallback(
    async (sourceId: string): Promise<void> => {
      if (!selectedSessionId) {
        setStatus("Create or select a session first");
        return;
      }

      setStatus("Attaching source...");
      try {
        await apiRequest<{ ok: true }>(`/sessions/${selectedSessionId}/sources/${sourceId}`, { method: "POST", body: "{}" });
        await refreshSessionDetails(selectedSessionId);
        setStatus("Source attached");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to attach source");
      }
    },
    [refreshSessionDetails, selectedSessionId]
  );

  const onDetachSource = useCallback(
    async (sourceId: string): Promise<void> => {
      if (!selectedSessionId) {
        return;
      }

      setStatus("Detaching source...");
      try {
        await apiRequest<{ ok: true }>(`/sessions/${selectedSessionId}/sources/${sourceId}`, { method: "DELETE" });
        await refreshSessionDetails(selectedSessionId);
        setStatus("Source removed from session");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to detach source");
      }
    },
    [refreshSessionDetails, selectedSessionId]
  );

  const onDeleteSource = useCallback(async (sourceId: string): Promise<void> => {
    setStatus("Deleting source...");
    try {
      await apiRequest<{ ok: true }>(`/sources/${sourceId}`, { method: "DELETE" });
      await refreshSources();
      if (selectedSessionId) {
        await refreshSessionDetails(selectedSessionId);
      }
      setStatus("Source deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete source");
    }
  }, [refreshSessionDetails, refreshSources, selectedSessionId]);

  const onSyncSource = useCallback(async (sourceId: string): Promise<void> => {
    if (!selectedSessionId) {
      setStatus("Select a session first");
      return;
    }
    setStatus("Syncing source...");
    try {
      const result = await apiRequest<{ ingested: number }>(`/sessions/${selectedSessionId}/sources/${sourceId}/sync`, {
        method: "POST",
        body: "{}"
      });
      setStatus(`Sync complete — ${result.ingested} items ingested`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to sync source");
    }
  }, [selectedSessionId]);

  const onDeleteSession = useCallback(async (): Promise<void> => {
    if (!selectedSessionId) {
      setStatus("Select a session first");
      return;
    }
    setStatus("Deleting session...");
    try {
      await apiRequest<{ ok: true }>(`/sessions/${selectedSessionId}`, { method: "DELETE" });
      setSelectedSessionId("");
      setSessionSources([]);
      setPosts([]);
      setGeneratedPost(null);
      setSelectedPostId("");
      await refreshSessions();
      setStatus("Session deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete session");
    }
  }, [refreshSessions, selectedSessionId]);

  const onUpdateConfig = useCallback(async (): Promise<void> => {
    if (!selectedSessionId) {
      setStatus("Create or select a session first");
      return;
    }

    setStatus("Updating generation config...");
    try {
      await apiRequest<{ ok: true }>(`/sessions/${selectedSessionId}/config`, {
        method: "PATCH",
        body: JSON.stringify({ tone: tone || undefined, format: format || undefined, provider })
      });
      await refreshSessions();
      setStatus("Generation config updated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update session config");
    }
  }, [format, provider, refreshSessions, selectedSessionId, tone]);

  const isGenerationClarificationResponse = useCallback(
    (response: GeneratedPost | GenerationClarificationResponse): response is GenerationClarificationResponse => {
      return "requiresClarification" in response && response.requiresClarification;
    },
    []
  );

  const normalizeClarificationAnswers = useCallback((answers: GenerationClarificationAnswer[]) => {
    const byQuestionId = new Map<string, GenerationClarificationAnswer>();

    for (const answer of answers) {
      const questionId = answer.questionId.trim();
      const question = answer.question.trim();

      if (!questionId || !question) {
        continue;
      }

      byQuestionId.set(questionId, {
        questionId,
        question,
        answer: answer.answer
      });
    }

    return Array.from(byQuestionId.values());
  }, []);

  const onClarificationAnswerChange = useCallback(
    (questionId: string, question: string, answer: string) => {
      setClarificationAnswers((prev) =>
        normalizeClarificationAnswers([
          ...prev,
          {
            questionId,
            question,
            answer
          }
        ])
      );
    },
    [normalizeClarificationAnswers]
  );

  const buildRetryClarificationContext = useCallback(
    (clarificationDraftAnswers?: GenerationClarificationAnswer[]): GenerationClarificationContext | undefined => {
      if (!clarification?.context) {
        return undefined;
      }

      const activeAnswers = normalizeClarificationAnswers(
        clarificationDraftAnswers ?? clarificationAnswers
      ).filter((a) => a.answer.trim().length > 0);

      return {
        ...clarification.context,
        answers: activeAnswers
      };
    },
    [clarification?.context, clarificationAnswers, normalizeClarificationAnswers]
  );

  const applyClarification = useCallback(
    (response: GenerationClarificationResponse) => {
      if (response.missing.some((item) => item.field === "tone") && tone.trim().length === 0) {
        setTone(response.defaults.tone);
      }

      if (response.missing.some((item) => item.field === "format") && format.trim().length === 0) {
        setFormat(response.defaults.format);
      }

      setClarification(response);
      setClarificationAnswers(normalizeClarificationAnswers(response.context?.answers ?? []));
      appendConversationTurn({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: "agent",
        message: response.message,
        questions: response.clarifyingQuestions ?? []
      });
      setStatus(response.message);
      pushToast(response.message, "info");
      setIsGenerating(false);
    },
    [
      appendConversationTurn,
      format,
      normalizeClarificationAnswers,
      pushToast,
      setFormat,
      setStatus,
      setTone,
      tone
    ]
  );

  const clearClarification = useCallback(() => {
    setClarification(null);
    setClarificationAnswers([]);
    setClarificationConversation([]);
    clearConversationForCurrentThread();
  }, [clearConversationForCurrentThread]);

  const onGenerate = useCallback(
    async (
      skipPreflight = false,
      clarificationContext?: GenerationClarificationContext
    ): Promise<void> => {
      if (!selectedSessionId) {
        setStatus("Create or select a session first");
        pushToast("Create or select a session first", "error");
        return;
      }

      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }

      const fallbackThreadKey = buildConversationThreadKey(
        selectedSessionId,
        selectedPostId || null,
        activeRevisionId,
        generateMode
      );
      generationConversationThreadKeyRef.current = activeConversationThreadKey || fallbackThreadKey;

      setPanel("editor");
      setIsGenerating(true);
      if (!clarificationContext) {
        setClarification(null);
        setClarificationAnswers([]);
      }
      setStatus("Generating blog post...");
      pushToast("Generation started", "info");

      const requestBody = {
        provider,
        tone: tone || undefined,
        format: format || undefined,
        userInstruction: userInstruction || undefined,
        refinePostId: generateMode === "refine" && selectedPostId ? selectedPostId : undefined,
        generateImage: autoGenerateImages,
        skipPreflight,
        clarificationContext
      };

      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      try {
        const response = await fetch(`${API_BASE}/sessions/${selectedSessionId}/generate/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: abortController.signal
        });

        if (!response.ok || !response.body) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completed = false;
        let receivedChunk = false;

        while (!completed) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) {
              continue;
            }

            const jsonStr = trimmed.slice(6);
            if (!jsonStr) {
              continue;
            }

            try {
              const payload = JSON.parse(jsonStr) as
                | { type: "status"; message: string }
                | { type: "chunk"; chunk: string }
                | { type: "complete"; post: GeneratedPost | GenerationClarificationResponse }
                | { type: "error"; message: string };

              if (payload.type === "status") {
                setStatus(payload.message);
              } else if (payload.type === "chunk") {
                if (!receivedChunk) {
                  receivedChunk = true;
                  setGeneratedPost(null);
                  setSelectedPostId("");
                  setActiveRevisionId(null);
                  setPostStatusDraft("draft");
                  setPostTitleDraft(selectedSession?.title ?? "Streaming Draft");
                  setPostBodyDraft(payload.chunk);
                } else {
                  setPostBodyDraft((current) => current + payload.chunk);
                }
              } else if (payload.type === "complete") {
                completed = true;
                const post = payload.post;

                if (isGenerationClarificationResponse(post)) {
                  applyClarification(post);
                } else {
                  setClarification(null);
                  setClarificationAnswers([]);
                  setGeneratedPost(post);
                  setSelectedPostId(post.id);
                  setActiveRevisionId(null);
                  setPostTitleDraft(post.title);
                  setPostBodyDraft(post.body);
                  setPostStatusDraft(post.status);

                  const sourceThreadKey = generationConversationThreadKeyRef.current;
                  const targetThreadKey = buildConversationThreadKey(selectedSessionId, post.id, null, "refine");
                  generationConversationThreadKeyRef.current = targetThreadKey;
                  if (sourceThreadKey && sourceThreadKey !== targetThreadKey) {
                    setClarificationConversationByThread((current) => {
                      const sourceTurns = current[sourceThreadKey] ?? [];
                      if (sourceTurns.length === 0) {
                        return current;
                      }
                      const targetTurns = current[targetThreadKey] ?? [];
                      return {
                        ...current,
                        [targetThreadKey]: mergeConversationTurns(targetTurns, sourceTurns)
                      };
                    });
                  }

                  setStatus("Blog post generated");
                  pushToast("Blog post generated", "success");
                  void refreshSessionDetails(selectedSessionId);
                  if (autoGenerateImages) {
                    void (async () => {
                      const enriched = await generateAndInsertImages(post.body);
                      setPostBodyDraft(enriched);
                    })();
                  }
                }
              } else if (payload.type === "error") {
                completed = true;
                setStatus(payload.message);
                pushToast(payload.message, "error");
              }
            } catch {
              // malformed SSE line, skip
            }
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to generate";
        setStatus(message);
        pushToast(message, "error");
      } finally {
        streamAbortRef.current = null;
        setIsGenerating(false);
      }
    }, [
    activeConversationThreadKey,
    activeRevisionId,
    autoGenerateImages,
    format,
    generateAndInsertImages,
    generateMode,
    provider,
    pushToast,
    isGenerationClarificationResponse,
    applyClarification,
    refreshSessionDetails,
    selectedPostId,
    selectedSession?.title,
    selectedSessionId,
    setPanel,
    tone,
    userInstruction
  ]);

  const retryAfterClarification = useCallback(
    async (clarificationDraftAnswers?: GenerationClarificationAnswer[]): Promise<void> => {
      const submittedAnswers = normalizeClarificationAnswers(clarificationDraftAnswers ?? clarificationAnswers);
      if (submittedAnswers.length > 0) {
        appendConversationTurn({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "user",
          answers: submittedAnswers
        });
      }

      const context = buildRetryClarificationContext(submittedAnswers);
      await onGenerate(true, context);
    },
    [appendConversationTurn, buildRetryClarificationContext, clarificationAnswers, normalizeClarificationAnswers, onGenerate]
  );

  const onSavePost = useCallback(async (): Promise<void> => {
    if (!selectedSessionId || !selectedPostId) {
      setStatus("Select a post first");
      return;
    }

    setStatus("Saving markdown draft...");
    try {
      const updated = await apiRequest<GeneratedPost>(`/sessions/${selectedSessionId}/posts/${selectedPostId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: postTitleDraft, body: postBodyDraft, status: postStatusDraft })
      });
      setGeneratedPost(updated);
      await refreshSessionDetails(selectedSessionId);
      await loadPost(selectedSessionId, selectedPostId);
      setPanel("editor");
      setStatus("Draft saved");
      pushToast("Draft saved", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save post";
      setStatus(message);
      pushToast(message, "error");
    }
  }, [
    loadPost,
    postBodyDraft,
    postStatusDraft,
    postTitleDraft,
    pushToast,
    refreshSessionDetails,
    selectedPostId,
    selectedSessionId,
    setPanel
  ]);

  const onReviewPost = useCallback(async (): Promise<void> => {
    if (!selectedSessionId || !selectedPostId) {
      pushToast("Select a post first to review", "error");
      return;
    }

    setIsReviewing(true);
    setStatus("Reviewing your post...");
    pushToast("Started post review", "info");

    try {
      const result = await apiRequest<BlogReviewResult>(`/sessions/${selectedSessionId}/generate/${selectedPostId}/review`, {
        method: "POST"
      });

      setReviewResult(result);
      setStatus("Post review completed");
      pushToast("Review completed", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to review post";
      setStatus(message);
      pushToast(message, "error");
    } finally {
      setIsReviewing(false);
    }
  }, [selectedSessionId, selectedPostId, pushToast]);

  const onApplySuggestion = useCallback((suggestionIndex: number): void => {
    if (!reviewResult) {
      return;
    }
    const suggestion = reviewResult.suggestions[suggestionIndex];
    if (!suggestion) {
      return;
    }

    const newDraft = postBodyDraft.replace(suggestion.originalText, suggestion.suggestedText);

    if (newDraft === postBodyDraft) {
      pushToast("Could not find the exact original text. The text may have already been changed.", "error");
      return;
    }

    setPostBodyDraft(newDraft);
    pushToast("Suggestion applied to original text", "success");
  }, [reviewResult, postBodyDraft, pushToast]);

  const onExportMarkdown = (): void => {
    if (!postBodyDraft) {
      pushToast("No content to export", "error");
      return;
    }

    const title = postTitleDraft || "untitled";
    const fileName = buildMarkdownFileName(title);
    const blob = new Blob([postBodyDraft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast(`Exported: ${fileName}`, "success");
  };

  const onLoadRevision = useCallback(
    async (revisionId: string): Promise<void> => {
      if (!selectedSessionId || !selectedPostId) {
        setStatus("Select a post first");
        return;
      }

      setStatus("Loading revision into editor...");
      try {
        const revision = await apiRequest<PostRevisionDetail>(
          `/sessions/${selectedSessionId}/posts/${selectedPostId}/revisions/${revisionId}`
        );
        setPostTitleDraft(revision.title);
        setPostBodyDraft(revision.body);
        setPostStatusDraft(revision.status);
        setActiveRevisionId(revision.id);
        setPanel("editor");
        setStatus(`Loaded revision v${revision.version}. Save to apply rollback.`);
        pushToast(`Loaded revision v${revision.version}`, "info");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load revision");
      }
    },
    [selectedPostId, selectedSessionId, pushToast, setPanel]
  );

  const selectPost = useCallback(
    (postId: string) => {
      setActiveRevisionId(null);
      setSelectedPostId(postId);
      setPanel("editor");
    },
    [setPanel]
  );

  const onFormatSourceDisplay = useCallback((source: SourceSummary): string => {
    return formatSourceDisplayValue(source);
  }, []);

  return {
    sources,
    sessions,
    selectedSessionId,
    sessionSources,
    posts,
    generatedPost,
    selectedPostId,
    editorMode,
    activePanel,
    isGenerating,
    isGeneratingImages,
    autoGenerateImages,
    isReviewing,
    reviewResult,
    flashHeading,
    flashCitation,
    postTitleDraft,
    postBodyDraft,
    postStatusDraft,
    revisions,
    toasts,
    sessionTitle,
    tone,
    format,
    provider,
    userInstruction,
    generateMode,
    repoName,
    repoPath,
    repoUrl,
    repoMonths,
    repoCommitters,
    notionName,
    notionPageId,
    notionToken,
    notionMonths,
    status,
    genPanelOpen,
    clarification,
    clarificationAnswers,
    clarificationConversation,
    navItems,
    selectedSession,
    PERIOD_OPTIONS,

    pushToast,
    setPanel,
    setEditorMode,
    setActivePanel,
    setAutoGenerateImages,
    setSessionTitle,
    setTone,
    setFormat,
    setProvider,
    setUserInstruction,
    setGenerateMode,
    setPostStatusDraft,
    setPostTitleDraft,
    setPostBodyDraft,
    setGeneratedPost,
    setGenPanelOpen,
    setSelectedSessionId,
    setRepoName,
    setRepoPath,
    setRepoUrl,
    setRepoMonths,
    setRepoCommitters,
    setNotionName,
    setNotionPageId,
    setNotionToken,
    setNotionMonths,

    onCreateSession,
    onCreateRepoSource,
    onCreateNotionSource,
    onAttachSource,
    onDetachSource,
    onDeleteSource,
    onSyncSource,
    onDeleteSession,
    onUpdateConfig,
    onGenerate,
    onRetryAfterClarification: retryAfterClarification,
    onClarificationAnswerChange,
    onClearClarification: clearClarification,
    onReviewPost,
    onApplySuggestion,
    setReviewResult,
    onSavePost,
    onExportMarkdown,
    onLoadRevision,
    selectPost,
    onFormatSourceDisplay
  };
}
