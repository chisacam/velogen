import { useState } from "react";
import { type PostsPanelProps } from "./panel-types";

const POSTS_PER_PAGE = 10;

export function PostsPanel({ posts, selectPost }: PostsPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const currentPosts = posts.slice(startIndex, startIndex + POSTS_PER_PAGE);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  return (
    <div className="workspaceBody card postsPanelContainer">
      <h3>Generated Posts</h3>
      {posts.length === 0 ? <p>No posts yet.</p> : null}
      {posts.length > 0 ? (
        <>
          <div className="postList">
            {currentPosts.map((post) => {
              const dateObj = new Date(post.updatedAt);
              const formattedDate = `${dateObj.toLocaleDateString()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

              return (
                <div key={post.id} className="postListItem" onClick={() => selectPost(post.id)}>
                  <div className="postListItemLeft">
                    <span className="postListItemTitle" title={post.title}>
                      {post.title}
                    </span>
                  </div>
                  <div className="postListItemRight">
                    <span className={`postListItemBadge ${post.status}`}>{post.status}</span>
                    <span className="postListItemMeta">
                      {post.provider} · {formattedDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="paginationControls">
              <button
                className="ghost tinyButton"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="paginationInfo">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="ghost tinyButton"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
