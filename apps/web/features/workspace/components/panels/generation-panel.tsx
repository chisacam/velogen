import { type GenerationPanelProps } from "./panel-types";
import styles from "./generation-panel.module.css";
import commonStyles from "./common-panel.module.css";
import panelStyles from "./conversation-panel.module.css";

export function GenerationPanel({
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
    <section className={`${commonStyles.collapsiblePanel} ${!genPanelOpen ? commonStyles.collapsed : ""}`} aria-live="polite">
      <div className={commonStyles.panelHeaderRow}>
        <button
          type="button"
          className={commonStyles.panelToggle}
          aria-expanded={genPanelOpen}
          onClick={() => setGenPanelOpen(!genPanelOpen)}
          title="Generation settings"
        >
          <span className={styles.genPanelTitleWrapper}>
            {isGenerating || isGeneratingImages ? <div className={`${styles.collapsedSpinner} ${styles.genCollapsedSpinnerWrapper}`} /> : null}
            Generation Settings
          </span>
        </button>
      </div>

      {genPanelOpen && (
        <div className={styles.genContentWrapper}>
          <div className={`${styles.genPanelBody} ${styles.genPanelBodyPadding}`}>
            <div className={styles.genPanelRow}>
              <div className={styles.instructionModeRow}>
                <span className={styles.instructionLabel}>Mode</span>
                <div className={styles.modeToggleGroup}>
                  <button
                    id="mode-new"
                    type="button"
                    className={generateMode === "new" ? `${styles.modeToggle} ${styles.active}` : styles.modeToggle}
                    aria-pressed={generateMode === "new"}
                    onClick={() => setGenerateMode("new")}
                  >
                    ✦ New Draft
                  </button>
                  <button
                    id="mode-refine"
                    type="button"
                    className={generateMode === "refine" ? `${styles.modeToggle} ${styles.active}` : styles.modeToggle}
                    aria-pressed={generateMode === "refine"}
                    onClick={() => setGenerateMode("refine")}
                    disabled={!selectedPostId}
                    title={!selectedPostId ? "먼저 글을 선택하거나 생성하세요" : "현재 에디터의 글을 수정합니다"}
                  >
                    ✎ Refine
                  </button>
                </div>
              </div>

              <div className={styles.instructionModeRow}>
                <span className={styles.instructionLabel}>Status</span>
                <div className={styles.modeToggleGroup}>
                  <button
                    type="button"
                    className={postStatusDraft === "draft" ? `${styles.modeToggle} ${styles.active}` : styles.modeToggle}
                    aria-pressed={postStatusDraft === "draft"}
                    onClick={() => setPostStatusDraft("draft")}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    className={postStatusDraft === "published" ? `${styles.modeToggle} ${styles.active}` : styles.modeToggle}
                    aria-pressed={postStatusDraft === "published"}
                    onClick={() => setPostStatusDraft("published")}
                  >
                    Published
                  </button>
                </div>
              </div>

              <div className={styles.instructionModeRow}>
                <button
                  type="button"
                  className={autoGenerateImages ? `${styles.modeToggle} ${styles.autoImageToggle} ${styles.active}` : `${styles.modeToggle} ${styles.autoImageToggle}`}
                  aria-pressed={autoGenerateImages}
                  onClick={() => setAutoGenerateImages(!autoGenerateImages)}
                  disabled={isGenerating || isGeneratingImages}
                >
                  Auto Images
                </button>
              </div>
            </div>

            <div className={`${styles.genPanelRow} ${styles.inputsRow}`}>
              <label className={styles.generationFieldWrap}>
                <span className={styles.instructionLabel}>Tone</span>
                <input value={tone} onChange={(event) => setTone(event.target.value)} placeholder="예: 차분한 회고형" />
              </label>
              <label className={styles.generationFieldWrap}>
                <span className={styles.instructionLabel}>Format</span>
                <input value={format} onChange={(event) => setFormat(event.target.value)} placeholder="예: 튜토리얼, 기술 분석" />
              </label>
            </div>

            {generateMode === "refine" && selectedPostId ? (
              <span className={styles.refineBadge}>수정 대상: {generatedPost?.title ?? selectedPostId}</span>
            ) : null}

            <label className={styles.instructionInputWrap}>
              <span className={styles.instructionLabel}>
                Agent Instruction <span className={styles.optionalTag}>(optional)</span>
              </span>
              <textarea
                id="user-instruction"
                className={styles.instructionTextarea}
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

          <div className={styles.genPanelActions}>
            <button type="button" className={`primary ${commonStyles.tinyButton} ${styles.genButtonFlex}`} onClick={() => void onGenerate()} disabled={isGenerating}>
              {isGenerating ? (
                <span className={styles.btnSpinner}>
                  Generating
                  <span className={styles.spinnerDots}>
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
              ) : (
                "Generate Blog"
              )}
            </button>
            <button type="button" className={`secondary ${commonStyles.tinyButton}`} onClick={() => void onSavePost()} disabled={!postBodyDraft || isGenerating}>
              Save
            </button>
            <button type="button" className={`secondary ${commonStyles.tinyButton}`} onClick={() => void onExportMarkdown()} disabled={!postBodyDraft}>
              Export .md
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
