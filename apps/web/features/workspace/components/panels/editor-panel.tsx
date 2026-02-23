import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "../../../../components/markdown-editor";
import { MarkdownViewer } from "../../../../components/markdown-viewer";
import { type EditorPanelProps } from "./panel-types";
import { GenerationConversationPanel } from "./generation-conversation-panel";
import { ReviewPanel } from "./review-panel";
import { GenerationPanel } from "./generation-panel";
import styles from "./editor-panel.module.css";
import commonStyles from "./common-panel.module.css";

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
  setFormat,
  isReviewing,
  reviewResult,
  onReviewPost,
  onApplySuggestion,
  setReviewResult,
  ...genProps
}: EditorPanelProps) {
  const hasConversationPanel = Boolean(clarification) || clarificationConversation.length > 0;

  const [isConversationOpen, setIsConversationOpen] = useState<boolean>(Boolean(clarification));
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

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
    <div className={`${commonStyles.workspaceBody} ${commonStyles.card} ${commonStyles.editorWorkspace} `}>
      <div className={commonStyles.editorMainColumn}>
        {hasDraftContent ? (
          <>
            <div className={styles.editorToolbar}>
              <div className={styles.viewModeTabs}>
                {(["split", "edit", "preview"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles.viewModeTab} ${editorMode === mode ? styles.active : ""} `}
                    aria-pressed={editorMode === mode}
                    onClick={() => setEditorMode(mode)}
                  >
                    {mode === "split" ? "Split" : mode === "edit" ? "Edit" : "Preview"}
                  </button>
                ))}
              </div>

              <div className="editorActions">
                <button
                  type="button"
                  className={`secondary ${commonStyles.tinyButton} `}
                  onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                  title="오른쪽 사이드바 토글"
                >
                  {isRightSidebarOpen ? "➡️ Hide Panel" : "⬅️ Show Panel"}
                </button>
              </div>
            </div>

            <div
              className={`${styles.mdPane} ${editorMode === "split" ? styles.mdPaneSplit : ""} ${!isRightSidebarOpen ? styles.expanded : ""} `}
            >
              {editorMode !== "preview" ? (
                <MarkdownEditor
                  editorRef={editorRef}
                  className={styles.constrainedEditor}
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
                  className={styles.constrainedViewer}
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
          <p className={commonStyles.editorEmptyHint}>에이전트 질문에 답변한 뒤 계속 생성 버튼을 눌러 초안을 이어서 만드세요.</p>
        ) : isGenerating ? (
          <p className={commonStyles.editorEmptyHint}>초안 생성을 준비 중입니다...</p>
        ) : (
          <p>생성된 글이 없습니다. 아래 ⚙ 버튼을 눌러 Generate Blog를 실행하거나 Posts에서 글을 선택하세요.</p>
        )}
      </div>

      {isRightSidebarOpen && (
        <div className={commonStyles.editorRightSidebar}>
          <ReviewPanel
            isReviewing={isReviewing}
            reviewResult={reviewResult}
            onReviewPost={onReviewPost}
            onApplySuggestion={onApplySuggestion}
            onClose={() => setReviewResult(null)}
            postBodyDraft={postBodyDraft}
          />
          {hasConversationPanel && (
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
          )}
          <GenerationPanel
            {...genProps}
            isGenerating={isGenerating}
            postBodyDraft={postBodyDraft}
            tone={tone}
            setTone={setTone}
            format={format}
            setFormat={setFormat}
            generatedPost={generatedPost}
          />
        </div>
      )}
    </div>
  );
}
