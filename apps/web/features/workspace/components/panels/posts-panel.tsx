import { type PostsPanelProps } from "./panel-types";

export function PostsPanel({ posts, selectPost }: PostsPanelProps) {
  return (
    <div className="workspaceBody card">
      <h3>Generated Posts</h3>
      {posts.length === 0 ? <p>No posts yet.</p> : null}
      {posts.length > 0 ? (
        <div className="tableLike">
          {posts.map((post) => (
            <div key={post.id} className="postCard" onClick={() => selectPost(post.id)}>
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
