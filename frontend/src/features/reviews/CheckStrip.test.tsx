import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckStrip } from "@/features/reviews/CheckStrip";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeState } from "@/test/wails-mock";

const MINUTE = 60_000;
const FAILURE = "GitHub's rate limit was reached. It resets at 14:32.";

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

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't check GitHub · 3m ago");
    expect(alert).toHaveTextContent(FAILURE);
    expect(alert).toHaveTextContent(
      "New commits, checks and the merge show after the next reading.",
    );
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
