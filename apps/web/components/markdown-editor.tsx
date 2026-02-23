"use client";

import type { RefObject, UIEvent } from "react";
import styles from "./markdown.module.css";

interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  editorRef?: RefObject<HTMLTextAreaElement | null>;
  onScroll?: (event: UIEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

export function MarkdownEditor({ value, onChange, editorRef, onScroll, className }: MarkdownEditorProps) {
  return (
    <textarea
      ref={editorRef}
      className={`${styles.editor} ${className || ""}`.trim()}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onScroll={onScroll}
      placeholder="Write markdown here"
    />
  );
}
