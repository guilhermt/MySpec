import { beforeEach, describe, expect, it } from "vitest";
import { textKey } from "@/components/useEditedText";
import { passRevision } from "@/features/reviews/pass-revision";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

describe("passRevision", () => {
  it("reads the report a pass stands at now", () => {
    const review = makeReviewSummary({ passes: [makeReviewPass({ pass: 1, revision: 3 })] });
    useAppStore.setState({ app: makeState({ reviews: [review] }) });

    expect(passRevision(review.id, 1)).toBe(3);
  });

  it("is null once the review or the pass is gone", () => {
    const review = makeReviewSummary({ passes: [makeReviewPass({ pass: 1, revision: 3 })] });
    useAppStore.setState({ app: makeState({ reviews: [review] }) });

    expect(passRevision(review.id, 2)).toBeNull();
    expect(passRevision("gone", 1)).toBeNull();
  });

  it("names the texts of a review apart", () => {
    expect(textKey("review-1", 2, 3)).toBe("review-1|2|3");
    expect(textKey("review-1", 2, "summary")).toBe("review-1|2|summary");
  });
});
