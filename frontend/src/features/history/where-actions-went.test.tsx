import { screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArchivedDiscussion } from "@/features/history/ArchivedDiscussion";
import { ArchivedReview } from "@/features/history/ArchivedReview";
import { ArchivedTask } from "@/features/history/ArchivedTask";
import { HistoryView } from "@/features/history/HistoryView";
import { GoneView } from "@/features/navigation/GoneView";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { StageActionDialog } from "@/features/task/StageActionDialog";
import { olderKey } from "@/lib/history";
import { api, type State } from "@/lib/wails";
import type { AppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeCloseResult,
  makeDeletePreview,
  makeDraft,
  makeHistorySummary,
  makeLeftover,
  makePullRequest,
  makeRepository,
  makeReviewFinding,
  makeReviewPass,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

// The controls of the screens that left — History as it was, the archived items, the dialogs of the
// task, the notice of what stayed on disk and the toast of an archive — each have a place in the new
// ones. A row is one control, in a state it appeared in, and where it is now by its whole accessible
// name; a screen has no more than one primary.

const NOW = new Date(2026, 8, 24, 15, 10);
const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 2).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(api.readArtifact).mockResolvedValue("# A document");
  vi.mocked(api.readReviewArtifact).mockResolvedValue("# A report");
  vi.mocked(api.readDiscussionArtifact).mockResolvedValue("# A document");
  vi.mocked(api.previewDelete).mockResolvedValue(makeDeletePreview());
});

/** Row is a control of a screen that left, in a state it appeared in, and what it is in the new one. */
interface Row {
  screen:
    | "History"
    | "Archived task"
    | "Archived review"
    | "Archived discussion"
    | "Dialog"
    | "Page"
    | "Toast";
  control: string;
  state: string;
  /** draw puts the screen in the state, and says where the control is now. */
  draw: () => Promise<void> | void;
}

const WEB = makeRepository({ archivedTasks: 2, archivedReviews: 2 });
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  archivedDiscussions: 1,
});
const TODAY_TASK = makeArchivedTask({
  id: "task-1",
  name: "Idempotency keys",
  archivedAt: at(24, 14),
});
const ONE_SHOT = makeArchivedTask({
  id: "task-2",
  name: "Fix the typo",
  mode: "one_shot",
  archivedAt: at(24, 13),
});
const MERGED = makeArchivedReview({
  id: "review-1",
  title: "Retry the export",
  number: 88,
  passes: [makeReviewPass({ published: true })],
  archivedAt: at(24, 12),
});
const CLOSED = makeArchivedReview({
  id: "review-2",
  title: "Drop the cache",
  number: 90,
  outcome: "closed",
  archivedAt: at(23, 12),
});
const DISCUSSION = makeArchivedDiscussion({
  id: "discussion-1",
  title: "Webhook delivery",
  archivedAt: at(23, 11),
  repositoryIds: ["repo-2"],
  drafts: [makeDraft({ outcome: "created", published: true, number: 31 })],
});

function history(state: Partial<State> = {}, ui: Partial<AppStore> = {}) {
  return renderWithStore(<HistoryView />, {
    state: makeState({
      repositories: [WEB, API],
      boards: [makeBoard({ id: "board-1", title: "Roadmap" })],
      history: [TODAY_TASK, ONE_SHOT],
      reviewHistory: [MERGED, CLOSED],
      discussionHistory: [DISCUSSION],
      historySummary: makeHistorySummary({
        tasks: 2,
        reviews: 2,
        discussions: 1,
        oldest: at(23, 11),
      }),
      ...state,
    }),
    ui: { location: { kind: "history" }, ...ui },
  });
}

const rowNamed = (name: RegExp) => screen.getByRole("treeitem", { name });

const HISTORY: Row[] = [
  {
    screen: "History",
    control: "the search with the focus",
    state: "with items",
    draw: () => {
      history();
      expect(screen.getByRole("searchbox", { name: "Search History" })).toHaveFocus();
    },
  },
  {
    screen: "History",
    control: "the three lists, mixed by the day",
    state: "a task, a review and a discussion",
    draw: () => {
      history();
      const tree = screen.getByRole("tree", { name: "History" });
      expect(within(tree).getAllByRole("treeitem", { name: /^Archived / })).toHaveLength(2);
      expect(rowNamed(/^Task /)).toBeInTheDocument();
      expect(screen.getAllByRole("treeitem", { name: /^Review / })).toHaveLength(2);
      expect(rowNamed(/^Discussion /)).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the name, the short repository, the pull request and the steps",
    state: "a task",
    draw: () => {
      history();
      expect(
        rowNamed(/^Task Idempotency keys, web, PR #12 · 1 step, archived today at 14:02$/),
      ).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "One-Shot",
    state: "a One-Shot task",
    draw: () => {
      history();
      expect(rowNamed(/^One-Shot task Fix the typo, web, PR #12 · One-Shot, /)).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the pull request and the outcome of the review",
    state: "a review that was merged, one that was closed",
    draw: () => {
      history();
      expect(rowNamed(/^Review Retry the export, web#88, Merged · 1 pass, /)).toBeInTheDocument();
      expect(rowNamed(/^Review Drop the cache, web#90, Closed · 1 pass, /)).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the board and the cards published",
    state: "a discussion",
    draw: () => {
      history();
      expect(
        rowNamed(
          /^Discussion Webhook delivery, Roadmap, 1 card published, archived yesterday at 11:02$/,
        ),
      ).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the dates",
    state: "two days",
    draw: () => {
      history();
      expect(rowNamed(/^Archived today: 3$/)).toBeInTheDocument();
      expect(rowNamed(/^Archived yesterday: 2$/)).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the filter by repository, as the chip of the sidebar's",
    state: "one repository",
    draw: () => {
      history({ repositoryFilter: "repo-2" });
      expect(screen.getByRole("button", { name: "Only dev/api" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Show all repositories" })).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the empty History",
    state: "nothing archived",
    draw: () => {
      history({
        history: [],
        reviewHistory: [],
        discussionHistory: [],
        historySummary: makeHistorySummary(),
      });
      expect(screen.getByText("Nothing archived yet")).toBeInTheDocument();
    },
  },
  {
    screen: "History",
    control: "the empty repository, with the way back to all",
    state: "a filter with nothing archived",
    draw: () => {
      history({
        history: [],
        reviewHistory: [],
        discussionHistory: [],
        historySummary: makeHistorySummary(),
        repositoryFilter: "repo-1",
      });
      expect(
        screen.getAllByRole("button", { name: "Show all repositories" }).length,
      ).toBeGreaterThan(0);
    },
  },
  {
    screen: "History",
    control: "the empty search, with the way back",
    state: "a search with no match",
    draw: () => {
      history(
        {},
        {
          historyQuery: "refund",
          olderLists: {
            [olderKey("refund", "")]: {
              ids: [],
              next: null,
              matched: 0,
              status: "idle",
              error: "",
            },
          },
        },
      );
      expect(screen.getByText("Nothing matches “refund”")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Clear the search" })).toBeInTheDocument();
    },
  },
];

function archivedTask(overrides = {}) {
  const task = makeArchivedTask({
    steps: [
      {
        number: 1,
        file: "1-add-the-login-form.md",
        title: "Add the login form",
        reports: [{ pass: 1, file: "1-review-1.md", clean: false, findings: 2 }],
        commitSha: "c19f02e8a4b7d0",
      },
    ],
    card: makeTaskCard({ repository: "dev/web", number: 40 }),
    ...overrides,
  });
  return renderWithStore(<ArchivedTask taskId={task.id} />, {
    state: makeState({ history: [task], repositories: [makeRepository({ id: "repo-1" })] }),
    ui: { location: { kind: "archived-task", id: task.id } },
  });
}

const ARCHIVED_TASK: Row[] = [
  {
    screen: "Archived task",
    control: "Archived, the dates and the steps",
    state: "without a closing result",
    draw: () => {
      archivedTask();
      expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toBeInTheDocument();
      expect(screen.getByText("Archived", { selector: "dt" })).toBeInTheDocument();
      expect(screen.getByText("Started", { selector: "dt" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Steps · 1" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived task",
    control: "the link of the card and of the pull request",
    state: "a task with both",
    draw: () => {
      archivedTask();
      expect(screen.getByRole("link", { name: "web#40" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "PR #12" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived task",
    control: "Delete…",
    state: "in the ⋯",
    draw: async () => {
      const { user } = archivedTask();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      expect(await screen.findByRole("menuitem", { name: "Delete…" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived task",
    control: "the tabs PRD, Tech spec and Steps",
    state: "a Structured task",
    draw: () => {
      archivedTask();
      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "PRD",
        "Tech spec",
        "Steps · 1",
        "Pull request",
      ]);
    },
  },
  {
    screen: "Archived task",
    control: "the file of a step and the reports of its review",
    state: "the Steps tab",
    draw: async () => {
      const { user } = archivedTask();
      await user.click(screen.getByRole("tab", { name: "Steps · 1" }));
      const step = screen.getByRole("button", { name: "1 Add the login form, c19f02e" });
      await user.click(step);
      expect(await screen.findByTestId("markdown")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Review 1 · changes · 2 findings" }),
      ).toBeInTheDocument();
    },
  },
  {
    screen: "Archived task",
    control: "the One-Shot document with the reports",
    state: "a One-Shot task",
    draw: () => {
      archivedTask({
        mode: "one_shot",
        hasOneShot: true,
        steps: [
          {
            number: 1,
            file: "one-shot.md",
            title: "Fix",
            reports: [{ pass: 1, file: "1-review-1.md", clean: true, findings: 0 }],
            commitSha: "",
          },
        ],
      });
      expect(screen.getByRole("tab", { name: "One-Shot document" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review 1 · clean" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived task",
    control: "Nothing written yet.",
    state: "a task with no document",
    draw: () => {
      archivedTask({ hasPrd: false, hasTechSpec: false });
      expect(screen.getByText("Nothing was written.")).toBeInTheDocument();
    },
  },
  {
    screen: "Archived task",
    control: "the skeleton and the read error",
    state: "reading, and a document that failed",
    draw: async () => {
      vi.mocked(api.readArtifact).mockRejectedValue(new Error("no such file"));
      archivedTask();
      expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    },
  },
];

function archivedReview(overrides = {}) {
  const review = makeArchivedReview({
    passes: [
      makeReviewPass({
        pass: 2,
        file: "review-2.md",
        published: true,
        publishedAt: "2026-09-17T09:00:00Z",
        verdict: "request_changes",
        findings: [
          makeReviewFinding({ title: "Missing guard", decision: "approved", placement: "inline" }),
        ],
      }),
    ],
    ...overrides,
  });
  return renderWithStore(<ArchivedReview reviewId={review.id} />, {
    state: makeState({ reviewHistory: [review] }),
    ui: { location: { kind: "archived-review", id: review.id } },
  });
}

const ARCHIVED_REVIEW: Row[] = [
  {
    screen: "Archived review",
    control: "the outcome, the author and the dates",
    state: "a review that was closed",
    draw: () => {
      archivedReview({ outcome: "closed" });
      expect(screen.getByText("Closed", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText("Pull request", { selector: "dt" }).closest("dl")).toHaveTextContent(
        "by alice",
      );
      expect(screen.getByText("Archived", { selector: "dt" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived review",
    control: "Open on GitHub and the link of the pull request",
    state: "any review",
    draw: () => {
      archivedReview();
      expect(screen.getByRole("button", { name: "Open on GitHub" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "web#31" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived review",
    control: "Delete…",
    state: "in the ⋯",
    draw: async () => {
      const { user } = archivedReview();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      expect(await screen.findByRole("menuitem", { name: "Delete…" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived review",
    control: "the verdict, the date, the findings that left and the report of a pass",
    state: "a published pass",
    draw: () => {
      archivedReview();
      const pass = screen.getByRole("region", { name: "Pass 2" });
      expect(within(pass).getByText("Request changes")).toBeInTheDocument();
      expect(within(pass).getByText(/^published Sep 17/)).toBeInTheDocument();
      expect(within(pass).getByText("Missing guard")).toBeInTheDocument();
      expect(
        within(pass).getByRole("button", { name: "Report · reviews/pass-2.md" }),
      ).toBeInTheDocument();
    },
  },
  {
    screen: "Archived review",
    control: "No report was written.",
    state: "a pass without a report",
    draw: () => {
      archivedReview({ passes: [makeReviewPass({ recorded: false, file: "" })] });
      expect(screen.getByText("No report was written.")).toBeInTheDocument();
    },
  },
];

function archivedDiscussion(overrides = {}) {
  const discussion = makeArchivedDiscussion(overrides);
  return renderWithStore(<ArchivedDiscussion discussionId={discussion.id} />, {
    state: makeState({
      discussionHistory: [discussion],
      boards: [makeBoard({ id: "board-1", title: "Roadmap" })],
    }),
    ui: { location: { kind: "archived-discussion", id: discussion.id } },
  });
}

const ARCHIVED_DISCUSSION: Row[] = [
  {
    screen: "Archived discussion",
    control: "Archived, the dates and the cards published",
    state: "one draft published",
    draw: () => {
      archivedDiscussion({
        drafts: [makeDraft({ outcome: "created", published: true, number: 31 })],
      });
      expect(screen.getByText("Archived", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText("Started", { selector: "dt" })).toBeInTheDocument();
      expect(screen.getByText("Board", { selector: "dt" }).closest("dl")).toHaveTextContent(
        "1 of 1 draft: 1 created",
      );
    },
  },
  {
    screen: "Archived discussion",
    control: "Delete…",
    state: "in the ⋯",
    draw: async () => {
      const { user } = archivedDiscussion();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      expect(await screen.findByRole("menuitem", { name: "Delete…" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived discussion",
    control: "the document, or No document was written.",
    state: "with and without a document",
    draw: async () => {
      archivedDiscussion();
      expect(await screen.findByRole("button", { name: /^discussion\.md/ })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived discussion",
    control: "No document was written.",
    state: "no document",
    draw: async () => {
      vi.mocked(api.readDiscussionArtifact).mockRejectedValue(new Error("no such file"));
      archivedDiscussion();
      expect(await screen.findByText("No document was written.")).toBeInTheDocument();
    },
  },
  {
    screen: "Archived discussion",
    control: "the drafts with what they became, and the epics with their cards",
    state: "an epic with a card",
    draw: () => {
      archivedDiscussion({
        drafts: [
          makeDraft({ id: "epic-1", kind: "epic", title: "Invoicing", position: 1 }),
          makeDraft({
            id: "draft-2",
            position: 2,
            title: "Export",
            outcome: "created",
            number: 31,
            url: "https://github.com/dev/web/issues/31",
            published: true,
            epic: { draft: "epic-1", key: "", reference: "", title: "Invoicing", url: "" },
          }),
        ],
      });
      expect(screen.getByRole("heading", { name: "What it published" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Created web#31" })).toBeInTheDocument();
    },
  },
  {
    screen: "Archived discussion",
    control: "the whole conversation, read only",
    state: "a conversation",
    draw: async () => {
      archivedDiscussion();
      expect(await screen.findByRole("button", { name: /^Conversation/ })).toBeInTheDocument();
    },
  },
];

const WORKTREE = {
  path: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
  dirty: true,
  files: 3,
  error: "",
};
const BRANCH = { name: "add-login", merged: false, ahead: 2, error: "" };
const PR = { number: 12, url: "https://github.com/o/r/pull/12", state: "open" };
const noop = vi.fn();

function dialogIn(element: ReactElement, state: Partial<State> = {}) {
  return renderWithStore(element, { state: makeState(state) });
}

const TASK = makeTask({ name: "Rate limit per API key" });

const DIALOGS: Row[] = [
  {
    screen: "Dialog",
    control:
      "Delete task: the session, the worktree with its files and path, the branch, the pull request that stays",
    state: "everything to lose",
    draw: async () => {
      vi.mocked(api.previewDelete).mockResolvedValue(
        makeDeletePreview({ worktree: WORKTREE, branch: BRANCH, pr: PR }),
      );
      dialogIn(
        <DeleteTaskDialog task={makeTask({ sessionStatus: "working" })} open onOpenChange={noop} />,
      );
      const list = await screen.findByRole("list", { name: "What will be destroyed" });
      expect(within(list).getByText("3 uncommitted files")).toBeInTheDocument();
      expect(within(list).getByText("not merged · 2 commits")).toBeInTheDocument();
      expect(within(list).getByText("PR #12 stays open on GitHub")).toBeInTheDocument();
      expect(screen.getByText(/answer in progress is interrupted/)).toBeInTheDocument();
    },
  },
  {
    screen: "Dialog",
    control: "Delete task: the read error",
    state: "the reading failed",
    draw: async () => {
      vi.mocked(api.previewDelete).mockRejectedValue(new Error("git is busy"));
      dialogIn(<DeleteTaskDialog task={TASK} open onOpenChange={noop} />);
      expect(await screen.findByText("Couldn't read the worktree and the branch")).toBeVisible();
    },
  },
  {
    screen: "Dialog",
    control: "Cancel and Delete task",
    state: "open",
    draw: async () => {
      dialogIn(<DeleteTaskDialog task={TASK} open onOpenChange={noop} />);
      const dialog = screen.getByRole("alertdialog", { name: "Delete “Rate limit per API key”?" });
      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
      );
      expect(within(dialog).getByRole("button", { name: "Delete task" })).toBeInTheDocument();
      expect(dialog.querySelectorAll("[data-variant=primary]")).toHaveLength(0);
    },
  },
  {
    screen: "Dialog",
    control: "Discard step: the text with a reviewer, without one",
    state: "reviewer and reports; implementer alone",
    draw: () => {
      const step = makeStep({
        number: 3,
        status: "awaiting_review",
        reviewer: makeStepReviewer(),
        reports: [{ pass: 1, file: "3-review-1.md", clean: false, findings: -1 }],
      });
      const task = makeTask({ stage: "implementation", steps: [step], currentStep: 3 });
      dialogIn(<DiscardStepDialog task={task} step={step} open onOpenChange={noop} />, {
        tasks: [task],
      });
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "deletes the conversations of step 3 and of its reviewer, with the report of the agent review",
      );
    },
  },
  {
    screen: "Dialog",
    control: "Also clean the worktree, checked at each opening, and Discard step",
    state: "open",
    draw: () => {
      const step = makeStep({ number: 3, status: "awaiting_review" });
      const task = makeTask({ stage: "implementation", steps: [step], currentStep: 3 });
      dialogIn(<DiscardStepDialog task={task} step={step} open onOpenChange={noop} />, {
        tasks: [task],
      });
      expect(screen.getByRole("checkbox", { name: /^Also clean the worktree/ })).toBeChecked();
      expect(screen.getByRole("button", { name: "Discard step" })).toBeInTheDocument();
    },
  },
  {
    screen: "Dialog",
    control:
      "Back to…: what is lost by stage, the pull request that stays open, and Back to the PRD",
    state: "from the pull request",
    draw: () => {
      const pr = makePullRequest({
        prNumber: 1284,
        prUrl: "https://github.com/o/r/pull/1284",
        prState: "open",
      });
      const task = makeTask({ stage: "pr", pr });
      dialogIn(
        <StageActionDialog task={task} action="back" stage="prd" open onOpenChange={noop} />,
        { tasks: [task] },
      );
      expect(screen.getByRole("heading", { name: "Back to the PRD?" })).toBeInTheDocument();
      expect(screen.getByText("PR #1284 stays open on GitHub.")).toBeVisible();
      expect(screen.getByRole("button", { name: "Back to the PRD" })).toBeInTheDocument();
    },
  },
  {
    screen: "Dialog",
    control: "Discard and restart…: the title and Discard the Tech spec",
    state: "from the plan",
    draw: () => {
      const task = makeTask({ stage: "plan" });
      dialogIn(
        <StageActionDialog
          task={task}
          action="discard"
          stage="tech_spec"
          open
          onOpenChange={noop}
        />,
        { tasks: [task] },
      );
      expect(
        screen.getByRole("heading", { name: "Discard the Tech spec and start over?" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard the Tech spec" })).toBeInTheDocument();
    },
  },
];

function pageOfLeft(item: "task" | "review", leftover: ReturnType<typeof makeLeftover> | null) {
  const location = { kind: "gone", item, id: "x-1", name: "add-login", boardId: "" } as const;
  return renderWithStore(<GoneView location={location} />, {
    state: makeState(),
    ui: { location, ...(leftover === null ? {} : { leftovers: { "x-1": leftover } }) },
  });
}

const PAGES: Row[] = [
  {
    screen: "Page",
    control: "Some files stayed on disk: the path, the branch and the git error",
    state: "a task deleted with both kept",
    draw: () => {
      pageOfLeft(
        "task",
        makeLeftover({
          repoPath: "/home/dev/code/api",
          worktree: {
            path: "/home/dev/wt/add-login",
            kept: true,
            error: "contains modified files",
          },
          branch: { name: "add-login", kept: true, error: "checked out" },
        }),
      );
      const group = screen.getByRole("group", { name: "What stayed on disk" });
      expect(group).toHaveTextContent("contains modified files");
      expect(group).toHaveTextContent("checked out");
      expect(screen.getByRole("button", { name: "Copy the command" })).toBeInTheDocument();
    },
  },
  {
    screen: "Page",
    control: "Some files stayed on disk: the worktree of a review",
    state: "a review deleted",
    draw: () => {
      pageOfLeft("review", makeLeftover({ branch: null }));
      expect(screen.getByRole("group", { name: "What stayed on disk" })).toBeInTheDocument();
    },
  },
  {
    screen: "Page",
    control: "Next that needs you is the one primary; Open in History with nothing waiting",
    state: "a task closed and archived",
    draw: () => {
      const location = {
        kind: "gone",
        item: "task",
        id: "task-1",
        name: "add-login",
        boardId: "",
      } as const;
      const { container } = renderWithStore(<GoneView location={location} />, {
        state: makeState({ history: [makeArchivedTask({ close: makeCloseResult() })] }),
        ui: { location },
      });
      expect(screen.getByRole("button", { name: "Open in History" })).toHaveAttribute(
        "data-variant",
        "primary",
      );
      expect(container.querySelectorAll("[data-variant=primary]")).toHaveLength(1);
    },
  },
];

const TOASTS: Row[] = [
  {
    screen: "Toast",
    control: "the name of what was archived and Open in History",
    state: "a task archived without being open",
    draw: () => {
      const task = makeArchivedTask({
        id: "task-1",
        name: "add-login",
        close: makeCloseResult({ closedAt: NOW.toISOString() }),
      });
      renderWithStore(<ShellToasts />, { ui: { toasts: [{ id: "task-1", kind: "task", task }] } });
      expect(screen.getByRole("status")).toHaveTextContent("“add-login” was archived");
      expect(screen.getByRole("button", { name: "Open in History" })).toBeInTheDocument();
    },
  },
];

const ROWS = [
  ...HISTORY,
  ...ARCHIVED_TASK,
  ...ARCHIVED_REVIEW,
  ...ARCHIVED_DISCUSSION,
  ...DIALOGS,
  ...PAGES,
  ...TOASTS,
];

describe("Where the actions of the screens that left went", () => {
  it.each(ROWS.map((row) => [row.screen, row.control, row.state, row] as const))(
    "%s: %s, %s",
    async (_screen, _control, _state, row) => {
      await row.draw();
      // No screen has more than one primary on its top layer.
      const layer = document.querySelector('[role="alertdialog"]') ?? document;
      expect(layer.querySelectorAll("[data-variant=primary]").length).toBeLessThanOrEqual(1);
    },
  );
});
