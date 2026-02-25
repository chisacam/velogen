import { useEffect, useRef, useState } from "react";
import type {
  GenerationClarificationAnswer,
  GenerationClarificationResponse
} from "@velogen/shared";
import type { GenerationConversationTurn } from "../../types";
import styles from "./conversation-panel.module.css";
import commonStyles from "./common-panel.module.css";

type GenerationConversationPanelProps = {
  clarification: GenerationClarificationResponse | null;
  clarificationAnswers: GenerationClarificationAnswer[];
  clarificationConversation: GenerationConversationTurn[];
  onClarificationAnswerChange: (questionId: string, question: string, answer: string) => void;
  onRetryAfterClarification: (clarificationDraftAnswers?: GenerationClarificationAnswer[], forceSkip?: boolean) => Promise<void>;
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
    // 새로운 질문(clarification)이 도착하면 입력폼을 초기화합니다.
    setDraftAnswers({});
    composingByQuestionIdRef.current = {};
  }, [clarification]);

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
    <section className={`${commonStyles.collapsiblePanel} ${!isOpen ? commonStyles.collapsed : ""}`} aria-live="polite">
      <div className={commonStyles.panelHeaderRow}>
        <button
          type="button"
          className={commonStyles.panelToggle}
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
        >
          <span>Conversation</span>
          <span className={commonStyles.panelMeta}>{clarificationConversation.length} turns</span>
        </button>

        <button type="button" className={`secondary ${commonStyles.tinyButton}`} onClick={() => { setDraftAnswers({}); onClearClarification(); }}>
          대화 초기화
        </button>
      </div>

      {isOpen ? (
        <>
          {clarificationConversation.length > 0 ? (
            <div className={styles.conversationLog}>
              {clarificationConversation.map((turn) => {
                if (turn.role === "agent") {
                  return (
                    <article key={turn.id} className={`${styles.conversationTurn} ${styles.agent}`}>
                      <span className={styles.conversationRole}>Agent</span>
                      <p className={styles.conversationMessage}>{turn.message}</p>
                      {turn.questions.length > 0 ? (
                        <ul className={styles.conversationQuestionList}>
                          {turn.questions.map((question) => (
                            <li key={question.id}>{question.question}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                }

                return (
                  <article key={turn.id} className={`${styles.conversationTurn} ${styles.user}`}>
                    <span className={styles.conversationRole}>You</span>
                    <ul className={styles.conversationAnswerList}>
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
            <div className={styles.conversationComposer}>
              <p className={styles.conversationComposerMessage}>{clarification.message}</p>

              {(clarification.clarifyingQuestions?.length ?? 0) > 0 ? (
                <div className={styles.conversationQuestionFields}>
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
                <div className={styles.conversationMissingFields}>
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

              <div className={styles.conversationActions}>
                <button
                  type="button"
                  className={`secondary ${commonStyles.tinyButton} ${styles.actionButtonMargin}`}
                  onClick={() => {
                    const answers = buildRetryAnswers();
                    setDraftAnswers({});
                    void onRetryAfterClarification(answers, true);
                  }}
                  title="질문을 건너뛰고 바로 생성을 시작합니다."
                >
                  답변 없이 바로 생성
                </button>
                <button
                  type="button"
                  className={`primary ${commonStyles.tinyButton}`}
                  onClick={() => {
                    const answers = buildRetryAnswers();
                    setDraftAnswers({});
                    void onRetryAfterClarification(answers, false);
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
