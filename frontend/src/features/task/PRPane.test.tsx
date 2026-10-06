import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRPane } from "@/features/task/PRPane";
import {
  api,
  type Entry,
  type PullRequest,
  type Situation,
  type TaskConversation,
} from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePRCheck,
  makePullRequest,
  makeRepository,
  makeReview,
  makeSituation,
  makeState,
  makeTask,
  makeTaskConversation,
} from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

// onPR is the situation of the pull request the request bar is drawn from.
const onPR = (kind: string, form = "") =>
  makeSituation({ kind, form, place: { kind: "pr", stage: "", step: 0 } });

// REVIEWED are the conversations of a task whose review of the pull request started.
const REVIEWED: TaskConversation[] = [
  makeTaskConversation({ stage: "pr" }),
  makeTaskConversation({ stage: "pr_review" }),
];

// said is an entry of the user saying the text given.
function said(text: string): Entry {
  const entry = makeEntry("user");
  return entry.user === null ? entry : { ...entry, user: { ...entry.user, text } };
}

const read = (entries: Entry[] = []): TranscriptState => ({
  status: "ready",
  error: "",
  entries,
  pending: [],
  buffered: [],
});

interface PaneOptions {
  situations?: Situation[];
  conversations?: TaskConversation[];
  repositories?: ReturnType<typeof makeRepository>[];
  review?: Entry[];
}

function pane(overrides: Partial<PullRequest> = {}, options: PaneOptions = {}) {
  const pr = makePullRequest(overrides);
  const task = makeTask({
    stage: "pr",
    pr,
    situations: options.situations ?? [],
    conversations: options.conversations ?? [makeTaskConversation({ stage: "pr" })],
  });
  return renderWithStore(<PRPane task={task} pr={pr} tab="implementer" />, {
    state: makeState({ repositories: options.repositories ?? [makeRepository()], tasks: [task] }),
    ui: {
      transcripts: {
        "task-1|pr": read([said("Write the draft")]),
        "task-1|pr_review": read(options.review ?? [said("Review the pull request")]),
      },
    },
  });
}

const composer = () => screen.queryByRole("textbox", { name: "Reply to the PR agent" });
const feed = () => screen.getByRole("feed");

// placeEmpty is the empty state of the place, which is not a live region.
function placeEmpty(): HTMLElement {
  const empty = document.querySelector<HTMLElement>('[data-slot="place-empty"]');
  if (empty === null) {
    throw new Error("the place is not empty");
  }
  return empty;
}

// The rows of the table of the place without a conversation, for the pull request.
describe("PRPane, the place without a conversation", () => {
  it("prepares the pull request", () => {
    pane({ status: "preparing", sessionStage: "" });

    expect(screen.getByRole("status")).toHaveTextContent("Preparing the pull request…");
    expect(composer()).not.toBeInTheDocument();
    expect(screen.queryByRole("feed")).not.toBeInTheDocument();
  });

  it("says the stage stopped, with the error block and Try again in the bar", () => {
    pane(
      {
        status: "blocked",
        sessionStage: "",
        block: { reason: "gh_unauthenticated", detail: "gh: not logged in" },
      },
      { situations: [onPR("pr_blocked")] },
    );

    const empty = screen
      .getByText("The pull request stage stopped")
      .closest("[data-slot=place-empty]") as HTMLElement;
    const block = within(empty).getByRole("article", {
      name: "Run gh auth login in a terminal, then try again.",
    });
    expect(block).toHaveTextContent("gh: not logged in");
    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(composer()).not.toBeInTheDocument();
  });

  it("opens the pull request at the end of the conversation of the PR, with the composer", () => {
    pane({ status: "opening", draft: DRAFT, sessionStage: "pr" });

    expect(within(feed()).getByText("Write the draft")).toBeInTheDocument();
    expect(within(feed()).getByRole("status")).toHaveTextContent("Opening the pull request…");
    expect(screen.queryByRole("article", { name: "Pull request draft" })).not.toBeInTheDocument();
    expect(composer()).toBeInTheDocument();
  });

  it("waits for the checks before the first pass, with the live checks and no composer", () => {
    pane({
      status: "waiting_checks",
      prNumber: 1284,
      sessionStage: "",
      checkedAt: new Date().toISOString(),
      checks: [
        makePRCheck({ name: "unit", state: "passed" }),
        makePRCheck({ name: "e2e / chromium", state: "running", completedAt: "" }),
      ],
    });

    const empty = placeEmpty();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(empty).toHaveTextContent("The review starts when the checks finish.");
    expect(empty).toHaveTextContent(
      "MySpec reads #1284 every minute. The first pass begins once e2e / chromium is done.",
    );
    expect(empty).toHaveTextContent("Waiting for checks · 1 of 2 passed");
    expect(empty).toHaveTextContent("checked just now");
    expect(within(empty).getByRole("list", { name: "Checks" })).toHaveTextContent("e2e / chromium");
    expect(composer()).not.toBeInTheDocument();
  });

  it("reads GitHub for the checks before the first reading", () => {
    pane({ status: "waiting_checks", prNumber: 1284, sessionStage: "" });

    const empty = placeEmpty();
    expect(empty).toHaveTextContent("MySpec reads #1284 every minute.");
    expect(empty).toHaveTextContent("checking GitHub");
  });

  it.each([
    ["done", "open", null],
    ["trouble", "open", null],
    ["merged", "merged", "Merged #1284 into dev"],
    ["pr_closed", "closed", "Closed #1284 without a merge"],
  ])(
    "reads the conversation of the review closed with the pull request %s",
    (status, prState, endLine) => {
      pane(
        { status, prState, prNumber: 1284, prBase: "dev", sessionStage: "" },
        { conversations: REVIEWED },
      );

      expect(within(feed()).getByText("Review the pull request")).toBeInTheDocument();
      expect(screen.queryByText("Write the draft")).not.toBeInTheDocument();
      if (endLine === null) {
        expect(within(feed()).queryByRole("article", { name: /^(Merged|Closed) #/ })).toBeNull();
      } else {
        expect(
          within(feed()).getByRole("article", { name: new RegExp(`^${endLine}`) }),
        ).toBeInTheDocument();
      }
      expect(composer()).not.toBeInTheDocument();
    },
  );

  it("names who merged the pull request on the line of the merge", () => {
    pane(
      {
        status: "merged",
        prState: "merged",
        prNumber: 1284,
        prBase: "dev",
        mergedBy: "lnakamura",
        sessionStage: "",
      },
      { conversations: REVIEWED },
    );

    expect(
      within(feed()).getByRole("article", { name: /^Merged #1284 into dev · by lnakamura/ }),
    ).toBeInTheDocument();
  });

  it("says the pull request was merged before the first review pass", () => {
    pane({ status: "merged", prState: "merged", prNumber: 1284, prBase: "dev", sessionStage: "" });

    expect(placeEmpty()).toHaveTextContent(
      "The pull request was merged before the first review pass.",
    );
    expect(screen.getByRole("article", { name: /^Merged #1284 into dev/ })).toBeInTheDocument();
    expect(screen.queryByRole("feed")).not.toBeInTheDocument();
    expect(composer()).not.toBeInTheDocument();
  });

  it("says the pull request was closed before the first review pass", () => {
    pane({ status: "pr_closed", prState: "closed", prNumber: 1284, sessionStage: "" });

    expect(placeEmpty()).toHaveTextContent(
      "The pull request was closed without a merge before the first review pass.",
    );
    expect(
      screen.getByRole("article", { name: "Closed #1284 without a merge" }),
    ).toBeInTheDocument();
  });

  it("closes the task", () => {
    pane({ status: "closing", sessionStage: "" });

    expect(screen.getByRole("status")).toHaveTextContent("Closing the task…");
    expect(composer()).not.toBeInTheDocument();
  });

  it("keeps the request bar under the closed review, with the closing in it", async () => {
    const { user } = pane(
      { status: "merged", canClose: true, prNumber: 12, prState: "merged", sessionStage: "" },
      { situations: [onPR("merge", "close")], conversations: REVIEWED },
    );

    const bar = screen.getByRole("region", { name: "Request" });
    await user.click(within(bar).getByRole("button", { name: "Close task" }));

    expect(api.closeTask).toHaveBeenCalledWith("task-1");
  });
});

describe("PRPane, the conversation", () => {
  it("is the conversation alone while the agent writes the draft", () => {
    pane({ status: "drafting" });

    expect(composer()).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("puts the draft at the end of the conversation once it is ready, and its approval in the bar", () => {
    pane(
      { status: "draft_ready", draft: DRAFT, sessionStage: "pr" },
      { situations: [onPR("draft")] },
    );

    const draft = within(feed()).getByRole("article", { name: "Pull request draft" });
    expect(within(draft).getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(composer()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open PR" })).not.toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("button", { name: "Approve draft" })).toBeInTheDocument();
  });

  it("walks the arrows through the draft, the last entry of the feed, and leaves the fields their keys", async () => {
    const { user } = pane(
      { status: "draft_ready", draft: DRAFT, sessionStage: "pr" },
      { situations: [onPR("draft")] },
    );

    const draft = within(feed()).getByRole("article", { name: "Pull request draft" });
    draft.focus();
    await user.keyboard("{ArrowUp}");
    const before = within(feed()).getAllByRole("article").at(-2);
    expect(before).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(draft).toHaveFocus();

    const title = within(draft).getByLabelText("Title");
    await user.click(title);
    await user.keyboard("{ArrowUp}");
    expect(title).toHaveFocus();
  });

  it("keeps the draft at the end of the conversation after an opening that failed", () => {
    pane({ status: "awaiting_reply", draft: DRAFT });

    expect(within(feed()).getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(composer()).toBeInTheDocument();
  });

  it("is the conversation alone while the agent waits for a reply without a draft", () => {
    pane({ status: "awaiting_reply" });

    expect(composer()).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("is the conversation alone while the agent owes the report of a review pass", () => {
    pane(
      { status: "awaiting_reply", draft: DRAFT, prNumber: 12, sessionStage: "pr_review" },
      { conversations: REVIEWED },
    );

    expect(composer()).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("is the conversation alone while the agent reviews", () => {
    pane(
      { status: "reviewing", prNumber: 12, sessionStage: "pr_review" },
      { conversations: REVIEWED },
    );

    expect(within(feed()).getByText("Review the pull request")).toBeInTheDocument();
    expect(composer()).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /^Changed files/ })).not.toBeInTheDocument();
  });

  it("keeps the conversation while a later pass waits for the checks, with the live checks at its end", () => {
    pane(
      {
        status: "waiting_checks",
        prNumber: 12,
        sessionStage: "pr_review",
        checkedAt: new Date().toISOString(),
        checks: [makePRCheck({ name: "unit", state: "running", completedAt: "" })],
      },
      { conversations: REVIEWED },
    );

    const checks = within(feed()).getByRole("article", {
      name: "Waiting for checks · 0 of 1 passed",
    });
    expect(checks).toHaveAttribute("data-feed-item");
    expect(within(checks).getByRole("list", { name: "Checks" })).toHaveTextContent("unit");
    expect(composer()).toBeInTheDocument();
  });

  it("puts the changed files at the end of the conversation once changes are applied", () => {
    pane(
      {
        status: "in_review",
        prNumber: 12,
        sessionStage: "pr_review",
        review: makeReview({ staged: 1, total: 2, percent: 50 }),
      },
      { conversations: REVIEWED },
    );

    expect(within(feed()).getByRole("article", { name: "Changed files · 2" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(composer()).toBeInTheDocument();
  });
});
