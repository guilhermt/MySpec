import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckStrip } from "@/features/reviews/CheckStrip";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeState } from "@/test/wails-mock";

const MINUTE = 60_000;
const FAILURE = "GitHub's rate limit was reached. It resets at 14:32.";

// stripDrawn is the strip on screen, which has no role when its failure was there at the first draw.
function stripDrawn(): HTMLElement {
  const notice = document.querySelector<HTMLElement>('[data-slot="notice-strip"]');
  if (notice === null) {
    throw new Error("the strip is not drawn");
  }
  return notice;
}

function strip(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({
    checkError: FAILURE,
    checkErrorAt: new Date(Date.now() - 3 * MINUTE).toISOString(),
    ...overrides,
  });
  return renderWithStore(<CheckStrip review={review} />, {
    state: makeState({ reviews: [review] }),
  });
}

describe("CheckStrip", () => {
  it("says when the failures began and why, and what shows after the next reading", () => {
    strip();

    const notice = stripDrawn();
    expect(notice).toHaveTextContent("Couldn't check GitHub · 3m ago");
    expect(notice).toHaveTextContent(FAILURE);
    expect(notice).toHaveTextContent(
      "New commits, checks and the merge show after the next reading.",
    );
  });

  it("is no alert when the failure was there at the first draw, and is one when it arrives later", () => {
    const { rerender } = strip();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const healthy = makeReviewSummary({ checkError: "", checkErrorAt: "" });
    rerender(<CheckStrip review={healthy} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(
      <CheckStrip
        review={{ ...healthy, checkError: FAILURE, checkErrorAt: new Date().toISOString() }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check GitHub");
  });

  it("is not there without a failure", () => {
    strip({ checkError: "", checkErrorAt: "" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is not there while the bar of a blocked pass says the failure", () => {
    strip({ status: "pass_blocked" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reads the pull request again on Try again, saying Reading… until the call comes back", async () => {
    let answer: () => void = () => {};
    vi.mocked(api.refreshReviewPR).mockReturnValueOnce(
      new Promise<void>((settle) => {
        answer = settle;
      }),
    );
    const { user } = strip();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.refreshReviewPR).toHaveBeenCalledWith("review-1");
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await act(async () => answer());
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
