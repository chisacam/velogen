import { useState } from "react";
import { type BlogReviewResult, type BlogReviewSuggestion } from "@velogen/shared";

type ReviewPanelProps = {
    isReviewing: boolean;
    reviewResult: BlogReviewResult | null;
    onApplySuggestion: (index: number) => void;
    onClose: () => void;
    postBodyDraft: string;
};

export function ReviewPanel({
    isReviewing,
    reviewResult,
    onApplySuggestion,
    onClose,
    postBodyDraft
}: ReviewPanelProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (!isReviewing && !reviewResult) {
        return null;
    }

    return (
        <section className={`conversationPanel reviewPanel ${!isOpen ? "collapsed" : ""}`} aria-live="polite">
            <div className="conversationHeaderRow">
                <button
                    type="button"
                    className="conversationToggle"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span>Review & Suggestions</span>
                    {reviewResult?.suggestions?.length ? <span className="conversationMeta">{reviewResult.suggestions.length} suggestions</span> : null}
                </button>
                <button type="button" className="secondary tinyButton" onClick={onClose} title="리뷰 초기화">
                    초기화
                </button>
            </div>

            {isOpen && (
                <div className="reviewContent" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {isReviewing ? (
                        <p className="editorEmptyHint" style={{ padding: "8px" }}>AI가 글을 리뷰하고 있습니다...</p>
                    ) : reviewResult ? (
                        <div className="suggestionsList" style={{ overflowY: "auto", flex: 1, paddingRight: "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {reviewResult.suggestions.length > 0 ? (
                                reviewResult.suggestions.map((suggestion: BlogReviewSuggestion, index: number) => {
                                    const isApplyable = postBodyDraft.includes(suggestion.originalText);

                                    return (
                                        <div key={index} className={`suggestionCard ${!isApplyable ? "disabled" : ""}`}>
                                            <p className="suggestionReason"><strong>이유:</strong> {suggestion.reason}</p>

                                            <div className="suggestionDiff">
                                                <div className="diffOriginal">
                                                    <span className="diffLabel">기존</span>
                                                    <p>{suggestion.originalText}</p>
                                                </div>
                                                <div className="diffSuggested">
                                                    <span className="diffLabel">제안</span>
                                                    <p>{suggestion.suggestedText}</p>
                                                </div>
                                            </div>

                                            <div className="suggestionActions">
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
                                <p className="editorEmptyHint" style={{ padding: "8px" }}>개선 제안이 없습니다.</p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </section>
    );
}
