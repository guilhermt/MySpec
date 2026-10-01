import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { ReviewView } from "@/features/reviews/ReviewView";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore, useLocation } from "@/store/app-store";
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

// reportMarker is the marker that says the report of a pass was written.
function reportMarker(pass: number) {
  const entry = makeEntry("marker");
  return entry.marker === null
    ? entry
    : { ...entry, marker: { ...entry.marker, type: "pr_review_written", pass, findings: 1 } };
}

const REPORT = makeSituation({
  kind: "review_report",
  form: "publish",
  taskId: "review-1",
  place: { kind: "review", stage: "review", step: 0 },
});

// situationOf is a situation of the review, of the kind and the form given.
function situationOf(kind: string, form = "", group = "waiting") {
  return makeSituation({
    id: `s-${kind}`,
    taskId: "review-1",
    kind,
    form,
    group,
    place: { kind: "review", stage: "review", step: 0 },
  });
}

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

  it("draws the card of findings right after the report of the pass being decided", async () => {
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "review-1",
        stage: "review",
        entries: [reportMarker(1), makeEntry("assistant")],
      }),
    );
    view({ status: "awaiting_decision", passes: [makeReviewPass()] });

    const feed = await screen.findByRole("feed", { name: "Conversation with the reviewer" });
    const card = await within(feed).findByRole("group", { name: "Findings of pass 1" });
    expect(within(card).getByRole("group", { name: /^Finding 1 of 1: / })).toBeInTheDocument();
    const text = feed.textContent ?? "";
    expect(text.indexOf("Review 1 written")).toBeLessThan(text.indexOf("Findings1"));
    expect(text.indexOf("Findings1")).toBeLessThan(text.indexOf("On it."));
  });

  it("draws the card at the end of the conversation when it has no report marker", async () => {
    view({ status: "awaiting_decision", passes: [makeReviewPass()] });

    const feed = await screen.findByRole("feed", { name: "Conversation with the reviewer" });
    expect(
      await within(feed).findByRole("group", { name: "Findings of pass 1" }),
    ).toBeInTheDocument();
  });

  it.each<[string, Partial<ReviewSummary>]>([
    ["a pass published", { status: "published", passes: [makeReviewPass({ published: true })] }],
    ["a pass sent to the agent", { mode: "apply", passes: [makeReviewPass({ sent: true })] }],
    [
      "a clean pass",
      { status: "ready_to_publish", passes: [makeReviewPass({ clean: true, findings: [] })] },
    ],
    ["a pass a Review again left behind", { status: "waiting_checks", passes: [makeReviewPass()] }],
  ])("draws no card for %s", async (_name, overrides) => {
    view(overrides);

    await screen.findByRole("feed", { name: "Conversation with the reviewer" });
    expect(screen.queryByRole("group", { name: /^Findings of pass/ })).not.toBeInTheDocument();
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

  it("goes to the first finding to decide once the conversation is read", async () => {
    arrive({
      status: "awaiting_decision",
      sessionStatus: "waiting",
      turnRunning: false,
      passes: [
        makeReviewPass({
          findings: [
            makeReviewFinding({ number: 1, decision: "approved" }),
            makeReviewFinding({ number: 2, title: "No test" }),
          ],
        }),
      ],
      situations: [makeSituation({ ...REPORT, form: "" })],
    });

    await waitFor(() =>
      expect(screen.getByRole("group", { name: /^Finding 2 of 2: No test/ })).toHaveFocus(),
    );
  });

  it("goes to the composer when the review asks nothing of the bar", async () => {
    arrive({ status: "published", sessionStatus: "waiting", turnRunning: false });

    await waitFor(() => expect(document.getElementById("composer-input")).toHaveFocus());
  });

  const resting = { sessionStatus: "waiting", turnRunning: false, processRunning: false };

  it.each<[string, Partial<ReviewSummary>, () => HTMLElement | null]>([
    [
      "Retry reviewer, the session stopped",
      {
        status: "reviewing",
        sessionStatus: "error",
        lastError: "claude exited",
        situations: [situationOf("session_error", "", "error")],
      },
      () => screen.getByRole("button", { name: "Retry reviewer" }),
    ],
    [
      "the composer, a turn that failed",
      {
        ...resting,
        status: "reviewing",
        turnFailed: true,
        situations: [situationOf("session_error", "", "error")],
      },
      () => document.getElementById("composer-input"),
    ],
    [
      "the composer, the report to write again",
      {
        ...resting,
        status: "awaiting_reply",
        unreadableReport: "The report has no findings section.",
        situations: [situationOf("reply")],
      },
      () => document.getElementById("composer-input"),
    ],
    [
      "Publish review…, the publication failed",
      {
        ...resting,
        status: "publish_failed",
        canPublish: true,
        publishError: "Couldn't publish to GitHub: 422",
        passes: [makeReviewPass()],
        situations: [situationOf("publish_failed", "", "error")],
      },
      () => screen.getByRole("button", { name: "Publish review…" }),
    ],
    [
      "Apply approved, ready to apply",
      {
        ...resting,
        mode: "apply",
        status: "ready_to_apply",
        canApply: true,
        passes: [makeReviewPass({ findings: [makeReviewFinding({ decision: "approved" })] })],
        situations: [situationOf("review_report", "apply")],
      },
      () => screen.getByRole("button", { name: "Apply approved" }),
    ],
    [
      "Approve, the changes ready to approve",
      {
        ...resting,
        mode: "apply",
        status: "ready_to_approve",
        canApprove: true,
        review: makeReview({ staged: 2, total: 2, percent: 100 }),
        situations: [situationOf("changes_review", "approve")],
      },
      () => screen.getByRole("button", { name: "Approve" }),
    ],
    [
      "Open PR, ready to merge",
      {
        ...resting,
        mode: "apply",
        status: "ready_to_merge",
        passes: [makeReviewPass({ clean: true, findings: [] })],
        situations: [situationOf("merge", "merge", "closing")],
      },
      () => screen.getByRole("button", { name: "Open PR" }),
    ],
    [
      "Review again…, new commits",
      {
        ...resting,
        status: "new_commits",
        newCommits: 3,
        canReviewAgain: true,
        passes: [makeReviewPass({ published: true })],
        situations: [situationOf("new_commits")],
      },
      () => screen.getByRole("button", { name: "Review again…" }),
    ],
    [
      "Review again…, in trouble",
      {
        ...resting,
        status: "trouble",
        canReviewAgain: true,
        trouble: { failedChecks: ["build"], conflict: false },
        situations: [situationOf("pr_trouble", "checks", "error")],
      },
      () => screen.getByRole("button", { name: "Review again…" }),
    ],
    [
      "Review again…, a pass blocked",
      {
        ...resting,
        status: "pass_blocked",
        canReviewAgain: true,
        passBlocked: "The worktree couldn't be updated.",
        situations: [situationOf("pass_blocked", "", "error")],
      },
      () => screen.getByRole("button", { name: "Review again…" }),
    ],
  ])("goes to %s", async (_name, overrides, target) => {
    arrive(overrides);

    await waitFor(() => expect(target()).toHaveFocus());
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it.each<[string, string, () => HTMLElement]>([
    [
      "the first option of a question",
      "question",
      () => screen.getByRole("radio", { name: /SQLite/ }),
    ],
    ["Allow of a permission", "permission", () => screen.getByRole("button", { name: /^Allow/ })],
  ])("goes to %s the conversation holds pending", async (_name, kind, target) => {
    renderWithStore(<ReviewView reviewId="review-1" />, {
      state: makeState({
        reviews: [makeReviewSummary({ ...resting, situations: [situationOf(kind)] })],
      }),
      ui: {
        location: { kind: "review", id: "review-1" },
        pendingFocus: "request",
        transcripts: {
          "review-1|review": {
            status: "ready",
            error: "",
            entries: [makeEntry(kind === "question" ? "question" : "permission")],
            pending: [],
            buffered: [],
          },
        },
      },
    });

    await waitFor(() => expect(target()).toHaveFocus());
  });
});

// Shell is the review screen where the app draws it, with the shortcuts of the app.
function Shell() {
  useGlobalShortcuts();
  const location = useLocation();
  return location.kind === "review" ? <ReviewView reviewId={location.id} /> : null;
}

describe("ReviewView, arriving from elsewhere", () => {
  const waiting = () =>
    makeState({
      reviews: [
        makeReviewSummary({
          status: "ready_to_publish",
          canPublish: true,
          sessionStatus: "waiting",
          turnRunning: false,
          passes: [makeReviewPass()],
          situations: [REPORT],
        }),
      ],
    });

  it("takes the focus to what the situation asks on Ctrl+J", async () => {
    const { user } = renderWithStore(<Shell />, { state: waiting() });

    await user.keyboard("{Control>}j{/Control}");

    expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publish review…" })).toHaveFocus(),
    );
  });

  it("takes the focus to what the situation asks from the notification", async () => {
    renderWithStore(<Shell />, { state: waiting() });

    act(() => useAppStore.getState().openSituation("review-1", REPORT.place));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publish review…" })).toHaveFocus(),
    );
  });
});

describe("ReviewView, a situation born with the screen open", () => {
  it("blinks the bar and announces it", async () => {
    const before = makeReviewSummary({ status: "reviewing" });
    view({ status: "reviewing" });
    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          reviews: [
            {
              ...before,
              status: "ready_to_publish",
              canPublish: true,
              sessionStatus: "waiting",
              turnRunning: false,
              passes: [makeReviewPass()],
              situations: [REPORT],
            },
          ],
        }),
      );
      useAppStore.getState().flashSituation(REPORT.id);
    });

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveAttribute("data-flash", "wait");
    expect(within(bar).getByRole("status")).toHaveTextContent("Ready to publish · pass 1");
    expect(useAppStore.getState().announcement?.text).toBe(
      "web#31: waiting for you: ready to publish in pass 1",
    );
  });
});

describe("ReviewView, the apply mode and the strip", () => {
  it("asks to review the changes in the bar, with the changed files at the end of the conversation", async () => {
    view({
      mode: "apply",
      status: "in_review",
      sessionStatus: "waiting",
      turnRunning: false,
      review: makeReview(),
      situations: [situationOf("changes_review", "staged")],
    });

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveTextContent("Review changes");
    expect(within(bar).getByRole("button", { name: "Open in VS Code" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Approve" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(await screen.findByRole("article", { name: "Changed files · 2" })).toBeInTheDocument();
  });

  it("says a reading of GitHub that failed in a strip under the header", () => {
    view({
      checkError: "GitHub's rate limit was reached.",
      checkErrorAt: new Date().toISOString(),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check GitHub");
  });

  it("leaves the failure to the bar of a blocked pass, without the strip", () => {
    view({
      status: "pass_blocked",
      sessionStatus: "waiting",
      turnRunning: false,
      checkError: "GitHub's rate limit was reached.",
      checkErrorAt: new Date().toISOString(),
      passBlocked: "GitHub's rate limit was reached.",
      situations: [situationOf("pass_blocked", "", "error")],
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent("Pass blocked");
  });
});
