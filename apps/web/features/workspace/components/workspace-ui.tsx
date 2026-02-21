"use client";

import type { AgentProvider } from "@velogen/shared";
import type { FormEvent } from "react";

import { MarkdownEditor } from "../../../components/markdown-editor";
import { MarkdownViewer } from "../../../components/markdown-viewer";
import type { WorkspaceController } from "../use-workspace-controller";

type WorkspaceSection = "session" | "sources" | "editor" | "posts";
type PeriodOptions = ReadonlyArray<{ label: string; value: string }>;
type GenerationMode = WorkspaceController["generateMode"];

type SidebarProps = {
  activePanel: WorkspaceSection;
  navItems: WorkspaceController["navItems"];
  sessionSources: WorkspaceController["sessionSources"];
  posts: WorkspaceController["posts"];
  selectedSession: WorkspaceController["selectedSession"];
  statusText?: WorkspaceController["status"];
  setPanel: WorkspaceController["setPanel"];
};

type ToastProps = {
  toasts: WorkspaceController["toasts"];
};

type HeaderProps = {
  activePanel: WorkspaceSection;
  postTitleDraft: WorkspaceController["postTitleDraft"];
};

type PeriodSliderProps = {
  value: string;
  onChange: (value: string) => void;
  options: PeriodOptions;
};

type SessionProps = {
  sessionTitle: WorkspaceController["sessionTitle"];
  setSessionTitle: WorkspaceController["setSessionTitle"];
  onCreateSession: WorkspaceController["onCreateSession"];
  selectedSessionId: WorkspaceController["selectedSessionId"];
  setSelectedSessionId: WorkspaceController["setSelectedSessionId"];
  sessions: WorkspaceController["sessions"];
  tone: WorkspaceController["tone"];
  setTone: WorkspaceController["setTone"];
  format: WorkspaceController["format"];
  setFormat: WorkspaceController["setFormat"];
  provider: WorkspaceController["provider"];
  setProvider: WorkspaceController["setProvider"];
  selectedSession: WorkspaceController["selectedSession"];
  onUpdateConfig: WorkspaceController["onUpdateConfig"];
  onDeleteSession: WorkspaceController["onDeleteSession"];
};

type SourcesProps = {
  sources: WorkspaceController["sources"];
  sessionSources: WorkspaceController["sessionSources"];
  repoName: WorkspaceController["repoName"];
  setRepoName: WorkspaceController["setRepoName"];
  repoPath: WorkspaceController["repoPath"];
  setRepoPath: WorkspaceController["setRepoPath"];
  repoUrl: WorkspaceController["repoUrl"];
  setRepoUrl: WorkspaceController["setRepoUrl"];
  repoMonths: WorkspaceController["repoMonths"];
  setRepoMonths: WorkspaceController["setRepoMonths"];
  repoCommitters: WorkspaceController["repoCommitters"];
  setRepoCommitters: WorkspaceController["setRepoCommitters"];
  notionName: WorkspaceController["notionName"];
  setNotionName: WorkspaceController["setNotionName"];
  notionPageId: WorkspaceController["notionPageId"];
  setNotionPageId: WorkspaceController["setNotionPageId"];
  notionToken: WorkspaceController["notionToken"];
  setNotionToken: WorkspaceController["setNotionToken"];
  notionMonths: WorkspaceController["notionMonths"];
  setNotionMonths: WorkspaceController["setNotionMonths"];
  PERIOD_OPTIONS: PeriodOptions;
  onCreateRepoSource: WorkspaceController["onCreateRepoSource"];
  onCreateNotionSource: WorkspaceController["onCreateNotionSource"];
  onAttachSource: WorkspaceController["onAttachSource"];
  onDetachSource: WorkspaceController["onDetachSource"];
  onDeleteSource: WorkspaceController["onDeleteSource"];
  onSyncSource: WorkspaceController["onSyncSource"];
  onFormatSourceDisplay: WorkspaceController["onFormatSourceDisplay"];
};

type EditorProps = {
  generatedPost: WorkspaceController["generatedPost"];
  isGenerating: WorkspaceController["isGenerating"];
  editorMode: WorkspaceController["editorMode"];
  setEditorMode: WorkspaceController["setEditorMode"];
  postBodyDraft: WorkspaceController["postBodyDraft"];
  setPostBodyDraft: WorkspaceController["setPostBodyDraft"];
  flashHeading: WorkspaceController["flashHeading"];
  flashCitation: WorkspaceController["flashCitation"];
  revisions: WorkspaceController["revisions"];
  onLoadRevision: WorkspaceController["onLoadRevision"];
};

type PostsProps = {
  posts: WorkspaceController["posts"];
  selectPost: WorkspaceController["selectPost"];
};

type GenerationPanelProps = {
  genPanelOpen: WorkspaceController["genPanelOpen"];
  setGenPanelOpen: WorkspaceController["setGenPanelOpen"];
  generateMode: GenerationMode;
  setGenerateMode: WorkspaceController["setGenerateMode"];
  postStatusDraft: WorkspaceController["postStatusDraft"];
  setPostStatusDraft: WorkspaceController["setPostStatusDraft"];
  autoGenerateImages: WorkspaceController["autoGenerateImages"];
  setAutoGenerateImages: WorkspaceController["setAutoGenerateImages"];
  isGenerating: WorkspaceController["isGenerating"];
  isGeneratingImages: WorkspaceController["isGeneratingImages"];
  onGenerate: WorkspaceController["onGenerate"];
  onSavePost: WorkspaceController["onSavePost"];
  onExportMarkdown: WorkspaceController["onExportMarkdown"];
  userInstruction: WorkspaceController["userInstruction"];
  setUserInstruction: WorkspaceController["setUserInstruction"];
  generatedPost: WorkspaceController["generatedPost"];
  selectedPostId: WorkspaceController["selectedPostId"];
  postBodyDraft: WorkspaceController["postBodyDraft"];
};

function PeriodSlider({ value, onChange, options }: PeriodSliderProps) {
  return (
    <div className="periodSlider">
      <span className="periodSliderLabel">기간 설정</span>
      <div className="periodSliderTrack">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`periodSliderOption ${value === option.value ? "active" : ""}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkspaceSidebar({
  activePanel,
  navItems,
  sessionSources,
  posts,
  selectedSession,
  statusText,
  setPanel
}: SidebarProps) {
  return (
    <aside className="sideNav card">
      <div className="brandBlock">
        <p className="eyebrow">velogen</p>
        <h1>Blog Studio</h1>
        <p className="status">{statusText ?? selectedSession?.title ?? "No session selected"}</p>
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
            {sessionSources.map((source) => (
              <li key={source.sourceId}>{source.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mutedSmall">No sources attached</p>
        )}
        <strong>Generated Posts</strong>
        <p>{posts.length}</p>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ activePanel, postTitleDraft }: HeaderProps) {
  return (
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
  );
}

function ToastStack({ toasts }: ToastProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toastStack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toastItem ${toast.kind}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function SessionPanel({
  sessionTitle,
  setSessionTitle,
  onCreateSession,
  selectedSessionId,
  setSelectedSessionId,
  sessions,
  tone,
  setTone,
  format,
  setFormat,
  provider,
  setProvider,
  selectedSession,
  onUpdateConfig,
  onDeleteSession
}: SessionProps) {
  return (
    <div className="workspaceBody card">
      <div className="grid two">
        <div>
          <h3>Create Session</h3>
          <form
            onSubmit={(event) => {
              void onCreateSession(event);
            }}
            className="form"
          >
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
            <select
              id="provider-select"
              value={provider}
              onChange={(event) => setProvider(event.target.value as AgentProvider)}
            >
              <option value="mock">🤖 Mock (로컬 테스트)</option>
              <option value="claude">🧠 Claude</option>
              <option value="codex">⚡ Codex</option>
              <option value="opencode">🛠 Opencode</option>
              <option value="gemini">🌟 Gemini</option>
            </select>
          </label>
          <div className="row">
            <button type="button" onClick={() => void onUpdateConfig()}>
              Save Options
            </button>
            <button type="button" className="ghost" onClick={() => void onDeleteSession()}>
              Delete Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourcesPanel({
  sources,
  sessionSources,
  repoName,
  setRepoName,
  repoPath,
  setRepoPath,
  repoUrl,
  setRepoUrl,
  repoMonths,
  setRepoMonths,
  repoCommitters,
  setRepoCommitters,
  notionName,
  setNotionName,
  notionPageId,
  setNotionPageId,
  notionToken,
  setNotionToken,
  notionMonths,
  setNotionMonths,
  PERIOD_OPTIONS,
  onCreateRepoSource,
  onCreateNotionSource,
  onAttachSource,
  onDetachSource,
  onDeleteSource,
  onSyncSource,
  onFormatSourceDisplay
}: SourcesProps) {
  return (
    <div className="workspaceBody card">
      <div className="grid two">
        <div>
          <h3>Add Repo Source</h3>
          <form
            onSubmit={(event) => {
              void onCreateRepoSource(event);
            }}
            className="form"
          >
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
            <PeriodSlider value={repoMonths} onChange={setRepoMonths} options={PERIOD_OPTIONS} />
            <label>
              Committers
              <input value={repoCommitters} onChange={(event) => setRepoCommitters(event.target.value)} placeholder="alice,bob" />
            </label>
            <button type="submit">Save Repo Source</button>
          </form>
        </div>

        <div>
          <h3>Add Notion Source</h3>
          <form
            onSubmit={(event) => {
              void onCreateNotionSource(event);
            }}
            className="form"
          >
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
            <PeriodSlider value={notionMonths} onChange={setNotionMonths} options={PERIOD_OPTIONS} />
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
                    <span style={{ color: "var(--accent)" }}>{source.type}</span> | {onFormatSourceDisplay(source)}
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
            const fullSource = sources.find((source) => source.id === sessionSource.sourceId);
            return (
              <div key={sessionSource.sourceId} className="entry">
                <div>
                  <strong>{sessionSource.name}</strong>
                  <p>
                    <span style={{ color: "var(--accent)" }}>{sessionSource.type}</span> | {fullSource ? onFormatSourceDisplay(fullSource) : sessionSource.sourceId}
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
  );
}

function EditorPanel({
  generatedPost,
  isGenerating,
  editorMode,
  setEditorMode,
  postBodyDraft,
  setPostBodyDraft,
  flashHeading,
  flashCitation,
  revisions,
  onLoadRevision
}: EditorProps) {
  return (
    <div className="workspaceBody card">
      {generatedPost || isGenerating ? (
        <>
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

          <div className={`mdPane mode-${editorMode}`}>
            {editorMode !== "preview" ? <MarkdownEditor value={postBodyDraft} onChange={setPostBodyDraft} /> : null}
            {editorMode !== "edit" ? (
              <MarkdownViewer content={postBodyDraft} flashHeading={flashHeading} flashCitation={flashCitation} />
            ) : null}
          </div>

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
            {revisions.length === 0 ? <p>No revisions yet.</p> : null}
            {revisions.length > 0 ? (
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
            ) : null}
          </div>
        </>
      ) : (
        <p>생성된 글이 없습니다. 아래 ⚙ 버튼을 눌러 Generate Blog를 실행하거나 Posts에서 글을 선택하세요.</p>
      )}
    </div>
  );
}

function PostsPanel({ posts, selectPost }: PostsProps) {
  return (
    <div className="workspaceBody card">
      <h3>Generated Posts</h3>
      {posts.length === 0 ? <p>No posts yet.</p> : null}
      {posts.length > 0 ? (
        <div className="tableLike">
          {posts.map((post) => (
            <div
              key={post.id}
              className="postCard"
              onClick={() => {
                selectPost(post.id);
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
      ) : null}
    </div>
  );
}

function FloatingGenerationPanel({
  genPanelOpen,
  setGenPanelOpen,
  generateMode,
  setGenerateMode,
  postStatusDraft,
  setPostStatusDraft,
  autoGenerateImages,
  setAutoGenerateImages,
  isGenerating,
  isGeneratingImages,
  onGenerate,
  onSavePost,
  onExportMarkdown,
  userInstruction,
  setUserInstruction,
  generatedPost,
  selectedPostId,
  postBodyDraft
}: GenerationPanelProps) {
  return (
    <div className={`genPanelFloating ${genPanelOpen ? "open" : "closed"}`}>
      <button
        type="button"
        className={`genPanelCollapsed ${isGenerating || isGeneratingImages ? "generating" : ""}`}
        aria-label="Open generation panel"
        onClick={() => setGenPanelOpen(true)}
        title="Open generation panel"
      >
        {isGenerating || isGeneratingImages ? <div className="collapsedSpinner" /> : "⚙"}
      </button>

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
            <span className="instructionLabel">
              Agent Instruction <span className="optionalTag">(optional)</span>
            </span>
            <textarea
              id="user-instruction"
              className="instructionTextarea"
              value={userInstruction}
              onChange={(event) => setUserInstruction(event.target.value)}
              placeholder={
                generateMode === "refine"
                  ? "예: 3번째 섹션을 더 자세하게 작성해줘. 코드 예시를 추가해줘."
                  : "예: 배포 관련 내용을 주인공으로 삼아줘. 결론을 더 강조해줘."
              }
              rows={2}
              disabled={isGenerating}
            />
          </label>
        </div>

        <div className="genPanelActions">
          <button type="button" onClick={() => void onGenerate()} disabled={isGenerating}>
            {isGenerating ? (
              <span className="btnSpinner">
                Generating
                <span className="spinnerDots">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            ) : (
              "✦ Generate Blog"
            )}
          </button>
          <button type="button" className="secondary" onClick={() => void onSavePost()} disabled={!postBodyDraft || isGenerating}>
            💾 Save
          </button>
          <button type="button" className="secondary" onClick={() => void onExportMarkdown()} disabled={!postBodyDraft}>
            📄 Export .md
          </button>
        </div>
      </div>
    </div>
  );
}

export {
  WorkspaceSidebar,
  WorkspaceHeader,
  ToastStack,
  SessionPanel,
  SourcesPanel,
  EditorPanel,
  PostsPanel,
  FloatingGenerationPanel
};
