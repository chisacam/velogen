import { useState } from "react";
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
  setPanel
}: WorkspaceSidebarProps) {
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);

  return (
    <aside className="sideNav card">
      <div className="brandBlock">
        <p className="eyebrow">velogen</p>
        <h1>Blog Studio</h1>
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
        <section className="sideMetaSection">
          <strong>Active Session</strong>
          <p className="sideMetaValue">{selectedSession?.title ?? "No session selected"}</p>
        </section>

        <section className="sideMetaSection">
          <strong>Attached Sources</strong>
          {sessionSources.length > 0 ? (
            <ul className="sideSourceList">
              {sessionSources.map((source) => (
                <li key={source.sourceId}>{source.name}</li>
              ))}
            </ul>
          ) : (
            <p className="sideMetaMuted">No sources attached</p>
          )}
        </section>

        <section className="sideMetaSection sideStatsRow">
          <div>
            <strong>Generated Posts</strong>
            <p className="sideMetaValue">{posts.length}</p>
          </div>
          <div>
            <strong>Selected Draft</strong>
            <p className="sideMetaMuted">{generatedPost?.title ?? (selectedPostId || "No draft selected")}</p>
          </div>
        </section>

        <section className="sideMetaSection">
          <strong>Generation Context</strong>
          {generatedPost?.generationMeta ? (
            <div className="sideContextBlock">
              <p><span>Provider</span><span>{generatedPost.generationMeta.provider}</span></p>
              <p><span>Tone</span><span>{generatedPost.generationMeta.tone ?? "(none)"}</span></p>
              <p><span>Format</span><span>{generatedPost.generationMeta.format ?? "(none)"}</span></p>
              <p><span>Refine</span><span>{generatedPost.generationMeta.refinePostId ?? "new draft"}</span></p>
              <p><span>Sources</span><span>{generatedPost.generationMeta.sources.length}</span></p>
              {generatedPost.generationMeta?.userInstruction && generatedPost.generationMeta.userInstruction.trim() !== "" ? (
                <div className="sideInstructionWrap">
                  <button
                    type="button"
                    className="sideInstructionToggle"
                    onClick={() => setIsInstructionOpen((prev) => !prev)}
                  >
                    {isInstructionOpen ? "Hide Instruction" : "View Instruction"}
                  </button>
                  {isInstructionOpen && (
                    <div className="sideInstructionContent">
                      {generatedPost.generationMeta.userInstruction}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="sideMetaMuted">No saved generation context</p>
          )}
        </section>

        <section className="sideMetaSection">
          <strong>Revision History</strong>
          {revisions.length > 0 ? (
            <ul className="sideRevisionList">
              {revisions.map((revision) => (
                <li key={revision.id}>
                  <div className="revHeader">
                    <span>v{revision.version}</span>
                    <button type="button" className="tinyButton secondary" onClick={() => void onLoadRevision(revision.id)}>
                      Load
                    </button>
                  </div>
                  <div className="revMeta">
                    <span>{revision.source}</span>
                    <small>
                      {new Date(revision.createdAt).toLocaleDateString()} {new Date(revision.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sideMetaMuted">No revisions yet</p>
          )}
        </section>
      </div>
    </aside>
  );
}
