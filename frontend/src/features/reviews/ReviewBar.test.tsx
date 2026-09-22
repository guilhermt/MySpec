import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewBar } from "@/features/reviews/ReviewBar";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

function bar(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary(overrides);
  return renderWithStore(<ReviewBar review={review} />, {
    state: makeState({ reviews: [review] }),
  });
}

describe("ReviewBar", () => {
  it("names the pull request and where the review stands", async () => {
    const { user } = bar({ status: "ready_to_publish" });

    expect(screen.getByRole("status")).toHaveTextContent("Ready to publish");

    await user.click(screen.getByRole("button", { name: /#31/ }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("warns about the commits that arrived since the pass and about a publication that failed", () => {
    bar({ stalePass: true, publishError: "GitHub said no.", checkError: "No network." });

    expect(screen.getByText("New commits since this pass")).toBeInTheDocument();
    expect(screen.getByText("Couldn't check GitHub")).toBeInTheDocument();
    expect(screen.getByText("GitHub said no.")).toBeInTheDocument();
  });

  it("says when a report could not be read and when an approval produced no commit", () => {
    bar({ unreadableReport: "The report has no findings section.", commitFailed: true });

    expect(screen.getByText("The report has no findings section.")).toBeInTheDocument();
    expect(screen.getByText("The last approval didn't produce a commit.")).toBeInTheDocument();
  });

  it("says why the pass could not start, and offers it again", () => {
    bar({
      status: "pass_blocked",
      passBlocked: "GitHub CLI isn't authenticated.",
      canReviewAgain: true,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Pass blocked");
    expect(screen.getByText("GitHub CLI isn't authenticated.")).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Review again" })).toBeEnabled();
  });

  it("names the wait for the checks of the pull request", () => {
    bar({ status: "waiting_checks" });

    expect(screen.getByRole("status")).toHaveTextContent("Waiting for checks");
  });

  it("publishes only once everything is decided", async () => {
    const { user } = bar({
      status: "ready_to_publish",
      canPublish: true,
      passes: [makeReviewPass()],
    });

    await user.click(screen.getByRole("button", { name: "Publish review" }));

    expect(await screen.findByRole("heading", { name: "Publish review" })).toBeInTheDocument();
  });

  it("keeps the publication out of reach while findings wait for a decision", () => {
    bar({ status: "awaiting_decision" });

    expect(screen.getByRole("button", { name: "Publish review" })).toBeDisabled();
  });

  it("offers Apply and Approve in apply mode, and no publication", () => {
    bar({ mode: "apply", status: "ready_to_apply", canApply: true });

    expect(screen.queryByRole("button", { name: "Publish review" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("applies the approved findings", async () => {
    const { user } = bar({ mode: "apply", status: "ready_to_apply", canApply: true });

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(api.applyReview).toHaveBeenCalledWith("review-1");
  });

  it("approves the changes the agent made", async () => {
    const { user } = bar({ mode: "apply", status: "ready_to_approve", canApprove: true });

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(api.approveReview).toHaveBeenCalledWith("review-1");
  });

  it("asks for another pass", async () => {
    const { user } = bar({ status: "published", canReviewAgain: true });

    await user.click(screen.getByRole("button", { name: "Review again" }));

    expect(await screen.findByRole("heading", { name: "Review again" })).toBeInTheDocument();
  });

  it("opens the worktree in the editor, and says when there is none", async () => {
    const { user, unmount } = bar();

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));
    expect(api.openReviewInEditor).toHaveBeenCalledWith("review-1");
    unmount();

    bar({ worktreePath: "" });
    await user.hover(
      screen.getByRole("button", { name: "Open in VS Code" }).parentElement as HTMLElement,
    );

    expect(await screen.findByText("The worktree doesn't exist yet")).toBeInTheDocument();
  });

  it("disables the editor while the worktree isn't there", () => {
    bar({ worktreePath: "" });

    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeDisabled();
  });
});
