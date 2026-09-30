import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewAgainDialog } from "@/features/reviews/ReviewAgainDialog";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

function dialog(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({ canReviewAgain: true, ...overrides });
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <ReviewAgainDialog review={review} open onOpenChange={onOpenChange} />,
    { state: makeState({ reviews: [review] }) },
  );
  return { ...view, onOpenChange };
}

const DECIDED = makeReviewPass({
  findings: [makeReviewFinding({ decision: "approved" })],
});

describe("ReviewAgainDialog", () => {
  it("names the review and says what the next pass does", () => {
    dialog({ passes: [makeReviewPass()] });

    expect(screen.getByRole("dialog", { name: "Review web#31 again" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pass 2 reads the pull request and the checks again, and writes a new report.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the instructions behind a click and asks with what the user wrote", async () => {
    const { user, onOpenChange } = dialog();
    expect(screen.queryByLabelText(/Instructions/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add instructions" }));
    const field = screen.getByRole("textbox", { name: /Instructions/ });
    expect(field).toHaveFocus();
    await user.type(field, "Look at the migrations.");
    await user.click(screen.getByRole("button", { name: /^Review again/ }));

    expect(api.askReviewAgain).toHaveBeenCalledWith("review-1", "Look at the migrations.");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("asks with Ctrl+Enter and no instructions", async () => {
    const { user } = dialog();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Review again/ })).toHaveFocus(),
    );

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.askReviewAgain).toHaveBeenCalledWith("review-1", "");
  });

  it("warns that the decisions of a pass never published go away, and opens on Cancel", async () => {
    dialog({ passes: [DECIDED] });

    expect(
      screen.getByText("The decisions and edits of review 1 will be discarded."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("warns that the edits of a pass never published go away", () => {
    dialog({ passes: [makeReviewPass({ edited: true })] });

    expect(
      screen.getByText("The decisions and edits of review 1 will be discarded."),
    ).toBeInTheDocument();
  });

  it("says nothing about a pass nobody worked on, and opens on Review again", async () => {
    dialog({ passes: [makeReviewPass({ findings: [makeReviewFinding({ decision: "" })] })] });

    expect(screen.queryByText(/will be discarded/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Review again/ })).toHaveFocus(),
    );
  });

  it("says nothing about a pass already published", () => {
    dialog({
      passes: [
        makeReviewPass({
          published: true,
          verdict: "comment",
          edited: true,
          findings: [makeReviewFinding({ decision: "approved" })],
        }),
      ],
    });

    expect(screen.queryByText(/will be discarded/)).not.toBeInTheDocument();
  });

  it("shows a failure in the footer and stays open", async () => {
    vi.mocked(api.askReviewAgain).mockRejectedValueOnce(new Error("The worktree is gone."));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: /^Review again/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The worktree is gone.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps Esc and Cancel still while it asks", async () => {
    let finish: () => void = () => undefined;
    vi.mocked(api.askReviewAgain).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onOpenChange } = dialog();
    await user.click(screen.getByRole("button", { name: /^Review again/ }));

    expect(await screen.findByRole("button", { name: "Asking…" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");

    finish();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("opens again without the error of the last attempt", async () => {
    vi.mocked(api.askReviewAgain).mockRejectedValueOnce(new Error("The worktree is gone."));
    const { user, rerender, onOpenChange } = dialog();
    await user.click(screen.getByRole("button", { name: /^Review again/ }));
    await screen.findByRole("alert");
    const review = makeReviewSummary({ canReviewAgain: true });

    rerender(<ReviewAgainDialog review={review} open={false} onOpenChange={onOpenChange} />);
    rerender(<ReviewAgainDialog review={review} open onOpenChange={onOpenChange} />);

    expect(screen.getByRole("dialog", { name: "Review web#31 again" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has one primary button", () => {
    dialog();

    expect(
      screen.getByRole("dialog").querySelectorAll("button[data-variant=primary]"),
    ).toHaveLength(1);
  });
});
