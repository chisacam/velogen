import { type GenerationPanelProps } from "./panel-types";

export function FloatingGenerationPanel({
  genPanelOpen,
  setGenPanelOpen,
  generateMode,
  setGenerateMode,
  postStatusDraft,
  setPostStatusDraft,
  autoGenerateImages,
  setAutoGenerateImages,
  isGenerating,
  isGeneratingImages,
  onGenerate,
  onSavePost,
  onExportMarkdown,
  userInstruction,
  setUserInstruction,
  generatedPost,
  selectedPostId,
  postBodyDraft,
  tone,
  setTone,
  format,
  setFormat
}: GenerationPanelProps) {
  return (
    <div className={`genPanelFloating ${genPanelOpen ? "open" : "closed"}`}>
      <button
        type="button"
        className={`genPanelCollapsed ${isGenerating || isGeneratingImages ? "generating" : ""}`}
        aria-label={genPanelOpen ? "Close generation panel" : "Open generation panel"}
        onClick={() => setGenPanelOpen(!genPanelOpen)}
        title="Toggle generation panel"
      >
        <span className="genPanelBtnIcon">
          {isGenerating || isGeneratingImages ? <div className="collapsedSpinner" /> : "⚙"}
        </span>
        <span className="genPanelBtnText">Generation Settings</span>
      </button>

      <div className="genPanelExpanded">
        <div className="genPanelHeader">
          <span className="genPanelTitle">⚙ Generation Settings</span>
          <button
            type="button"
            className="genPanelClose"
            aria-label="Close generation panel"
            onClick={() => setGenPanelOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="genPanelBody">
          <p className="genPanelHint">질문/답변 대화 로그는 Editor 패널 하단 Conversation에서 확인하고 답변할 수 있습니다.</p>

          <div className="genPanelRow">
            <div className="instructionModeRow">
              <span className="instructionLabel">Mode</span>
              <div className="modeToggleGroup">
                <button
                  id="mode-new"
                  type="button"
                  className={generateMode === "new" ? "modeToggle active" : "modeToggle"}
                  aria-pressed={generateMode === "new"}
                  onClick={() => setGenerateMode("new")}
                >
                  ✦ New Draft
                </button>
                <button
                  id="mode-refine"
                  type="button"
                  className={generateMode === "refine" ? "modeToggle active" : "modeToggle"}
                  aria-pressed={generateMode === "refine"}
                  onClick={() => setGenerateMode("refine")}
                  disabled={!selectedPostId}
                  title={!selectedPostId ? "먼저 글을 선택하거나 생성하세요" : "현재 에디터의 글을 수정합니다"}
                >
                  ✎ Refine
                </button>
              </div>
            </div>

            <div className="instructionModeRow">
              <span className="instructionLabel">Status</span>
              <div className="modeToggleGroup">
                <button
                  type="button"
                  className={postStatusDraft === "draft" ? "modeToggle active" : "modeToggle"}
                  aria-pressed={postStatusDraft === "draft"}
                  onClick={() => setPostStatusDraft("draft")}
                >
                  Draft
                </button>
                <button
                  type="button"
                  className={postStatusDraft === "published" ? "modeToggle active" : "modeToggle"}
                  aria-pressed={postStatusDraft === "published"}
                  onClick={() => setPostStatusDraft("published")}
                >
                  Published
                </button>
              </div>
            </div>

            <div className="instructionModeRow">
              <button
                type="button"
                className={autoGenerateImages ? "modeToggle autoImageToggle active" : "modeToggle autoImageToggle"}
                aria-pressed={autoGenerateImages}
                onClick={() => setAutoGenerateImages(!autoGenerateImages)}
                disabled={isGenerating || isGeneratingImages}
              >
                Auto Images
              </button>
            </div>
          </div>

          <div className="genPanelRow inputsRow">
            <label className="generationFieldWrap">
              <span className="instructionLabel">Tone</span>
              <input value={tone} onChange={(event) => setTone(event.target.value)} placeholder="예: 차분한 회고형" />
            </label>
            <label className="generationFieldWrap">
              <span className="instructionLabel">Format</span>
              <input value={format} onChange={(event) => setFormat(event.target.value)} placeholder="예: 튜토리얼, 기술 분석" />
            </label>
          </div>

          {generateMode === "refine" && selectedPostId ? (
            <span className="refineBadge">수정 대상: {generatedPost?.title ?? selectedPostId}</span>
          ) : null}

          <label className="instructionInputWrap">
            <span className="instructionLabel">
              Agent Instruction <span className="optionalTag">(optional)</span>
            </span>
            <textarea
              id="user-instruction"
              className="instructionTextarea"
              value={userInstruction}
              onChange={(event) => setUserInstruction(event.target.value)}
              placeholder={
                generateMode === "refine"
                  ? "예: 3번째 섹션을 더 자세하게 작성해줘. 코드 예시를 추가해줘."
                  : "예: 배포 관련 내용을 주인공으로 삼아줘. 결론을 더 강조해줘."
              }
              rows={2}
              disabled={isGenerating}
            />
          </label>
        </div>

        <div className="genPanelActions">
          <button type="button" onClick={() => void onGenerate()} disabled={isGenerating}>
            {isGenerating ? (
              <span className="btnSpinner">
                Generating
                <span className="spinnerDots">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            ) : (
              "✦ Generate Blog"
            )}
          </button>
          <button type="button" className="secondary" onClick={() => void onSavePost()} disabled={!postBodyDraft || isGenerating}>
            💾 Save
          </button>
          <button type="button" className="secondary" onClick={() => void onExportMarkdown()} disabled={!postBodyDraft}>
            📄 Export .md
          </button>
        </div>
      </div>
    </div>
  );
}
