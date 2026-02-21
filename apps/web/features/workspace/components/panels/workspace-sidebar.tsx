import { type WorkspaceSidebarProps } from "./panel-types";

export function WorkspaceSidebar({
  activePanel,
  navItems,
  sessionSources,
  posts,
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
      </div>
    </aside>
  );
}
