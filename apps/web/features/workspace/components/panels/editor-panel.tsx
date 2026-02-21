import { useEffect, useRef, useState } from "react";
import type { GenerationClarificationAnswer } from "@velogen/shared";
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
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const composingByQuestionIdRef = useRef<Record<string, boolean>>({});

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const syncingFromRef = useRef<"editor" | "viewer" | null>(null);

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

  const getDraftAnswer = (questionId: string): string => {
    const matched = clarificationAnswers.find((answer) => answer.questionId === questionId);
    return draftAnswers[questionId] ?? matched?.answer ?? "";
  };

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

  const handleCompositionEnd = (
    questionId: string,
    question: string,
    event: React.CompositionEvent<HTMLTextAreaElement>
  ): void => {
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

  const buildRetryAnswers = (): GenerationClarificationAnswer[] => {
    if (!clarification?.clarifyingQuestions) {
      return [];
    }

    return clarification.clarifyingQuestions
      .map((question) => ({
        questionId: question.id,
        question: question.question,
        answer: getDraftAnswer(question.id)
      }))
      .filter((answer) => answer.answer.trim().length > 0);
  };

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

  return (
    <div className="workspaceBody card editorWorkspace">
      {clarification || clarificationConversation.length > 0 ? (
        <section className="conversationPanel" aria-live="polite">
          <div className="conversationHeaderRow">
            <h3>Conversation</h3>
            <button type="button" className="secondary tinyButton" onClick={onClearClarification}>
              대화 초기화
            </button>
          </div>

          {clarificationConversation.length > 0 ? (
            <div className="conversationLog">
              {clarificationConversation.map((turn) => {
                if (turn.role === "agent") {
                  return (
                    <article key={turn.id} className="conversationTurn agent">
                      <span className="conversationRole">Agent</span>
                      <p className="conversationMessage">{turn.message}</p>
                      {turn.questions.length > 0 ? (
                        <ul className="conversationQuestionList">
                          {turn.questions.map((question) => (
                            <li key={question.id}>{question.question}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                }

                return (
                  <article key={turn.id} className="conversationTurn user">
                    <span className="conversationRole">You</span>
                    <ul className="conversationAnswerList">
                      {turn.answers.map((answer) => (
                        <li key={`${turn.id}-${answer.questionId}`}>
                          <strong>{answer.question}</strong>
                          <p>{answer.answer}</p>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          ) : null}

          {clarification ? (
            <div className="conversationComposer">
              <p className="conversationComposerMessage">{clarification.message}</p>

              {(clarification.clarifyingQuestions?.length ?? 0) > 0 ? (
                <div className="conversationQuestionFields">
                  {clarification.clarifyingQuestions?.map((question) => (
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
                        rows={3}
                      />
                      {question.rationale ? <span className="clarificationRationale">{question.rationale}</span> : null}
                    </label>
                  ))}
                </div>
              ) : null}

              {clarification.missing.some((item) => item.field === "tone") || clarification.missing.some((item) => item.field === "format") ? (
                <div className="conversationMissingFields">
                  {clarification.missing.some((item) => item.field === "tone") ? (
                    <label className="clarificationFieldWrap">
                      <span className="clarificationLabel">Tone</span>
                      <input value={tone} onChange={(event) => setTone(event.target.value)} placeholder={clarification.defaults.tone} />
                    </label>
                  ) : null}
                  {clarification.missing.some((item) => item.field === "format") ? (
                    <label className="clarificationFieldWrap">
                      <span className="clarificationLabel">Format</span>
                      <input value={format} onChange={(event) => setFormat(event.target.value)} placeholder={clarification.defaults.format} />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="conversationActions">
                <button
                  type="button"
                  onClick={() => {
                    void onRetryAfterClarification(buildRetryAnswers());
                  }}
                >
                  답변 전송 후 계속 생성
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

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

          <div className={`mdPane mode-${editorMode} editorPaneConstrained`}>
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
      ) : (
        <p>생성된 글이 없습니다. 아래 ⚙ 버튼을 눌러 Generate Blog를 실행하거나 Posts에서 글을 선택하세요.</p>
      )}
    </div>
  );
}
