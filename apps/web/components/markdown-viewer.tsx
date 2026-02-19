"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  flashHeading?: boolean;
  flashCitation?: boolean;
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

export function MarkdownViewer({ content, flashHeading = false, flashCitation = false }: MarkdownViewerProps) {
  const decorated = decorateCitations(content);
  return (
    <div className={`markdown-viewer ${flashHeading ? "flash-heading" : ""} ${flashCitation ? "flash-citation" : ""}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1 className="md-heading md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-heading md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-heading md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="md-heading md-h4">{children}</h4>,
          h5: ({ children }) => <h5 className="md-heading md-h5">{children}</h5>,
          h6: ({ children }) => <h6 className="md-heading md-h6">{children}</h6>,
          code: ({ children, className }) => {
            const text = String(children ?? "");
            const isCitation = /^\[C\d+\]$/.test(text);
            const cls = isCitation ? "md-citation" : className;
            return <code className={cls}>{children}</code>;
          }
        }}
      >
        {decorated}
      </ReactMarkdown>
    </div>
  );
}
