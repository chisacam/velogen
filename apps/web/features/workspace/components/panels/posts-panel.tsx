import { useState } from "react";
import { type PostsPanelProps } from "./panel-types";
import styles from "./posts-panel.module.css";
import commonStyles from "./common-panel.module.css";

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
    <div className={`workspaceBody card ${styles.postsPanelContainer}`}>
      <h3>Generated Posts</h3>
      {posts.length === 0 ? <p>No posts yet.</p> : null}
      {posts.length > 0 ? (
        <>
          <div className={styles.postList}>
            {currentPosts.map((post) => {
              const dateObj = new Date(post.updatedAt);
              const formattedDate = `${dateObj.toLocaleDateString()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

              return (
                <div key={post.id} className={styles.postListItem} onClick={() => selectPost(post.id)}>
                  <div className={styles.postListItemLeft}>
                    <span className={styles.postListItemTitle} title={post.title}>
                      {post.title}
                    </span>
                  </div>
                  <div className={styles.postListItemRight}>
                    <span className={`${styles.postListItemBadge} ${styles[post.status] || ''}`}>{post.status}</span>
                    <span className={styles.postListItemMeta}>
                      {post.provider} · {formattedDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.paginationControls}>
              <button
                className={`ghost ${commonStyles.tinyButton}`}
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className={styles.paginationInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className={`ghost ${commonStyles.tinyButton}`}
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
