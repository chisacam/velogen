import { type WorkspaceSidebarProps } from "./panel-types";

export function WorkspaceSidebar({
  activePanel,
  navItems,
  sessionSources,
  posts,
  generatedPost,
  selectedPostId,
  revisions,
  onLoadRevision,
  selectedSession,
  statusText,
  setPanel
}: WorkspaceSidebarProps) {
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

        <strong>Selected Draft</strong>
        <p className="mutedSmall">{generatedPost?.title ?? (selectedPostId || "No draft selected")}</p>

        <strong>Generation Context</strong>
        {generatedPost?.generationMeta ? (
          <div className="sideContextBlock">
            <p><span>Provider</span><span>{generatedPost.generationMeta.provider}</span></p>
            <p><span>Tone</span><span>{generatedPost.generationMeta.tone ?? "(none)"}</span></p>
            <p><span>Format</span><span>{generatedPost.generationMeta.format ?? "(none)"}</span></p>
            <p><span>Refine</span><span>{generatedPost.generationMeta.refinePostId ?? "new draft"}</span></p>
            <p><span>Sources</span><span>{generatedPost.generationMeta.sources.length}</span></p>
          </div>
        ) : (
          <p className="mutedSmall">No saved generation context</p>
        )}

        <strong>Revision History</strong>
        {revisions.length > 0 ? (
          <ul className="sideRevisionList">
            {revisions.map((revision) => (
              <li key={revision.id}>
                <div>
                  <span>v{revision.version}</span>
                  <span>{revision.source}</span>
                </div>
                <small>{new Date(revision.createdAt).toLocaleString()}</small>
                <button type="button" className="tinyButton secondary" onClick={() => void onLoadRevision(revision.id)}>
                  Load
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mutedSmall">No revisions yet</p>
        )}
      </div>
    </aside>
  );
}
