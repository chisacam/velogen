import { MarkdownEditor } from "../../../../components/markdown-editor";
import { MarkdownViewer } from "../../../../components/markdown-viewer";
import { type EditorPanelProps } from "./panel-types";

export function EditorPanel({
  generatedPost,
  isGenerating,
  editorMode,
  setEditorMode,
  postBodyDraft,
  setPostBodyDraft,
  flashHeading,
  flashCitation,
  revisions,
  onLoadRevision
}: EditorPanelProps) {
  return (
    <div className="workspaceBody card">
      {generatedPost || isGenerating ? (
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

          <div className={`mdPane mode-${editorMode}`}>
            {editorMode !== "preview" ? <MarkdownEditor value={postBodyDraft} onChange={setPostBodyDraft} /> : null}
            {editorMode !== "edit" ? <MarkdownViewer content={postBodyDraft} flashHeading={flashHeading} flashCitation={flashCitation} /> : null}
          </div>

          <div className="revisionPanel">
            <h3>Generation Context</h3>
            {generatedPost?.generationMeta ? (
              <div className="generationMeta">
                <p>
                  <strong>Provider:</strong> {generatedPost.generationMeta.provider}
                </p>
                <p>
                  <strong>Tone:</strong> {generatedPost.generationMeta.tone ?? "(none)"}
                </p>
                <p>
                  <strong>Format:</strong> {generatedPost.generationMeta.format ?? "(none)"}
                </p>
                <p>
                  <strong>Instruction:</strong> {generatedPost.generationMeta.userInstruction ?? "(none)"}
                </p>
                <p>
                  <strong>Refine From:</strong> {generatedPost.generationMeta.refinePostId ?? "(new draft)"}
                </p>
                <p>
                  <strong>Used Sources:</strong>
                </p>
                <ul>
                  {generatedPost.generationMeta.sources.map((source) => (
                    <li key={source.sourceId}>
                      {source.name} ({source.type})
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No saved generation context for this post.</p>
            )}

            <h3>Revision History</h3>
            {revisions.length === 0 ? <p>No revisions yet.</p> : null}
            {revisions.length > 0 ? (
              <ul>
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    v{revision.version} - {revision.source} - {revision.status} - {new Date(revision.createdAt).toLocaleString()}
                    <button type="button" className="tinyButton" onClick={() => void onLoadRevision(revision.id)}>
                      Load
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : (
        <p>생성된 글이 없습니다. 아래 ⚙ 버튼을 눌러 Generate Blog를 실행하거나 Posts에서 글을 선택하세요.</p>
      )}
    </div>
  );
}
