import { useState } from "react";
import { type BlogReviewResult, type BlogReviewSuggestion } from "@velogen/shared";
import styles from "./review-panel.module.css";
import commonStyles from "./common-panel.module.css";

type ReviewPanelProps = {
    isReviewing: boolean;
    reviewResult: BlogReviewResult | null;
    onApplySuggestion: (index: number) => void;
    onClose: () => void;
    postBodyDraft: string;
    onReviewPost: () => Promise<void>;
};

export function ReviewPanel({
    isReviewing,
    reviewResult,
    onApplySuggestion,
    onClose,
    postBodyDraft,
    onReviewPost
}: ReviewPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <section className={`${commonStyles.collapsiblePanel} reviewPanel ${!isOpen ? commonStyles.collapsed : ""}`} aria-live="polite">
            <div className={commonStyles.panelHeaderRow}>
                <button
                    type="button"
                    className={commonStyles.panelToggle}
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span>Review & Suggestions</span>
                    {reviewResult?.suggestions?.length ? <span className={commonStyles.panelMeta}>{reviewResult.suggestions.length} suggestions</span> : null}
                </button>
            </div>

            {isOpen && (
                <div className={styles.reviewContentWrapper}>
                    <div className={styles.genPanelActions}>
                        <button
                            type="button"
                            className={`primary ${commonStyles.tinyButton} ${styles.reviewDraftBtn}`}
                            onClick={() => void onReviewPost()}
                            disabled={isReviewing || !postBodyDraft}
                        >
                            {isReviewing ? "리뷰 중..." : "Review Draft"}
                        </button>
                        {reviewResult && (
                            <button type="button" className={`secondary ${commonStyles.tinyButton}`} onClick={onClose} title="리뷰 초기화">
                                초기화
                            </button>
                        )}
                    </div>

                    {isReviewing ? (
                        <p className={`${commonStyles.editorEmptyHint} ${styles.reviewingHint}`}>AI가 글을 리뷰하고 있습니다...</p>
                    ) : reviewResult && reviewResult.suggestions ? (
                        <div className={styles.suggestionsList}>
                            {reviewResult.suggestions.length > 0 ? (
                                reviewResult.suggestions.map((suggestion: BlogReviewSuggestion, index: number) => {
                                    const isApplyable = postBodyDraft.includes(suggestion.originalText);

                                    return (
                                        <div key={index} className={`${styles.suggestionCard} ${!isApplyable ? styles.disabled : ""}`}>
                                            <p className={styles.suggestionReason}><strong>이유:</strong> {suggestion.reason}</p>

                                            <div className={styles.suggestionDiff}>
                                                <div className={styles.diffOriginal}>
                                                    <span className={styles.diffLabel}>기존</span>
                                                    <p>{suggestion.originalText}</p>
                                                </div>
                                                <div className={styles.diffSuggested}>
                                                    <span className={styles.diffLabel}>제안</span>
                                                    <p>{suggestion.suggestedText}</p>
                                                </div>
                                            </div>

                                            <div className={styles.suggestionActions}>
                                                <button
                                                    type="button"
                                                    className="applySuggestionButton"
                                                    onClick={() => onApplySuggestion(index)}
                                                    disabled={!isApplyable}
                                                    title={!isApplyable ? "원문이 에디터에서 변경되어 적용할 수 없습니다." : "제안 직접 적용"}
                                                >
                                                    {isApplyable ? "제안 적용" : "적용 완료"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className={`${commonStyles.editorEmptyHint} ${styles.noSuggestionsHint}`}>개선 제안이 없습니다.</p>
                            )}
                        </div>
                    ) : (
                        <p className={`${commonStyles.editorEmptyHint} ${styles.notReviewedHint}`}>아직 리뷰를 진행하지 않았습니다. 위에 있는 버튼을 클릭해 리뷰를 시작하세요.</p>
                    )}
                </div>
            )}
        </section>
    );
}
