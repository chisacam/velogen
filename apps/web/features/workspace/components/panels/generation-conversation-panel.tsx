import { useEffect, useRef, useState } from "react";
import type {
  GenerationClarificationAnswer,
  GenerationClarificationResponse
} from "@velogen/shared";
import type { GenerationConversationTurn } from "../../types";

type GenerationConversationPanelProps = {
  clarification: GenerationClarificationResponse | null;
  clarificationAnswers: GenerationClarificationAnswer[];
  clarificationConversation: GenerationConversationTurn[];
  onClarificationAnswerChange: (questionId: string, question: string, answer: string) => void;
  onRetryAfterClarification: (clarificationDraftAnswers?: GenerationClarificationAnswer[]) => Promise<void>;
  onClearClarification: () => void;
  tone: string;
  setTone: (tone: string) => void;
  format: string;
  setFormat: (format: string) => void;
  onOpenStateChange?: (isOpen: boolean) => void;
};

export function GenerationConversationPanel({
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
  onOpenStateChange
}: GenerationConversationPanelProps) {
  const hasPanelContent = Boolean(clarification) || clarificationConversation.length > 0;
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(clarification));
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const composingByQuestionIdRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (clarification) {
      setIsOpen(true);
    }
  }, [clarification]);

  useEffect(() => {
    onOpenStateChange?.(isOpen);
  }, [isOpen, onOpenStateChange]);

  useEffect(() => {
    if (!hasPanelContent) {
      onOpenStateChange?.(false);
    }
  }, [hasPanelContent, onOpenStateChange]);

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

  if (!hasPanelContent) {
    return null;
  }

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

  return (
    <section className="conversationPanel" aria-live="polite">
      <div className="conversationHeaderRow">
        <button
          type="button"
          className="conversationToggle"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          <span>Conversation</span>
          <span className="conversationMeta">{clarificationConversation.length} turns</span>
        </button>

        <button type="button" className="secondary tinyButton" onClick={onClearClarification}>
          대화 초기화
        </button>
      </div>

      {isOpen ? (
        <>
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
        </>
      ) : null}
    </section>
  );
}
