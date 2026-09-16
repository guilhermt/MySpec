import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRBar } from "@/features/task/PRBar";
import { api, type PullRequest, type Situation } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeRepository,
  makeReview,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

const PR_PLACE = { kind: "pr", stage: "", step: 0 };

function bar(overrides: Partial<PullRequest> = {}, situations: Situation[] = []) {
  const pr = makePullRequest(overrides);
  const task = makeTask({ stage: "pr", pr, situations });
  return renderWithStore(<PRBar task={task} pr={pr} />, {
    state: makeState({ tasks: [task] }),
  });
}

// The dot has no role of its own: it is the hidden element that carries the tone.
function dotOf(element: HTMLElement): Element | null {
  return element.querySelector('[aria-hidden="true"]');
}

describe("PRBar", () => {
  it("names the pull request and the state it is in", () => {
    bar({ status: "drafting" });

    expect(screen.getByText("Pull request")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Preparing the draft");
    expect(dotOf(screen.getByRole("status"))).toHaveClass("bg-[var(--status-working)]");
  });

  it("takes the tone of the situation of the pull request", () => {
    bar({ status: "blocked", block: { reason: "gh_missing", detail: "" } }, [
      makeSituation({ kind: "pr_blocked", group: "error", place: PR_PLACE }),
    ]);

    expect(dotOf(screen.getByRole("status"))).toHaveClass("bg-destructive");
  });

  it("keeps the tone of the state while the pull request has no situation", () => {
    bar({ status: "blocked", block: { reason: "gh_missing", detail: "" } });

    expect(dotOf(screen.getByRole("status"))).toHaveClass("bg-muted-foreground");
  });

  it("spells the review out in files", () => {
    bar({ status: "in_review", review: makeReview({ staged: 1, total: 2 }) });

    expect(screen.getByRole("status")).toHaveTextContent("In review · 1 of 2 files staged");
  });

  it("carries the number and the state of the pull request", async () => {
    const { user } = bar({
      status: "reviewing",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
      prState: "open",
    });

    expect(screen.getByText("Open")).toBeInTheDocument();
    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("opens the worktree of the task in the editor", async () => {
    const { user } = bar({ status: "reviewing" });

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    expect(api.openInEditor).toHaveBeenCalledWith("task-1");
  });

  it("has no worktree to open before the implementation made one", () => {
    bar({ status: "preparing", worktreePath: "" });

    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeDisabled();
  });

  it("opens the pull request from the draft on the bar", async () => {
    const { user } = bar({ status: "draft_ready", draft: DRAFT });

    await user.click(screen.getByRole("button", { name: "Open PR" }));

    expect(api.openPR).toHaveBeenCalledWith("task-1", DRAFT.title, DRAFT.body);
  });

  it("opens the pull request again from the draft an opening that failed left", async () => {
    const { user } = bar({ status: "awaiting_reply", draft: DRAFT });

    await user.click(screen.getByRole("button", { name: "Open PR" }));

    expect(api.openPR).toHaveBeenCalledWith("task-1", DRAFT.title, DRAFT.body);
  });

  it.each([
    ["before the draft exists", {}],
    ["once the pull request exists", { draft: DRAFT, prNumber: 12 }],
  ] as const)(
    "has no pull request to open while the agent waits for a reply %s",
    (_, overrides) => {
      bar({ status: "awaiting_reply", ...overrides });

      expect(screen.queryByRole("button", { name: "Open PR" })).not.toBeInTheDocument();
    },
  );

  it("approves only with every file staged", async () => {
    bar({ status: "in_review", review: makeReview() });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();

    const { user } = bar({
      status: "ready_to_approve",
      review: makeReview({ staged: 2, total: 2 }),
    });
    await user.click(screen.getAllByRole("button", { name: "Approve" })[1] as HTMLElement);

    expect(api.approvePR).toHaveBeenCalledWith("task-1");
  });

  it("has no approve button before the review starts", () => {
    bar({ status: "drafting" });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("pauses the session of the PR stage, not of the task", async () => {
    const { user } = bar({ status: "reviewing", sessionStage: "pr_review" });

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("task-1", "pr_review");
  });

  it("resumes a paused session", async () => {
    const { user } = bar({ status: "reviewing", sessionStatus: "paused" });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1", "pr");
  });

  it("holds the rest of the actions in the menu", async () => {
    const { user } = bar({ status: "awaiting_decision", prNumber: 12 });

    await user.click(screen.getByRole("button", { name: "Pull request actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Review again" }));

    expect(api.reviewAgain).toHaveBeenCalledWith("task-1");
  });

  it("throws the draft away only while it is still a proposal", async () => {
    const { user } = bar({ status: "draft_ready", draft: DRAFT });

    await user.click(screen.getByRole("button", { name: "Pull request actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard draft" }));

    expect(api.discardDraft).toHaveBeenCalledWith("task-1");
  });

  it("reads the pull request again on demand", async () => {
    const { user } = bar({ status: "done", prNumber: 12 });

    await user.click(screen.getByRole("button", { name: "Pull request actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Refresh PR" }));

    expect(api.refreshPR).toHaveBeenCalledWith("task-1");
  });

  it("offers no closing while the pull request waits for its merge", async () => {
    const { user } = bar({ status: "done", prNumber: 12, prState: "open" });

    const button = screen.getByRole("button", { name: "Close task" });
    expect(button).toBeDisabled();

    await user.hover(button);

    expect(await screen.findByText("The pull request hasn't been merged yet")).toBeInTheDocument();
  });

  it("closes a task whose pull request was merged", async () => {
    const { user } = bar({ status: "merged", canClose: true, prNumber: 12, prState: "merged" });

    await user.click(screen.getByRole("button", { name: "Close task" }));

    expect(api.closeTask).toHaveBeenCalledWith("task-1");
  });

  it("offers no closing while the clone of the repository is missing", async () => {
    // The Go side refuses the closing while the clone is missing, however
    // merged the pull request is.
    const pr = makePullRequest({
      status: "merged",
      prNumber: 12,
      cloneMissing: true,
      canClose: false,
    });
    const task = makeTask({ stage: "pr", pr });
    const { user } = renderWithStore(<PRBar task={task} pr={pr} />, {
      state: makeState({ repositories: [makeRepository({ missing: true })], tasks: [task] }),
    });

    const button = screen.getByRole("button", { name: "Close task" });
    expect(button).toBeDisabled();

    await user.hover(button);

    expect(
      await screen.findByText("The clone at /home/dev/projects/web is missing."),
    ).toBeInTheDocument();
  });

  it("says the closing is under way", () => {
    bar({ status: "closing" });

    expect(screen.getByRole("button", { name: "Closing…" })).toBeDisabled();
  });

  it("warns when the merge couldn't be confirmed and offers the closing anyway", () => {
    bar({ status: "done", canClose: true, checkError: "gh: not authenticated", prNumber: 12 });

    expect(screen.getByText("Couldn't confirm the merge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close task" })).toBeEnabled();
  });

  it("has no worktree to open and no pull request to read once the task is closed", async () => {
    const { user } = bar({ status: "closed", prNumber: 12 });

    expect(screen.queryByRole("button", { name: "Open in VS Code" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close task" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pull request actions" }));

    expect(await screen.findByRole("menuitem", { name: "Refresh PR" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("says when the last approval produced no commit", () => {
    bar({ status: "ready_to_approve", commitFailed: true });

    expect(screen.getByText("The last approval didn't produce a commit.")).toBeInTheDocument();
  });
});
