"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AgentProvider, SourceSummary, SourceType } from "@velogen/shared";
import { MarkdownEditor } from "../components/markdown-editor";
import { MarkdownViewer } from "../components/markdown-viewer";

interface SessionSummary {
  id: string;
  title: string;
  tone: string | null;
  format: string | null;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData.message) message = errorData.message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export default function HomePage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionSources, setSessionSources] = useState<SessionSource[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [editorMode, setEditorMode] = useState<"edit" | "preview" | "split">("split");
  const [postTitleDraft, setPostTitleDraft] = useState("");
  const [postBodyDraft, setPostBodyDraft] = useState("");
  const [postStatusDraft, setPostStatusDraft] = useState<"draft" | "published">("draft");
  const [revisions, setRevisions] = useState<PostRevision[]>([]);
  const [sessionTitle, setSessionTitle] = useState("Weekly Engineering Digest");
  const [tone, setTone] = useState("");
  const [format, setFormat] = useState("");
  const [provider, setProvider] = useState<AgentProvider>("mock");
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
  const selectedSession = useMemo(() => sessions.find((item) => item.id === selectedSessionId) ?? null, [sessions, selectedSessionId]);

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
      setStatus("Session created");
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
        body: JSON.stringify({ tone: tone || undefined, format: format || undefined })
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
      return;
    }

    setStatus("Generating blog post...");
    try {
      const post = await apiRequest<GeneratedPost>(`/sessions/${selectedSessionId}/generate`, {
        method: "POST",
        body: JSON.stringify({ provider, tone: tone || undefined, format: format || undefined })
      });
      setGeneratedPost(post);
      setSelectedPostId(post.id);
      setPostTitleDraft(post.title);
      setPostBodyDraft(post.body);
      setPostStatusDraft(post.status);
      await refreshSessionDetails(selectedSessionId);
      setStatus("Blog post generated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to generate");
    }
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
      setStatus("Draft saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save post");
    }
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
      setStatus(`Loaded revision v${revision.version}. Save to apply rollback.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load revision");
    }
  };

  return (
    <main className="canvas">
      <section className="hero card">
        <p className="eyebrow">velogen</p>
        <h1>Commit + Notion Blog Studio</h1>
        <p>
          Repo 커밋과 Notion 콘텐츠를 함께 묶어 한 번에 블로그로 생성합니다. 기간 기본값은 3개월, 작성자 필터는 기본적으로 비활성입니다.
        </p>
        <p className="status">Status: {status}</p>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Create Session</h2>
          <form onSubmit={onCreateSession} className="form">
            <label>
              Session Title
              <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} required />
            </label>
            <button type="submit">Create Session</button>
          </form>
        </div>

        <div className="card">
          <h2>Session Control</h2>
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
            <select
              id="provider-select"
              value={provider}
              onChange={(event) => setProvider(event.target.value as AgentProvider)}
            >
              <option value="mock">🤖 Mock (로컬 테스트, 설치 불필요)</option>
              <option value="claude">🧠 Claude (claude-code CLI)</option>
              <option value="codex">⚡ Codex (OpenAI Codex CLI)</option>
              <option value="opencode">🛠 Opencode</option>
            </select>
          </label>
          {provider !== "mock" && (
            <div className="hint">
              {provider === "claude" && (
                <>
                  <strong>Claude 설정</strong>: <code>npm i -g @anthropic-ai/claude-code</code> 설치 후
                  {" "}<code>claude --print</code> 동작을 확인하세요.<br />
                  <strong>MCP 연동</strong>: Claude는 <code>~/.claude/claude_desktop_config.json</code>{" "}
                  또는 프로젝트 루트 <code>.mcp.json</code>에 설정한 MCP 서버를 자동으로 사용합니다.
                  서버 재시작 없이 해당 파일을 수정하면 다음 생성부터 반영됩니다.
                </>
              )}
              {provider === "codex" && (
                <>
                  <strong>Codex 설정</strong>: OpenAI Codex CLI를 설치하고
                  {" "}<code>OPENAI_API_KEY</code> 환경변수를 설정하세요.
                  서버의 <code>.env</code>에 <code>CODEX_MODEL=o4-mini</code>로 모델을 지정할 수 있습니다.
                </>
              )}
              {provider === "opencode" && (
                <>
                  <strong>Opencode 설정</strong>: Opencode를 설치하고 PATH에 등록하세요.
                  서버의 <code>.env</code>에 <code>OPENCODE_MODEL=anthropic/claude-sonnet-4-5</code>로
                  모델을 지정할 수 있습니다.
                </>
              )}
            </div>
          )}
          <div className="row">
            <button type="button" onClick={onUpdateConfig}>
              Save Options
            </button>
            <button type="button" onClick={onGenerate}>
              Generate Blog
            </button>
            <button type="button" className="ghost" onClick={() => void onDeleteSession()}>
              Delete Session
            </button>
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Add Repo Source</h2>
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
              or Remote Repo URL
              <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/org/repo.git" />
            </label>
            <label>
              Since Months (default 3)
              <input value={repoMonths} onChange={(event) => setRepoMonths(event.target.value)} type="number" min={1} />
            </label>
            <label>
              Committers (comma-separated, optional)
              <input value={repoCommitters} onChange={(event) => setRepoCommitters(event.target.value)} placeholder="alice,bob" />
            </label>
            <button type="submit">Save Repo Source</button>
          </form>
        </div>

        <div className="card">
          <h2>Add Notion Source</h2>
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
            <label>
              Since Months (default 3)
              <input value={notionMonths} onChange={(event) => setNotionMonths(event.target.value)} type="number" min={1} />
            </label>
            <button type="submit">Save Notion Source</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Source Pool</h2>
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
                      {source.type} / {source.id}
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
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Attached Sources</h2>
          {sessionSources.length === 0 ? (
            <p>No attached sources.</p>
          ) : (
            <ul>
              {sessionSources.map((source) => (
                <li key={source.sourceId} className="entry">
                  <span>{source.name} ({source.type})</span>
                  <button type="button" className="tinyButton" onClick={() => void onSyncSource(source.sourceId)}>
                    Sync
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Generated Posts</h2>
          {posts.length === 0 ? (
            <p>No posts yet.</p>
          ) : (
            <ul>
              {posts.map((post) => (
                <li key={post.id}>
                  <button type="button" className="postLink" onClick={() => setSelectedPostId(post.id)}>
                    {post.title} - {post.provider} - {post.status} - {new Date(post.updatedAt).toLocaleString()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {generatedPost ? (
        <section className="card">
          <h2>Markdown Draft Studio</h2>
          <label>
            Title
            <input value={postTitleDraft} onChange={(event) => setPostTitleDraft(event.target.value)} />
          </label>
          <div className="row">
            <label>
              Status
              <select value={postStatusDraft} onChange={(event) => setPostStatusDraft(event.target.value as "draft" | "published")}>
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
            <label>
              Mode
              <select value={editorMode} onChange={(event) => setEditorMode(event.target.value as "edit" | "preview" | "split")}>
                <option value="split">split</option>
                <option value="edit">edit</option>
                <option value="preview">preview</option>
              </select>
            </label>
          </div>
          <div className={`mdPane mode-${editorMode}`}>
            {editorMode !== "preview" ? <MarkdownEditor value={postBodyDraft} onChange={setPostBodyDraft} /> : null}
            {editorMode !== "edit" ? <MarkdownViewer content={postBodyDraft} /> : null}
          </div>
          <div className="row">
            <button type="button" onClick={onSavePost}>
              Save Markdown
            </button>
          </div>
          <div className="revisionPanel">
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
        </section>
      ) : null}
    </main>
  );
}
