import { useState } from "react";
import { type WorkspaceSidebarProps } from "./panel-types";

import styles from "./workspace-sidebar.module.css";
import commonStyles from "./common-panel.module.css";

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
    <aside className={`${styles.sideNav} card`}>
      <div className={styles.sideNavScrollArea}>
        <div className={styles.brandBlock}>
          <p className="eyebrow">velogen</p>
          <h1>Blog Studio</h1>
        </div>

        <nav className={styles.menuList}>
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activePanel === item.key ? `${styles.menuItem} ${styles.active}` : styles.menuItem}
              aria-current={activePanel === item.key ? "page" : undefined}
              onClick={() => setPanel(item.key)}
            >
              <span className={styles.menuIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sideMeta}>
          <section className={styles.sideMetaSection}>
            <strong>Active Session</strong>
            <p className={styles.sideMetaValue}>{selectedSession?.title ?? "No session selected"}</p>
          </section>

          <section className={styles.sideMetaSection}>
            <strong>Attached Sources</strong>
            {sessionSources.length > 0 ? (
              <ul className={styles.sideSourceList}>
                {sessionSources.map((source) => (
                  <li key={source.sourceId}>{source.name}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.sideMetaMuted}>No sources attached</p>
            )}
          </section>

          <section className={`${styles.sideMetaSection} ${styles.sideStatsRow}`}>
            <div>
              <strong>Generated Posts</strong>
              <p className={styles.sideMetaValue}>{posts.length}</p>
            </div>
            <div>
              <strong>Selected Draft</strong>
              <p className={styles.sideMetaMuted}>{generatedPost?.title ?? (selectedPostId || "No draft selected")}</p>
            </div>
          </section>

          <section className={styles.sideMetaSection}>
            <strong>Generation Context</strong>
            {generatedPost?.generationMeta ? (
              <div className={styles.sideContextBlock}>
                <p><span>Provider</span><span>{generatedPost.generationMeta.provider}</span></p>
                <p><span>Tone</span><span>{generatedPost.generationMeta.tone ?? "(none)"}</span></p>
                <p><span>Format</span><span>{generatedPost.generationMeta.format ?? "(none)"}</span></p>
                <p><span>Refine</span><span>{generatedPost.generationMeta.refinePostId ?? "new draft"}</span></p>
                <p><span>Sources</span><span>{generatedPost.generationMeta.sources.length}</span></p>
                {generatedPost.generationMeta?.userInstruction && generatedPost.generationMeta.userInstruction.trim() !== "" ? (
                  <div className={styles.sideInstructionWrap}>
                    <button
                      type="button"
                      className={styles.sideInstructionToggle}
                      onClick={() => setIsInstructionOpen((prev) => !prev)}
                    >
                      {isInstructionOpen ? "Hide Instruction" : "View Instruction"}
                    </button>
                    {isInstructionOpen && (
                      <div className={styles.sideInstructionContent}>
                        {generatedPost.generationMeta.userInstruction}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className={styles.sideMetaMuted}>No saved generation context</p>
            )}
          </section>

          <section className={styles.sideMetaSection}>
            <strong>Revision History</strong>
            {revisions.length > 0 ? (
              <ul className={styles.sideRevisionList}>
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <div className={styles.revHeader}>
                      <span>v{revision.version}</span>
                      <button type="button" className={`secondary ${commonStyles.tinyButton}`} onClick={() => void onLoadRevision(revision.id)}>
                        Load
                      </button>
                    </div>
                    <div className={styles.revMeta}>
                      <span>{revision.source}</span>
                      <small>
                        {new Date(revision.createdAt).toLocaleDateString()} {new Date(revision.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.sideMetaMuted}>No revisions yet</p>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
