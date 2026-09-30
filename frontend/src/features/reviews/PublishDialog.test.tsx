import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishDialog } from "@/features/reviews/PublishDialog";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

// A pass with an approved finding on a line, one approved general finding and
// one the user discarded.
const DECIDED = makeReviewPass({
  findings: [
    makeReviewFinding({ number: 1, decision: "approved" }),
    makeReviewFinding({ number: 2, path: "", line: 0, decision: "approved" }),
    makeReviewFinding({ number: 3, decision: "discarded" }),
  ],
});

function dialog(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({ passes: [DECIDED], canPublish: true, ...overrides });
  const onOpenChange = vi.fn();
  const onReviewAgain = vi.fn();
  const view = renderWithStore(
    <PublishDialog
      review={review}
      open
      onOpenChange={onOpenChange}
      onReviewAgain={onReviewAgain}
    />,
    { state: makeState({ reviews: [review] }) },
  );
  return { ...view, onOpenChange, onReviewAgain };
}

describe("PublishDialog", () => {
  it("offers the verdicts of the review and says what goes with them", () => {
    dialog();

    expect(screen.getByRole("radio", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Request changes" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Comment" })).toBeInTheDocument();
    expect(screen.getByText("1 inline comment · 1 in the body")).toBeInTheDocument();
  });

  it("offers only a comment on a pull request of the user's own", () => {
    dialog({ own: true, verdicts: ["comment"] });

    expect(screen.getByRole("radio", { name: "Comment" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("publishes with the verdict the user chose", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("radio", { name: "Request changes" }));
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(api.publishReview).toHaveBeenCalledWith("review-1", "request_changes", true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a publication that failed where the user asked for it", async () => {
    vi.mocked(api.publishReview).mockRejectedValueOnce(new Error("GitHub said no."));
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub said no.");
  });

  it("opens again without the error of the last attempt", async () => {
    vi.mocked(api.publishReview).mockRejectedValueOnce(new Error("GitHub said no."));
    const { user, rerender, onOpenChange, onReviewAgain } = dialog();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByRole("alert");
    const review = makeReviewSummary({ passes: [DECIDED], canPublish: true });
    const again = (open: boolean) => (
      <PublishDialog
        review={review}
        open={open}
        onOpenChange={onOpenChange}
        onReviewAgain={onReviewAgain}
      />
    );

    rerender(again(false));
    rerender(again(true));

    expect(screen.getByRole("heading", { name: "Publish review" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns about the commits that arrived and offers another pass instead", async () => {
    const { user, onReviewAgain, onOpenChange } = dialog({ stalePass: true });

    expect(
      screen.getByText(/Findings on lines that left the diff go in the review body/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review again instead" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onReviewAgain).toHaveBeenCalledOnce();
  });
});
