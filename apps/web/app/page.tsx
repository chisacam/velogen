"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentProvider, SourceSummary } from "@velogen/shared";
import { MarkdownEditor } from "../components/markdown-editor";
import { MarkdownViewer } from "../components/markdown-viewer";
import { apiRequest, API_BASE } from "../lib/api-client";
import { PERIOD_OPTIONS } from "../features/workspace/constants";
import type {
  GeneratedPost,
  PostRevision,
  PostRevisionDetail,
  PostSummary,
  SessionSource,
  SessionSummary,
  ToastKind,
  ToastMessage,
  WorkspacePanel
} from "../features/workspace/types";
import { buildMarkdownFileName, extractTitleFromMarkdown, formatSourceDisplayValue } from "../features/workspace/utils";

export default function HomePage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionSources, setSessionSources] = useState<SessionSource[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [editorMode, setEditorMode] = useState<"edit" | "preview" | "split">("split");
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("session");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [autoGenerateImages, setAutoGenerateImages] = useState(false);
  const [flashHeading, setFlashHeading] = useState(false);
  const [flashCitation, setFlashCitation] = useState(false);
  const [postTitleDraft, setPostTitleDraft] = useState("");
  const [postBodyDraft, setPostBodyDraft] = useState("");
  const [postStatusDraft, setPostStatusDraft] = useState<"draft" | "published">("draft");
  const [revisions, setRevisions] = useState<PostRevision[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sessionTitle, setSessionTitle] = useState("Weekly Engineering Digest");
  const [tone, setTone] = useState("");
  const [format, setFormat] = useState("");
  const [provider, setProvider] = useState<AgentProvider>("mock");
  const [userInstruction, setUserInstruction] = useState("");
  const [generateMode, setGenerateMode] = useState<"new" | "refine">("new");
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
  const streamRef = useRef<EventSource | null>(null);
  const streamParseErrorNotifiedRef = useRef(false);
  const previousHeadingCountRef = useRef(0);
  const previousCitationCountRef = useRef(0);

  const selectedSession = useMemo(() => sessions.find((item) => item.id === selectedSessionId) ?? null, [sessions, selectedSessionId]);

  const navItems: Array<{ key: WorkspacePanel; icon: string; label: string }> = [
    { key: "session", icon: "S", label: "Session" },
    { key: "sources", icon: "R", label: "Sources" },
    { key: "editor", icon: "E", label: "Editor" },
    { key: "posts", icon: "P", label: "Posts" },
  ];

  const pushToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  /** 생성된 마크다운의 H2 섹션 아래에 이미지를 삽입합니다. */
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

  /** 블로그 본문에서 섹션 제목을 추출하고 이미지를 생성하여 마크다운에 삽입합니다. */
  const generateAndInsertImages = useCallback(
    async (body: string): Promise<string> => {
      setIsGeneratingImages(true);
      setStatus("Generating section images...");
      pushToast("Generating section images...", "info");
      try {
        const resp = await apiRequest<{
          images: Array<{ sectionTitle: string; mimeType: string; base64: string }>;
        }>("/generate-blog-images", {
          method: "POST",
          body: JSON.stringify({ blogBody: body, maxImages: 3 }),
        });
        if (resp.images.length > 0) {
          const enriched = insertImagesIntoMarkdown(body, resp.images);
          pushToast(`${resp.images.length} images generated`, "success");
          return enriched;
        }
        pushToast("No images generated (check GEMINI_API_KEY)", "info");
        return body;
      } catch (error) {
        pushToast(
          `Image generation failed: ${error instanceof Error ? error.message : "unknown error"}`,
          "error"
        );
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
    }
  }, [selectedPostId]);

  const loadPost = useCallback(
    async (sessionId: string, postId: string): Promise<void> => {
      const [post, revisionsData] = await Promise.all([
        apiRequest<GeneratedPost>(`/sessions/${sessionId}/posts/${postId}`),
        apiRequest<PostRevision[]>(`/sessions/${sessionId}/posts/${postId}/revisions`)
      ]);
      setGeneratedPost(post);
      setPostTitleDraft(post.title);
      setPostBodyDraft(post.body);
      setPostStatusDraft(post.status);
      setSelectedPostId(post.id);
      setRevisions(revisionsData);
    },
    []
  );

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
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
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

  // 생성된 마크다운에서 제목 자동 추출
  useEffect(() => {
    if (isGenerating || !postBodyDraft) return;
    const extracted = extractTitleFromMarkdown(postBodyDraft);
    if (extracted && extracted.length > 0) {
      setPostTitleDraft(extracted);
    }
  }, [isGenerating, postBodyDraft]);

  const onCreateSession = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
  };

  const onCreateRepoSource = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
  };

  const onCreateNotionSource = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
  };

  const onAttachSource = async (sourceId: string): Promise<void> => {
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
  };

  const onDetachSource = async (sourceId: string): Promise<void> => {
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
  };

  const onDeleteSource = async (sourceId: string): Promise<void> => {
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
  };

  const onSyncSource = async (sourceId: string): Promise<void> => {
    if (!selectedSessionId) {
      setStatus("Select a session first");
      return;
    }
    setStatus("Syncing source...");
    try {
      const result = await apiRequest<{ ingested: number }>(
        `/sessions/${selectedSessionId}/sources/${sourceId}/sync`,
        { method: "POST", body: "{}" }
      );
      setStatus(`Sync complete — ${result.ingested} items ingested`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to sync source");
    }
  };

  const onDeleteSession = async (): Promise<void> => {
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
  };

  const onUpdateConfig = async (): Promise<void> => {
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
  };

  const onGenerate = async (): Promise<void> => {
    if (!selectedSessionId) {
      setStatus("Create or select a session first");
      pushToast("Create or select a session first", "error");
      return;
    }

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    setPanel("editor");
    setIsGenerating(true);
    setGeneratedPost(null);
    setSelectedPostId("");
    setPostStatusDraft("draft");
    setPostTitleDraft(selectedSession?.title ?? "Streaming Draft");
    setPostBodyDraft("");
    setStatus("Generating blog post...");
    pushToast("Generation started", "info");

    if (typeof window === "undefined" || !("EventSource" in window)) {
      try {
        const post = await apiRequest<GeneratedPost>(`/sessions/${selectedSessionId}/generate`, {
          method: "POST",
          body: JSON.stringify({
            provider,
            tone: tone || undefined,
            format: format || undefined,
            userInstruction: userInstruction || undefined,
            refinePostId: generateMode === "refine" && selectedPostId ? selectedPostId : undefined,
            generateImage: autoGenerateImages
          })
        });
        setGeneratedPost(post);
        setSelectedPostId(post.id);
        setPostTitleDraft(post.title);
        setPostBodyDraft(post.body);
        setPostStatusDraft(post.status);
        await refreshSessionDetails(selectedSessionId);
        setStatus("Blog post generated");
        pushToast("Blog post generated", "success");
        setIsGenerating(false);
        // 이미지 자동 생성
        if (autoGenerateImages) {
          const enriched = await generateAndInsertImages(post.body);
          setPostBodyDraft(enriched);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate";
        setStatus(message);
        pushToast(message, "error");
        setIsGenerating(false);
      }
      return;
    }

    const params = new URLSearchParams({ provider, generateImage: String(autoGenerateImages) });
    if (tone.trim().length > 0) {
      params.set("tone", tone);
    }
    if (format.trim().length > 0) {
      params.set("format", format);
    }
    if (userInstruction.trim().length > 0) {
      params.set("userInstruction", userInstruction);
    }
    if (generateMode === "refine" && selectedPostId) {
      params.set("refinePostId", selectedPostId);
    }

    let completed = false;
    const stream = new EventSource(`${API_BASE}/sessions/${selectedSessionId}/generate/stream?${params.toString()}`);
    streamRef.current = stream;
    streamParseErrorNotifiedRef.current = false;

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: "status"; message: string }
          | { type: "chunk"; chunk: string }
          | { type: "complete"; post: GeneratedPost }
          | { type: "error"; message: string };

        if (payload.type === "status") {
          setStatus(payload.message);
          return;
        }

        if (payload.type === "chunk") {
          setPostBodyDraft((current) => current + payload.chunk);
          return;
        }

        if (payload.type === "complete") {
          completed = true;
          stream.close();
          streamRef.current = null;
          setGeneratedPost(payload.post);
          setSelectedPostId(payload.post.id);
          setPostTitleDraft(payload.post.title);
          setPostStatusDraft(payload.post.status);
          setStatus("Blog post generated");
          pushToast("Blog post generated", "success");
          void refreshSessionDetails(selectedSessionId);
          setIsGenerating(false);
          // 이미지 자동 생성
          if (autoGenerateImages) {
            void (async () => {
              const enriched = await generateAndInsertImages(payload.post.body);
              setPostBodyDraft(enriched);
            })();
          }
          return;
        }

        if (payload.type === "error") {
          completed = true;
          stream.close();
          streamRef.current = null;
          setStatus(payload.message);
          pushToast(payload.message, "error");
          setIsGenerating(false);
        }
      } catch {
        if (!streamParseErrorNotifiedRef.current) {
          streamParseErrorNotifiedRef.current = true;
          setStatus("Received malformed stream payload");
          pushToast("Received malformed stream payload", "error");
        }
      }
    };

    stream.onerror = () => {
      if (completed) {
        return;
      }

      stream.close();
      streamRef.current = null;
      setIsGenerating(false);
      setStatus("Streaming disconnected");
      pushToast("Streaming disconnected", "error");
    };
  };

  const onSavePost = async (): Promise<void> => {
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
      setStatus(error instanceof Error ? error.message : "Failed to save post");
      pushToast(error instanceof Error ? error.message : "Failed to save post", "error");
    }
  };

  const onExportMarkdown = (): void => {
    if (!postBodyDraft) {
      pushToast("No content to export", "error");
      return;
    }
    const title = postTitleDraft || "untitled";
    const fileName = buildMarkdownFileName(title);
    const blob = new Blob([postBodyDraft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast(`Exported: ${fileName}`, "success");
  };

  const onLoadRevision = async (revisionId: string): Promise<void> => {
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
      setPanel("editor");
      setStatus(`Loaded revision v${revision.version}. Save to apply rollback.`);
      pushToast(`Loaded revision v${revision.version}`, "info");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load revision");
    }
  };

  // ─── Render helpers ───

  const renderPeriodSlider = (value: string, onChange: (v: string) => void) => (
    <div className="periodSlider">
      <span className="periodSliderLabel">기간 설정</span>
      <div className="periodSliderTrack">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`periodSliderOption ${value === opt.value ? "active" : ""}`}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderGenerateButton = () => (
    <button type="button" onClick={onGenerate} disabled={isGenerating}>
      {isGenerating ? (
        <span className="btnSpinner">
          Generating
          <span className="spinnerDots"><span /><span /><span /></span>
        </span>
      ) : (
        "✦ Generate Blog"
      )}
    </button>
  );

  const renderGenPanel = () => {
    if (activePanel !== "editor") return null;

    return (
      <div className={`genPanelFloating ${genPanelOpen ? "open" : "closed"}`}>
        {/* Collapsed pill — visible when closed */}
        <button
          type="button"
          className={`genPanelCollapsed ${isGenerating || isGeneratingImages ? "generating" : ""}`}
          aria-label="Open generation panel"
          onClick={() => setGenPanelOpen(true)}
          title="Open generation panel"
        >
          {isGenerating || isGeneratingImages ? <div className="collapsedSpinner" /> : "⚙"}
        </button>

        {/* Expanded panel — visible when open */}
        <div className="genPanelExpanded">
          <div className="genPanelHeader">
            <span className="genPanelTitle">⚙ Generation Settings</span>
            <button
              type="button"
              className="genPanelClose"
              aria-label="Close generation panel"
              onClick={() => setGenPanelOpen(false)}
            >
              ×
            </button>
          </div>

            <div className="genPanelBody">
              <div className="genPanelRow">
                <div className="instructionModeRow">
                  <span className="instructionLabel">Mode</span>
                  <div className="modeToggleGroup">
                    <button
                      id="mode-new"
                      type="button"
                      className={generateMode === "new" ? "modeToggle active" : "modeToggle"}
                      aria-pressed={generateMode === "new"}
                      onClick={() => setGenerateMode("new")}
                    >
                      ✦ New Draft
                    </button>
                    <button
                      id="mode-refine"
                      type="button"
                      className={generateMode === "refine" ? "modeToggle active" : "modeToggle"}
                      aria-pressed={generateMode === "refine"}
                      onClick={() => setGenerateMode("refine")}
                      disabled={!selectedPostId}
                      title={!selectedPostId ? "먼저 글을 선택하거나 생성하세요" : "현재 에디터의 글을 수정합니다"}
                    >
                      ✎ Refine
                    </button>
                  </div>
                </div>
                <div className="instructionModeRow">
                  <span className="instructionLabel">Status</span>
                  <div className="modeToggleGroup">
                    <button
                      type="button"
                      className={postStatusDraft === "draft" ? "modeToggle active" : "modeToggle"}
                      aria-pressed={postStatusDraft === "draft"}
                      onClick={() => setPostStatusDraft("draft")}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      className={postStatusDraft === "published" ? "modeToggle active" : "modeToggle"}
                      aria-pressed={postStatusDraft === "published"}
                      onClick={() => setPostStatusDraft("published")}
                    >
                      Published
                    </button>
                  </div>
                </div>
                <div className="instructionModeRow">
                  <button
                    type="button"
                    className={autoGenerateImages ? "modeToggle autoImageToggle active" : "modeToggle autoImageToggle"}
                    aria-pressed={autoGenerateImages}
                    onClick={() => setAutoGenerateImages(!autoGenerateImages)}
                    disabled={isGenerating || isGeneratingImages}
                  >
                    Auto Images
                  </button>
                </div>
              </div>
            {generateMode === "refine" && selectedPostId && (
              <span className="refineBadge">수정 대상: {generatedPost?.title ?? selectedPostId}</span>
            )}

            <label className="instructionInputWrap">
              <span className="instructionLabel">Agent Instruction <span className="optionalTag">(optional)</span></span>
              <textarea
                id="user-instruction"
                className="instructionTextarea"
                value={userInstruction}
                onChange={(event) => setUserInstruction(event.target.value)}
                placeholder={generateMode === "refine"
                  ? "예: 3번째 섹션을 더 자세하게 작성해줘. 코드 예시를 추가해줘."
                  : "예: 배포 관련 내용을 주인공으로 삼아줘. 결론을 더 강조해줘."}
                rows={2}
                disabled={isGenerating}
              />
            </label>

          </div>

          <div className="genPanelActions">
            {renderGenerateButton()}
            <button type="button" className="secondary" onClick={onSavePost} disabled={!selectedPostId || isGenerating}>
              💾 Save
            </button>
            <button type="button" className="secondary" onClick={onExportMarkdown} disabled={!postBodyDraft}>
              📄 Export .md
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="appShell">
      <aside className="sideNav card">
        <div className="brandBlock">
          <p className="eyebrow">velogen</p>
          <h1>Blog Studio</h1>
          <p className="status">{status}</p>
        </div>

        <nav className="menuList">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activePanel === item.key ? "menuItem active" : "menuItem"}
              aria-current={activePanel === item.key ? "page" : undefined}
              onClick={() => setPanel(item.key)}
            >
              <span className="menuIcon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sideMeta">
          <strong>Active Session</strong>
          <p>{selectedSession?.title ?? "No session selected"}</p>
          <strong>Attached Sources</strong>
          {sessionSources.length > 0 ? (
            <ul className="sideSourceList">
              {sessionSources.map((s) => (
                <li key={s.sourceId}>{s.name}</li>
              ))}
            </ul>
          ) : (
            <p className="mutedSmall">No sources attached</p>
          )}
          <strong>Generated Posts</strong>
          <p>{posts.length}</p>
        </div>
      </aside>

      <section className="workspace">
        <header className={`workspaceHeader card ${activePanel === "editor" ? "workspaceHeaderTitle" : ""}`}>
          {activePanel === "editor" ? (
            <>
              <span className="autoTitleLabel">Title</span>
              <span className="autoTitleValue">{postTitleDraft || "생성된 글이 없습니다"}</span>
            </>
          ) : (
            <h2>
              {activePanel === "session" && "Session & Generation"}
              {activePanel === "sources" && "Source Management"}
              {activePanel === "posts" && "Post List"}
            </h2>
          )}
        </header>

        {toasts.length > 0 ? (
          <div className="toastStack">
            {toasts.map((toast) => (
              <div key={toast.id} className={`toastItem ${toast.kind}`}>
                {toast.message}
              </div>
            ))}
          </div>
        ) : null}

        {/* ─── Session Panel ─── */}
        {activePanel === "session" ? (
          <div className="workspaceBody card">
            <div className="grid two">
              <div>
                <h3>Create Session</h3>
                <form onSubmit={onCreateSession} className="form">
                  <label>
                    Session Title
                    <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} required />
                  </label>
                  <button type="submit">Create Session</button>
                </form>
              </div>

              <div>
                <h3>Session Control</h3>
                <label>
                  Active Session
                  <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
                    <option value="">Select session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tone / Style
                  <input
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    placeholder={selectedSession?.tone ?? "예: 차분한 회고형, 직설적 기술 설명"}
                  />
                </label>
                <label>
                  Format
                  <input
                    value={format}
                    onChange={(event) => setFormat(event.target.value)}
                    placeholder={selectedSession?.format ?? "예: 문제-해결-회고 3단 구조"}
                  />
                </label>
                <label>
                  Generator
                  <select id="provider-select" value={provider} onChange={(event) => setProvider(event.target.value as AgentProvider)}>
                    <option value="mock">🤖 Mock (로컬 테스트)</option>
                    <option value="claude">🧠 Claude</option>
                    <option value="codex">⚡ Codex</option>
                    <option value="opencode">🛠 Opencode</option>
                    <option value="gemini">🌟 Gemini</option>
                  </select>
                </label>
                <div className="row">
                  <button type="button" onClick={onUpdateConfig}>
                    Save Options
                  </button>
                  <button type="button" className="ghost" onClick={() => void onDeleteSession()}>
                    Delete Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── Sources Panel ─── */}
        {activePanel === "sources" ? (
          <div className="workspaceBody card">
            <div className="grid two">
              <div>
                <h3>Add Repo Source</h3>
                <form onSubmit={onCreateRepoSource} className="form">
                  <label>
                    Source Name
                    <input value={repoName} onChange={(event) => setRepoName(event.target.value)} required />
                  </label>
                  <label>
                    Local Repo Path
                    <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="/Users/name/project" />
                  </label>
                  <label>
                    Remote Repo URL
                    <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/org/repo.git" />
                  </label>
                  {renderPeriodSlider(repoMonths, setRepoMonths)}
                  <label>
                    Committers
                    <input value={repoCommitters} onChange={(event) => setRepoCommitters(event.target.value)} placeholder="alice,bob" />
                  </label>
                  <button type="submit">Save Repo Source</button>
                </form>
              </div>

              <div>
                <h3>Add Notion Source</h3>
                <form onSubmit={onCreateNotionSource} className="form">
                  <label>
                    Source Name
                    <input value={notionName} onChange={(event) => setNotionName(event.target.value)} required />
                  </label>
                  <label>
                    Notion Page ID
                    <input value={notionPageId} onChange={(event) => setNotionPageId(event.target.value)} required />
                  </label>
                  <label>
                    Notion Token
                    <input value={notionToken} onChange={(event) => setNotionToken(event.target.value)} required />
                  </label>
                  {renderPeriodSlider(notionMonths, setNotionMonths)}
                  <button type="submit">Save Notion Source</button>
                </form>
              </div>
            </div>

            <h3>Source Pool</h3>
            <div className="tableLike">
              {sources.length === 0 ? (
                <p>No sources yet.</p>
              ) : (
                sources.map((source) => {
                  const attached = sessionSources.some((sessionSource) => sessionSource.sourceId === source.id);
                  return (
                    <div key={source.id} className="entry">
                      <div>
                        <strong>{source.name}</strong>
                        <p>
                          <span style={{ color: "var(--accent)" }}>{source.type}</span> |{" "}
                          {formatSourceDisplayValue(source)}
                        </p>
                      </div>
                      <div className="row">
                        {attached ? (
                          <button type="button" onClick={() => void onDetachSource(source.id)}>
                            Detach
                          </button>
                        ) : (
                          <button type="button" onClick={() => void onAttachSource(source.id)}>
                            Attach
                          </button>
                        )}
                        <button type="button" className="ghost" onClick={() => void onDeleteSource(source.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <h3>Attached Sources</h3>
            <div className="tableLike">
              {sessionSources.length === 0 ? (
                <p>No attached sources.</p>
              ) : (
                sessionSources.map((sessionSource) => {
                  const fullSource = sources.find((s) => s.id === sessionSource.sourceId);
                  return (
                    <div key={sessionSource.sourceId} className="entry">
                      <div>
                        <strong>{sessionSource.name}</strong>
                        <p>
                          <span style={{ color: "var(--accent)" }}>{sessionSource.type}</span> |{" "}
                          {fullSource ? formatSourceDisplayValue(fullSource) : sessionSource.sourceId}
                        </p>
                      </div>
                      <div className="row">
                        <button type="button" onClick={() => void onSyncSource(sessionSource.sourceId)}>
                          Sync
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {/* ─── Editor Panel ─── */}
        {activePanel === "editor" ? (
          <div className="workspaceBody card">
            {generatedPost || isGenerating ? (
              <>

                {/* Editor toolbar */}
                <div className="editorToolbar">
                  <div className="viewModeTabs">
                  {(["split", "edit", "preview"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`viewModeTab ${editorMode === mode ? "active" : ""}`}
                      aria-pressed={editorMode === mode}
                      onClick={() => setEditorMode(mode)}
                    >
                        {mode === "split" ? "Split" : mode === "edit" ? "Edit" : "Preview"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Markdown pane */}
                <div className={`mdPane mode-${editorMode}`}>
                  {editorMode !== "preview" ? <MarkdownEditor value={postBodyDraft} onChange={setPostBodyDraft} /> : null}
                  {editorMode !== "edit" ? (
                    <MarkdownViewer content={postBodyDraft} flashHeading={flashHeading} flashCitation={flashCitation} />
                  ) : null}
                </div>

                {/* Revision & meta */}
                <div className="revisionPanel">
                  <h3>Generation Context</h3>
                  {generatedPost?.generationMeta ? (
                    <div className="generationMeta">
                      <p>
                        <strong>Provider:</strong> {generatedPost.generationMeta.provider}
                      </p>
                      <p>
                        <strong>Tone:</strong> {generatedPost.generationMeta.tone ?? "(none)"}
                      </p>
                      <p>
                        <strong>Format:</strong> {generatedPost.generationMeta.format ?? "(none)"}
                      </p>
                      <p>
                        <strong>Instruction:</strong> {generatedPost.generationMeta.userInstruction ?? "(none)"}
                      </p>
                      <p>
                        <strong>Refine From:</strong> {generatedPost.generationMeta.refinePostId ?? "(new draft)"}
                      </p>
                      <p>
                        <strong>Used Sources:</strong>
                      </p>
                      <ul>
                        {generatedPost.generationMeta.sources.map((source) => (
                          <li key={source.sourceId}>
                            {source.name} ({source.type})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p>No saved generation context for this post.</p>
                  )}

                  <h3>Revision History</h3>
                  {revisions.length === 0 ? (
                    <p>No revisions yet.</p>
                  ) : (
                    <ul>
                      {revisions.map((revision) => (
                        <li key={revision.id}>
                          v{revision.version} - {revision.source} - {revision.status} - {new Date(revision.createdAt).toLocaleString()}
                          <button type="button" className="tinyButton" onClick={() => void onLoadRevision(revision.id)}>
                            Load
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p>생성된 글이 없습니다. 아래 ⚙ 버튼을 눌러 Generate Blog를 실행하거나 Posts에서 글을 선택하세요.</p>
            )}
          </div>
        ) : null}

        {/* ─── Posts Panel ─── */}
        {activePanel === "posts" ? (
          <div className="workspaceBody card">
            <h3>Generated Posts</h3>
            {posts.length === 0 ? (
              <p>No posts yet.</p>
            ) : (
              <div className="tableLike">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="postCard"
                    onClick={() => {
                      setSelectedPostId(post.id);
                      setPanel("editor");
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="postCardTitle">{post.title}</span>
                      <span className={`postCardBadge ${post.status}`}>{post.status}</span>
                    </div>
                    <span className="postCardMeta">
                      {post.provider} · {new Date(post.updatedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* ─── Floating Generation Panel ─── */}
        {renderGenPanel()}
      </section>
    </main>
  );
}
