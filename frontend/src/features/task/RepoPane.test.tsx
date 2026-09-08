import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoPane } from "@/features/task/RepoPane";
import { api, type RepoPR } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeReview, makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "web-draft.md" };

function pane(overrides: Partial<RepoPR> = {}) {
  const repo = makeRepoPR(overrides);
  const task = makeTask({ stage: "pr", repos: [repo] });
  return renderWithStore(<RepoPane taskId={task.id} repo={repo} />, {
    state: makeState({ tasks: [task] }),
    ui: {
      transcripts: {
        "task-1|pr:web": { status: "ready", entries: [], pending: [], buffered: [] },
        "task-1|pr_review:web": { status: "ready", entries: [], pending: [], buffered: [] },
      },
    },
  });
}

describe("RepoPane", () => {
  it("waits while the app checks GitHub", () => {
    pane({ status: "preparing" });

    expect(screen.getByRole("status")).toHaveTextContent("Checking GitHub…");
  });

  it("shows the block instead of a conversation", () => {
    pane({ status: "blocked", block: { reason: "gh_missing", detail: "" } });

    expect(screen.getByRole("alert")).toHaveTextContent("GitHub CLI was not found");
    expect(screen.queryByPlaceholderText("Reply to the agent…")).not.toBeInTheDocument();
  });

  it("is the conversation alone while the agent writes the draft", () => {
    pane({ status: "drafting" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("puts the draft above the conversation once it is ready", () => {
    pane({ status: "draft_ready", draft: DRAFT });

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
  });

  it("says the pull request is being opened", () => {
    pane({ status: "opening", draft: DRAFT });

    expect(screen.getByText("Opening the pull request…")).toBeInTheDocument();
  });

  it("is the conversation alone while the agent reviews", () => {
    pane({ status: "reviewing", prNumber: 12, sessionStage: "pr_review:web" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("puts the review strip above the conversation once changes are applied", () => {
    pane({
      status: "in_review",
      prNumber: 12,
      sessionStage: "pr_review:web",
      review: makeReview({ staged: 1, total: 2, percent: 50 }),
    });

    expect(screen.getByRole("progressbar", { name: "Review progress" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
  });

  it("closes the repository with the link, the passes and a way back in", async () => {
    const { user } = pane({
      status: "done",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
      prState: "open",
      reports: [
        { pass: 1, file: "web-review-1.md", clean: false },
        { pass: 2, file: "web-review-2.md", clean: true },
      ],
    });

    expect(screen.getByText("Pass 1 · changes requested")).toBeInTheDocument();
    expect(screen.getByText("Pass 2 · nothing to change")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review again" }));

    expect(api.reviewAgain).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("opens the pull request of a closed repository in the browser", async () => {
    const { user } = pane({
      status: "done",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
    });

    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("says a repository with no commits has nothing to propose", () => {
    pane({ status: "skipped" });

    expect(screen.getByText("No changes to open a pull request with")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Reply to the agent…")).not.toBeInTheDocument();
  });
});
