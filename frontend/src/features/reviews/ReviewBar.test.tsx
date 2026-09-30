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
  it("says where the review stands, and leaves the link of the pull request to the ⋯", () => {
    bar({ status: "ready_to_publish" });

    expect(screen.getByRole("status")).toHaveTextContent("Ready to publish");
    expect(screen.queryByRole("button", { name: /#31/ })).not.toBeInTheDocument();
  });

  it("warns about the commits that arrived since the pass and about a publication that failed", () => {
    bar({ stalePass: true, publishError: "GitHub said no." });

    expect(screen.getByText("New commits since this pass")).toBeInTheDocument();
    expect(screen.getByText("GitHub said no.")).toBeInTheDocument();
  });

  it("leaves the failure of the reading of GitHub to the strip under the header", () => {
    bar({ checkError: "No network." });

    expect(screen.queryByText("Couldn't check GitHub")).not.toBeInTheDocument();
    expect(screen.queryByText("No network.")).not.toBeInTheDocument();
  });

  it("says when a report could not be read and when an approval produced no commit", () => {
    bar({ unreadableReport: "The report has no findings section.", commitFailed: true });

    expect(screen.getByText("The report has no findings section.")).toBeInTheDocument();
    expect(screen.getByText("The last approval didn't produce a commit.")).toBeInTheDocument();
  });

  it("says why the pass could not start", () => {
    bar({
      status: "pass_blocked",
      passBlocked: "GitHub CLI isn't authenticated.",
      canReviewAgain: true,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Pass blocked");
    expect(screen.getByText("GitHub CLI isn't authenticated.")).toHaveClass("text-destructive");
  });

  it("names the wait for the checks of the pull request", () => {
    bar({ status: "waiting_checks" });

    expect(screen.getByRole("status")).toHaveTextContent("Waiting for checks");
  });

  it("names the checks that failed and the conflict after the review", () => {
    bar({
      status: "trouble",
      baseBranch: "main",
      trouble: { failedChecks: ["ci", "lint"], conflict: true },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checks failed: ci, lint · conflict with main",
    );
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

  it("leaves Review again and the worktree to the ⋯ of the header", () => {
    bar({ status: "published", canReviewAgain: true });

    expect(screen.queryByRole("button", { name: "Review again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in VS Code" })).not.toBeInTheDocument();
  });
});
