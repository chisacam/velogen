"use client";

import type { RefObject, UIEvent } from "react";

interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  editorRef?: RefObject<HTMLTextAreaElement | null>;
  onScroll?: (event: UIEvent<HTMLTextAreaElement>) => void;
}

export function MarkdownEditor({ value, onChange, editorRef, onScroll }: MarkdownEditorProps) {
  return (
    <textarea
      ref={editorRef}
      className="markdown-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onScroll={onScroll}
      placeholder="Write markdown here"
    />
  );
}
