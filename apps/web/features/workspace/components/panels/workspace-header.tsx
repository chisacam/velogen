import { type WorkspaceHeaderProps } from "./panel-types";
import styles from "./workspace-header.module.css";
import commonStyles from "./common-panel.module.css";

export function WorkspaceHeader({ activePanel, postTitleDraft }: WorkspaceHeaderProps) {
  return (
    <header className={`${styles.workspaceHeader} ${commonStyles.card} ${activePanel === "editor" ? styles.workspaceHeaderTitle : ""}`}>
      {activePanel === "editor" ? (
        <>
          <span className={styles.autoTitleLabel}>Title</span>
          <span className={styles.autoTitleValue}>{postTitleDraft || "생성된 글이 없습니다"}</span>
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
