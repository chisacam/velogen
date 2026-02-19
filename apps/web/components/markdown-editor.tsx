"use client";

interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <textarea
      className="markdown-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Write markdown here"
    />
  );
}
