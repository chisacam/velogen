import { useEffect, useRef, useState } from "react";
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
  clarification,
  tone,
  setTone,
  format,
  setFormat,
  clarificationAnswers,
  onClarificationAnswerChange,
  onRetryAfterClarification,
  onClearClarification
}: GenerationPanelProps) {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const composingByQuestionIdRef = useRef<Record<string, boolean>>({});

  const clarificationQuestionAnswers = new Map(
    clarificationAnswers.map((answer) => [answer.questionId, answer.answer])
  );

  const getDraftAnswer = (questionId: string): string => {
    return draftAnswers[questionId] ?? clarificationQuestionAnswers.get(questionId) ?? "";
  };

  useEffect(() => {
    setDraftAnswers((previous) => {
      const next = { ...previous };
      const nextKeys = new Set<string>();

      for (const answer of clarificationAnswers) {
        next[answer.questionId] = answer.answer;
        nextKeys.add(answer.questionId);
      }

      for (const key of Object.keys(next)) {
        if (!nextKeys.has(key)) {
          delete next[key];
        }
      }

      return next;
    });
  }, [clarificationAnswers]);

  const updateDraftAnswer = (questionId: string, value: string): void => {
    setDraftAnswers((previous) => ({
      ...previous,
      [questionId]: value
    }));
  };

  const commitToParent = (questionId: string, question: string, value: string): void => {
    onClarificationAnswerChange(questionId, question, value);
  };

  const handleCompositionStart = (questionId: string): void => {
    composingByQuestionIdRef.current[questionId] = true;
  };

  const handleCompositionEnd = (questionId: string, question: string, event: React.CompositionEvent<HTMLTextAreaElement>): void => {
    composingByQuestionIdRef.current[questionId] = false;
    const value = event.currentTarget.value;
    updateDraftAnswer(questionId, value);
    commitToParent(questionId, question, value);
  };

  const handleBlurCommit = (questionId: string, question: string, value: string): void => {
    if (composingByQuestionIdRef.current[questionId]) {
      return;
    }
    commitToParent(questionId, question, value);
  };

  const buildRetryAnswers = (): Array<{ questionId: string; question: string; answer: string }> => {
    if (!clarification?.clarifyingQuestions) {
      return [];
    }

    return clarification.clarifyingQuestions
      .map((question) => {
        const answer = getDraftAnswer(question.id);
        return {
          questionId: question.id,
          question: question.question,
          answer
        };
      })
      .filter((answer) => answer.answer.trim().length > 0);
  };

  return (
    <div className={`genPanelFloating ${genPanelOpen ? "open" : "closed"}`}>
      <button
        type="button"
        className={`genPanelCollapsed ${isGenerating || isGeneratingImages ? "generating" : ""}`}
        aria-label="Open generation panel"
        onClick={() => setGenPanelOpen(true)}
        title="Open generation panel"
      >
        {isGenerating || isGeneratingImages ? <div className="collapsedSpinner" /> : "⚙"}
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
          {clarification ? (
            <div className="clarificationCard">
              <div className="clarificationHeader">필수 입력값 확인</div>
              <p className="clarificationMessage">{clarification.message}</p>

              {(clarification.clarifyingQuestions?.length ?? 0) > 0 ? (
                <div className="clarificationQuestionList">
                  <div className="clarificationSubHeader">AI가 추가 보완 정보를 요청합니다</div>
                  {clarification.clarifyingQuestions?.map((question) => {
                    return (
                      <label key={question.id} className="clarificationFieldWrap">
                        <span className="clarificationLabel">{question.question}</span>
                        <textarea
                          className="clarificationTextarea"
                          value={getDraftAnswer(question.id)}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateDraftAnswer(question.id, value);
                            if (!composingByQuestionIdRef.current[question.id]) {
                              commitToParent(question.id, question.question, value);
                            }
                          }}
                          onCompositionStart={() => handleCompositionStart(question.id)}
                          onCompositionEnd={(event) => handleCompositionEnd(question.id, question.question, event)}
                          onBlur={(event) => {
                            handleBlurCommit(question.id, question.question, event.currentTarget.value);
                          }}
                          placeholder="답변을 입력해 주세요."
                          rows={2}
                        />
                        {question.rationale ? <span className="clarificationRationale">{question.rationale}</span> : null}
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {clarification.missing.some((item) => item.field === "tone") ? (
                <label className="clarificationFieldWrap">
                  <span className="clarificationLabel">Tone / Style</span>
                  <input
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    placeholder={`추천값: ${clarification.defaults.tone}`}
                  />
                  <button
                    type="button"
                    className="secondary tinyButton"
                    onClick={() => setTone(clarification.defaults.tone)}
                  >
                    기본값 적용
                  </button>
                </label>
              ) : null}

              {clarification.missing.some((item) => item.field === "format") ? (
                <label className="clarificationFieldWrap">
                  <span className="clarificationLabel">Format</span>
                  <input
                    value={format}
                    onChange={(event) => setFormat(event.target.value)}
                    placeholder={`추천값: ${clarification.defaults.format}`}
                  />
                  <button
                    type="button"
                    className="secondary tinyButton"
                    onClick={() => setFormat(clarification.defaults.format)}
                  >
                    기본값 적용
                  </button>
                </label>
              ) : null}

              <div className="clarificationActions">
                <button type="button" className="secondary" onClick={() => {
                  onClearClarification();
                }}>
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onRetryAfterClarification(buildRetryAnswers());
                  }}
                >
                  입력값 보완 후 생성
                </button>
              </div>
            </div>
          ) : null}

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
          {generateMode === "refine" && selectedPostId && (
            <span className="refineBadge">수정 대상: {generatedPost?.title ?? selectedPostId}</span>
          )}

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
