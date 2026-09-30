import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewRequest } from "@/features/reviews/ReviewRequest";
import { api, type ReviewSummary, type Situation } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeReview,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

const REVIEW_PLACE = { kind: "review", stage: "review", step: 0 };

function situation(kind: string, form = "", group = "waiting"): Situation {
  return makeSituation({
    id: `s-${kind}`,
    taskId: "review-1",
    kind,
    form,
    group,
    place: REVIEW_PLACE,
  });
}

// at rest is a review of the first pass, recorded, waiting on its situation.
function atRest(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return makeReviewSummary({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    passes: [makeReviewPass()],
    ...overrides,
  });
}

function bar(overrides: Partial<ReviewSummary> = {}, ui = {}) {
  const review = atRest(overrides);
  return renderWithStore(<ReviewRequest review={review} />, {
    state: makeState({ reviews: [review] }),
    ui,
  });
}

const request = () => screen.getByRole("region", { name: "Request" });

describe("ReviewRequest", () => {
  it("asks to decide the findings, with how many are decided, and keeps Publish out of reach", () => {
    bar({
      status: "awaiting_decision",
      canPublish: false,
      situations: [situation("review_report")],
      passes: [
        makeReviewPass({
          findings: [
            makeReviewFinding({ number: 1, decision: "approved" }),
            makeReviewFinding({ number: 2 }),
            makeReviewFinding({ number: 3 }),
          ],
        }),
      ],
    });

    expect(request()).toHaveTextContent("Decide findings");
    expect(request()).toHaveTextContent("pass 1");
    expect(request()).toHaveTextContent("1 of 3 decided");
    expect(screen.getByRole("button", { name: "Publish review…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Decide 2 more")).toBeInTheDocument();
  });

  it("does not offer Next to decide while the findings are decided above the conversation", () => {
    bar({
      status: "awaiting_decision",
      situations: [situation("review_report")],
      passes: [makeReviewPass({ findings: [makeReviewFinding()] })],
    });

    expect(screen.queryByRole("button", { name: "Next to decide" })).not.toBeInTheDocument();
  });

  it("says nothing when the review asks nothing", () => {
    bar({ status: "reviewing", sessionStatus: "working", turnRunning: true });

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("publishes from the dialog the button opens", async () => {
    const { user } = bar({
      status: "ready_to_publish",
      canPublish: true,
      situations: [situation("review_report", "publish")],
    });

    await user.click(screen.getByRole("button", { name: "Publish review…" }));

    expect(await screen.findByRole("heading", { name: "Publish review" })).toBeInTheDocument();
  });

  it("opens the publication with Ctrl+Enter from the bar when Publish is the primary and enabled", async () => {
    const { user } = bar({
      status: "ready_to_publish",
      canPublish: true,
      situations: [situation("review_report", "publish")],
    });

    request().focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByRole("heading", { name: "Publish review" })).toBeInTheDocument();
  });

  it("leaves Ctrl+Enter alone while the publication waits for decisions", async () => {
    const { user } = bar({
      status: "awaiting_decision",
      situations: [situation("review_report")],
      passes: [makeReviewPass({ findings: [makeReviewFinding()] })],
    });

    request().focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(screen.queryByRole("heading", { name: "Publish review" })).not.toBeInTheDocument();
  });

  it("says why a publication failed and offers it again", () => {
    bar({
      status: "publish_failed",
      publishError: "GitHub said no.",
      canPublish: true,
      situations: [situation("publish_failed", "", "error")],
    });

    expect(request()).toHaveTextContent("Publish failed");
    expect(request()).toHaveTextContent("GitHub said no.");
    expect(screen.getByRole("button", { name: "Publish review…" })).toBeEnabled();
  });

  it("applies the approved findings", async () => {
    const { user } = bar({
      mode: "apply",
      status: "ready_to_apply",
      canApply: true,
      situations: [situation("review_report", "apply")],
      passes: [makeReviewPass({ findings: [makeReviewFinding({ decision: "approved" })] })],
    });

    expect(screen.queryByRole("button", { name: "Publish review…" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply approved" }));

    expect(api.applyReview).toHaveBeenCalledWith("review-1");
  });

  it("opens the worktree and approves the changes of the agent", async () => {
    const { user } = bar({
      mode: "apply",
      status: "ready_to_approve",
      canApprove: true,
      review: makeReview({ staged: 2, total: 2, percent: 100 }),
      situations: [situation("changes_review", "approve")],
    });

    expect(request()).toHaveTextContent("Approve changes");
    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));
    expect(api.openReviewInEditor).toHaveBeenCalledWith("review-1");

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(api.approveReview).toHaveBeenCalledWith("review-1");
  });

  it("opens the pull request when it is ready to merge", async () => {
    const { user } = bar({
      status: "ready_to_merge",
      situations: [situation("merge")],
    });

    await user.click(screen.getByRole("button", { name: "Open PR" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("asks for another pass in a dialog when commits arrived", async () => {
    const { user } = bar({
      status: "new_commits",
      newCommits: 3,
      canReviewAgain: true,
      situations: [situation("new_commits")],
    });

    expect(request()).toHaveTextContent("New commits");
    await user.click(screen.getByRole("button", { name: "Review again…" }));

    expect(await screen.findByRole("heading", { name: "Review again" })).toBeInTheDocument();
  });

  it("restarts the reviewer after its session stopped", async () => {
    const { user } = bar({
      lastError: "It crashed.",
      sessionStatus: "stopped",
      situations: [situation("session_error", "", "error")],
    });

    await user.click(screen.getByRole("button", { name: "Retry reviewer" }));

    expect(api.retry).toHaveBeenCalledWith("review-1", "review");
  });

  it("says the wait for the report, with why it could not be read", () => {
    bar({
      unreadableReport: "The report has no findings section.",
      situations: [situation("reply")],
    });

    expect(request()).toHaveTextContent("Waiting for the report");
    expect(request()).toHaveTextContent("The report has no findings section.");
  });

  it("is quiet while the review is paused", () => {
    bar({
      status: "ready_to_publish",
      sessionStatus: "paused",
      situations: [situation("review_report", "publish")],
    });

    expect(request()).toHaveAttribute("data-form", "quiet");
  });

  it("blinks while the situation is flashing", () => {
    bar(
      { status: "ready_to_publish", situations: [situation("review_report", "publish")] },
      { flashing: new Set(["s-review_report"]) },
    );

    expect(request()).toHaveAttribute("data-flash", "wait");
  });

  describe("a situation born with the screen open", () => {
    const asked = () =>
      atRest({ status: "ready_to_publish", situations: [situation("review_report", "publish")] });

    it("says it in the status of the bar and to the live region, once", () => {
      const before = atRest({ status: "reviewing" });
      const { rerender } = renderWithStore(<ReviewRequest review={before} />, {
        state: makeState({ reviews: [before] }),
      });
      expect(useAppStore.getState().announcement).toBeNull();

      act(() => rerender(<ReviewRequest review={asked()} />));

      expect(within(request()).getByRole("status")).toHaveTextContent("Ready to publish · pass 1");
      expect(useAppStore.getState().announcement?.text).toBe(
        "web#31: waiting for you: ready to publish in pass 1",
      );
      const id = useAppStore.getState().announcement?.id;

      act(() => rerender(<ReviewRequest review={{ ...asked(), title: "Another title" }} />));
      expect(useAppStore.getState().announcement?.id).toBe(id);
    });

    it("stays silent for the situation that was there when the screen opened", () => {
      bar({ status: "ready_to_publish", situations: [situation("review_report", "publish")] });

      expect(within(request()).getByRole("status")).toBeEmptyDOMElement();
      expect(useAppStore.getState().announcement).toBeNull();
    });
  });
});
