import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "../../../../components/markdown-editor";
import { MarkdownViewer } from "../../../../components/markdown-viewer";
import { type EditorPanelProps } from "./panel-types";
import { GenerationConversationPanel } from "./generation-conversation-panel";

export function EditorPanel({
  generatedPost,
  isGenerating,
  editorMode,
  setEditorMode,
  postBodyDraft,
  setPostBodyDraft,
  flashHeading,
  flashCitation,
  clarification,
  clarificationAnswers,
  clarificationConversation,
  onClarificationAnswerChange,
  onRetryAfterClarification,
  onClearClarification,
  tone,
  setTone,
  format,
  setFormat
}: EditorPanelProps) {
  const hasConversationPanel = Boolean(clarification) || clarificationConversation.length > 0;
  const [isConversationOpen, setIsConversationOpen] = useState<boolean>(Boolean(clarification));

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const syncingFromRef = useRef<"editor" | "viewer" | null>(null);

  useEffect(() => {
    if (!hasConversationPanel) {
      setIsConversationOpen(false);
      return;
    }

    if (clarification) {
      setIsConversationOpen(true);
    }
  }, [clarification, hasConversationPanel]);

  const syncScroll = (source: HTMLElement, target: HTMLElement, from: "editor" | "viewer"): void => {
    if (syncingFromRef.current && syncingFromRef.current !== from) {
      return;
    }
    syncingFromRef.current = from;

    const sourceScrollable = source.scrollHeight - source.clientHeight;
    const targetScrollable = target.scrollHeight - target.clientHeight;
    const ratio = sourceScrollable > 0 ? source.scrollTop / sourceScrollable : 0;
    target.scrollTop = Math.max(0, ratio * Math.max(0, targetScrollable));

    window.requestAnimationFrame(() => {
      syncingFromRef.current = null;
    });
  };

  useEffect(() => {
    if (editorMode !== "split") {
      return;
    }
    if (!editorRef.current || !viewerRef.current) {
      return;
    }
    syncScroll(editorRef.current, viewerRef.current, "editor");
  }, [editorMode, postBodyDraft]);

  const hasDraftContent = postBodyDraft.trim().length > 0 || generatedPost !== null;

  return (
    <div className="workspaceBody card editorWorkspace">
      {hasDraftContent ? (
        <>
          <div className="editorToolbar">
            <div className="viewModeTabs">
              {(["split", "edit", "preview"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`viewModeTab ${editorMode === mode ? "active" : ""}`}
                  aria-pressed={editorMode === mode}
                  onClick={() => setEditorMode(mode)}
                >
                  {mode === "split" ? "Split" : mode === "edit" ? "Edit" : "Preview"}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`mdPane mode-${editorMode} editorPaneConstrained ${!hasConversationPanel || !isConversationOpen ? "expanded" : ""}`}
          >
            {editorMode !== "preview" ? (
              <MarkdownEditor
                editorRef={editorRef}
                onScroll={(event) => {
                  if (editorMode !== "split" || !viewerRef.current) {
                    return;
                  }
                  syncScroll(event.currentTarget, viewerRef.current, "editor");
                }}
                value={postBodyDraft}
                onChange={setPostBodyDraft}
              />
            ) : null}
            {editorMode !== "edit" ? (
              <MarkdownViewer
                viewerRef={viewerRef}
                onScroll={(event) => {
                  if (editorMode !== "split" || !editorRef.current) {
                    return;
                  }
                  syncScroll(event.currentTarget, editorRef.current, "viewer");
                }}
                content={postBodyDraft}
                flashHeading={flashHeading}
                flashCitation={flashCitation}
              />
            ) : null}
          </div>
        </>
      ) : clarification ? (
        <p className="editorEmptyHint">에이전트 질문에 답변한 뒤 계속 생성 버튼을 눌러 초안을 이어서 만드세요.</p>
      ) : isGenerating ? (
        <p className="editorEmptyHint">초안 생성을 준비 중입니다...</p>
      ) : (
        <p>생성된 글이 없습니다. 아래 ⚙ 버튼을 눌러 Generate Blog를 실행하거나 Posts에서 글을 선택하세요.</p>
      )}

      <GenerationConversationPanel
        clarification={clarification}
        clarificationAnswers={clarificationAnswers}
        clarificationConversation={clarificationConversation}
        onClarificationAnswerChange={onClarificationAnswerChange}
        onRetryAfterClarification={onRetryAfterClarification}
        onClearClarification={onClearClarification}
        tone={tone}
        setTone={setTone}
        format={format}
        setFormat={setFormat}
        onOpenStateChange={setIsConversationOpen}
      />
    </div>
  );
}
