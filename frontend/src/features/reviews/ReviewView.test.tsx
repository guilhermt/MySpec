import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewView } from "@/features/reviews/ReviewView";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePRCheck,
  makeReview,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTranscript,
} from "@/test/wails-mock";

const REPORT = makeSituation({
  kind: "review_report",
  form: "publish",
  taskId: "review-1",
  place: { kind: "review", stage: "review", step: 0 },
});

function view(overrides: Partial<ReviewSummary> = {}) {
  return renderWithStore(<ReviewView reviewId="review-1" />, {
    state: makeState({ reviews: [makeReviewSummary(overrides)] }),
    ui: { location: { kind: "review", id: "review-1" } },
  });
}

describe("ReviewView", () => {
  it("puts the header, the request bar, the conversation and the composer together", async () => {
    view({
      status: "ready_to_publish",
      canPublish: true,
      sessionStatus: "waiting",
      turnRunning: false,
      passes: [makeReviewPass()],
      situations: [REPORT],
    });

    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent("Ready to publish");
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply to the reviewer" })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("review-1", "review");
    });
  });

  it("asks nothing of the user while the reviewer works", () => {
    view();

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("shows the findings of the last pass above the conversation", () => {
    view({ status: "awaiting_decision", passes: [makeReviewPass()] });

    expect(screen.getByText("Review 1 · changes")).toBeInTheDocument();
    expect(screen.getByLabelText("Finding 1")).toBeInTheDocument();
  });

  it("shows the files the agent changed at the end of the conversation in apply mode", async () => {
    view({ mode: "apply", status: "in_review", review: makeReview() });

    expect(await screen.findByRole("article", { name: "Changed files · 2" })).toBeInTheDocument();
    expect(screen.getByText("src/LoginForm.tsx")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Review progress" })).not.toBeInTheDocument();
  });

  it("shows no files while the findings are still to apply", async () => {
    view({ mode: "apply", status: "ready_to_apply", review: makeReview() });

    await screen.findByRole("feed");
    expect(screen.queryByRole("article", { name: /^Changed files/ })).not.toBeInTheDocument();
  });

  it("waits for the checks in a card that reads again and says what the pass waits on", async () => {
    const { user } = view({
      status: "waiting_checks",
      sessionStage: "",
      mergeable: "mergeable",
      checkedAt: new Date().toISOString(),
      checks: [
        makePRCheck({ name: "build", state: "passed", url: "https://ci/build" }),
        makePRCheck({ name: "e2e", state: "running", url: "https://ci/e2e" }),
      ],
    });

    const card = await screen.findByRole("article", {
      name: "Waiting for checks · 1 of 2 passed",
    });
    expect(card).toHaveTextContent("The first pass starts when e2e finishes.");
    await user.click(within(card).getByRole("button", { name: "Refresh" }));
    expect(api.refreshReviewPR).toHaveBeenCalledWith("review-1");
  });

  it("has no composer before the session got its prompt", () => {
    view({ status: "waiting_checks", sessionStage: "" });

    expect(
      screen.queryByRole("textbox", { name: "Reply to the reviewer" }),
    ).not.toBeInTheDocument();
  });

  it("opens the reports panel from its button, and closes it with ×", async () => {
    const { user } = view();
    const button = () => screen.getByRole("button", { name: "Reports" });
    expect(screen.queryByRole("complementary", { name: "Reports" })).not.toBeInTheDocument();

    await user.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("complementary", { name: "Reports" });
    expect(panel).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Reports" })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it("shows nothing at all for a review that is no longer there", () => {
    const { container } = renderWithStore(<ReviewView reviewId="review-9" />, {
      state: makeState({ reviews: [makeReviewSummary()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });

  it("lets nothing but the conversation scroll in its column", () => {
    view({ sessionStatus: "waiting", turnRunning: false });

    const column = screen.getByRole("textbox").closest(".overflow-clip");
    expect(column).not.toBeNull();
  });

  it("reads the conversation as a feed of the reviewer", async () => {
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "review-1",
        stage: "review",
        entries: [makeEntry("assistant"), makeEntry("error")],
      }),
    );
    view();

    const feed = await screen.findByRole("feed", { name: "Conversation with the reviewer" });
    expect(within(feed).getByRole("article", { name: /^Reviewer, / })).toHaveTextContent("On it.");
    expect(within(feed).getByRole("article", { name: /^Session error, / })).toBeInTheDocument();
  });

  it("draws the decisions of a pass published before the conversation recorded them, after its report", async () => {
    const written = makeEntry("marker");
    const report =
      written.marker === null
        ? written
        : {
            ...written,
            marker: { ...written.marker, type: "pr_review_written", pass: 1, findings: 1 },
          };
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "review-1",
        stage: "review",
        entries: [report, makeEntry("assistant")],
      }),
    );
    view({
      status: "published",
      passes: [
        makeReviewPass({
          published: true,
          publishedAt: "2026-09-30T13:41:00Z",
          findings: [makeReviewFinding({ decision: "approved", placement: "inline" })],
        }),
      ],
    });

    const feed = await screen.findByRole("feed", { name: "Conversation with the reviewer" });
    const decided = await within(feed).findByRole("article", { name: /^You decided · 1 approved/ });
    const text = feed.textContent ?? "";
    expect(text.indexOf("Review 1 written")).toBeLessThan(text.indexOf("You decided"));
    expect(text.indexOf("You decided")).toBeLessThan(text.indexOf("On it."));
    expect(decided).toBeInTheDocument();
  });
});

describe("ReviewView, the focus on arriving at a situation", () => {
  function arrive(overrides: Partial<ReviewSummary>) {
    return renderWithStore(<ReviewView reviewId="review-1" />, {
      state: makeState({ reviews: [makeReviewSummary(overrides)] }),
      ui: { location: { kind: "review", id: "review-1" }, pendingFocus: "request" },
    });
  }

  it("goes to the primary of the bar once the conversation is read", async () => {
    arrive({
      status: "ready_to_publish",
      canPublish: true,
      sessionStatus: "waiting",
      turnRunning: false,
      passes: [makeReviewPass()],
      situations: [REPORT],
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publish review…" })).toHaveFocus(),
    );
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("goes to the bar while the findings are decided above the conversation", async () => {
    arrive({
      status: "awaiting_decision",
      sessionStatus: "waiting",
      turnRunning: false,
      passes: [makeReviewPass({ findings: [makeReviewFinding()] })],
      situations: [makeSituation({ ...REPORT, form: "" })],
    });

    await waitFor(() => expect(screen.getByRole("region", { name: "Request" })).toHaveFocus());
  });

  it("goes to the composer when the review asks nothing of the bar", async () => {
    arrive({ status: "published", sessionStatus: "waiting", turnRunning: false });

    await waitFor(() => expect(document.getElementById("composer-input")).toHaveFocus());
  });
});
