import { type WorkspaceHeaderProps } from "./panel-types";

export function WorkspaceHeader({ activePanel, postTitleDraft }: WorkspaceHeaderProps) {
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
