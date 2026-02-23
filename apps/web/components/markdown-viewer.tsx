"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { RefObject, UIEvent } from "react";
import styles from "./markdown.module.css";

interface MarkdownViewerProps {
  content: string;
  flashHeading?: boolean;
  flashCitation?: boolean;
  viewerRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  className?: string;
}

function decorateCitations(markdown: string): string {
  const lines = markdown.split("\n");
  let inFence = false;
  const transformed = lines.map((line) => {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      return line;
    }
    if (inFence) {
      return line;
    }
    return line.replace(/\[(C\d+)\]/g, "`[$1]`");
  });
  return transformed.join("\n");
}

export function MarkdownViewer({
  content,
  flashHeading = false,
  flashCitation = false,
  viewerRef,
  onScroll,
  className
}: MarkdownViewerProps) {
  const decorated = decorateCitations(content);
  return (
    <div
      ref={viewerRef}
      onScroll={onScroll}
      className={`${styles.viewer} ${flashHeading ? styles.flashHeading : ""} ${flashCitation ? styles.flashCitation : ""} ${className || ""}`.trim()}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1 className={styles.heading}>{children}</h1>,
          h2: ({ children }) => <h2 className={styles.heading}>{children}</h2>,
          h3: ({ children }) => <h3 className={styles.heading}>{children}</h3>,
          h4: ({ children }) => <h4 className={styles.heading}>{children}</h4>,
          h5: ({ children }) => <h5 className={styles.heading}>{children}</h5>,
          h6: ({ children }) => <h6 className={styles.heading}>{children}</h6>,
          code: ({ children, className: codeClassName }) => {
            const text = String(children ?? "");
            const isCitation = /^\[C\d+\]$/.test(text);
            const cls = isCitation ? styles.citation : codeClassName;
            return <code className={cls}>{children}</code>;
          }
        }}
      >
        {decorated}
      </ReactMarkdown>
    </div>
  );
}
