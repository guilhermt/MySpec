import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { ReviewView } from "@/features/reviews/ReviewView";
import { StartReviewDialog } from "@/features/reviews/StartReviewDialog";
import { REVIEWS_SECTIONS_KEY } from "@/lib/ui-storage";
import {
  api,
  type PullRequestRow,
  type Repository,
  type ReviewCenter,
  type ReviewSummary,
  type Situation,
  type State,
} from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { type RenderWithStoreResult, renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeBoard,
  makeEntry,
  makePullRequestRow,
  makePullsFailure,
  makeRepository,
  makeReview,
  makeReviewCenter,
  makeReviewFilters,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const MINUTE = 60_000;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();

const CARD = {
  boardId: "board-1",
  number: 452,
  title: "Idempotency keys",
  url: "https://github.com/dev/web/issues/452",
  status: "In progress",
};

// The list of Reviews: web#31, the pull request of the rows, read two minutes ago, with every
// section expanded.

function listState(
  row: Partial<PullRequestRow> = {},
  center: Partial<ReviewCenter> = {},
  app: Partial<State> = {},
  repository: Partial<Repository> = {},
): State {
  return makeState({
    repositories: [makeRepository(repository)],
    boards: [makeBoard()],
    tasks: [makeTask({ id: "task-1", name: "login-task" })],
    reviews: [makeReviewSummary()],
    reviewCenter: makeReviewCenter({
      readAt: minutesAgo(2),
      pullRequests: [makePullRequestRow(row)],
      authors: ["alice", "dependabot"],
      labels: ["bug"],
      ...center,
    }),
    ...app,
  });
}

function list(
  row: Partial<PullRequestRow> = {},
  center: Partial<ReviewCenter> = {},
  repository: Partial<Repository> = {},
): () => RenderWithStoreResult {
  return () => renderWithStore(<ReviewsView />, { state: listState(row, center, {}, repository) });
}

function start(row: Partial<PullRequestRow> = {}): () => RenderWithStoreResult {
  return () =>
    renderWithStore(<StartReviewDialog />, {
      state: listState({ mergeable: "mergeable", ...row }),
      ui: { startReview: { repositoryId: "repo-1", number: 31 } },
    });
}

// The screen of a review: review-1 of web#31, resting on the situation it waits on.

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

// atRest is a review whose reviewer rests after the first pass.
function atRest(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return makeReviewSummary({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    passes: [makeReviewPass()],
    canReviewAgain: true,
    ...overrides,
  });
}

function review(
  overrides: Partial<ReviewSummary> = {},
  ui: NonNullable<StoreOptions["ui"]> = {},
): () => RenderWithStoreResult {
  return () => {
    const summary = atRest(overrides);
    return renderWithStore(<ReviewView reviewId={summary.id} />, {
      state: makeState({ reviews: [summary] }),
      ui: { location: { kind: "review", id: summary.id }, ...ui },
    });
  };
}

// FINDINGS are the three findings of a pass, the second one decided.
const FINDINGS = [
  makeReviewFinding({ number: 1 }),
  makeReviewFinding({ number: 2, title: "No test", decision: "approved" }),
  makeReviewFinding({ number: 3, title: "The copy is wrong", path: "", line: 0 }),
];

const DECIDE = { status: "awaiting_decision", situations: [situation("review_report")] };
const DECIDING = { ...DECIDE, passes: [makeReviewPass({ findings: FINDINGS })] };

// DECIDED is a pass whose findings are all decided, one approved on a line.
const DECIDED = makeReviewPass({
  findings: [
    makeReviewFinding({ number: 1, decision: "approved" }),
    makeReviewFinding({ number: 2, decision: "discarded" }),
  ],
});

const PUBLISH = {
  status: "ready_to_publish",
  canPublish: true,
  situations: [situation("review_report", "publish")],
  passes: [DECIDED],
};

const APPLY = {
  mode: "apply",
  status: "ready_to_apply",
  canApply: true,
  situations: [situation("review_report", "apply")],
  passes: [DECIDED],
};

const CHANGES = {
  mode: "apply",
  status: "in_review",
  review: makeReview(),
  situations: [situation("changes_review", "staged")],
};

const APPROVE = {
  mode: "apply",
  status: "ready_to_approve",
  canApprove: true,
  review: makeReview({ staged: 2, total: 2, percent: 100 }),
  situations: [situation("changes_review", "approve")],
};

const NEW_COMMITS = {
  status: "new_commits",
  newCommits: 3,
  passes: [makeReviewPass({ published: true, verdict: "request_changes" })],
  situations: [situation("new_commits")],
};

const TROUBLE = {
  status: "trouble",
  trouble: { failedChecks: ["build"], conflict: false },
  situations: [situation("pr_trouble", "checks", "error")],
};

const BLOCKED = {
  status: "pass_blocked",
  passBlocked: "The worktree couldn't be updated.",
  situations: [situation("pass_blocked", "", "error")],
};

// reportMarker is the marker that says the report of the first pass was written.
function reportMarker() {
  const entry = makeEntry("marker");
  return entry.marker === null
    ? entry
    : { ...entry, marker: { ...entry.marker, type: "pr_review_written", pass: 1, findings: 1 } };
}

// conversation is the conversation of the review holding the entries given.
function conversation(...entries: ReturnType<typeof makeEntry>[]): Record<string, TranscriptState> {
  return { "review-1|review": { status: "ready", error: "", entries, pending: [], buffered: [] } };
}

const PUBLISHED = {
  status: "published",
  passes: [
    makeReviewPass({
      published: true,
      verdict: "request_changes",
      publishedAt: "2026-09-24T13:41:00Z",
      publishedUrl: "https://github.com/dev/web/pull/31#pullrequestreview-1",
      findings: [makeReviewFinding({ decision: "approved", placement: "inline" })],
    }),
  ],
};

const click =
  (role: Parameters<typeof screen.getByRole>[0], name: string | RegExp) =>
  async (user: UserEvent) => {
    await user.click(await screen.findByRole(role, { name }));
  };

// then runs the steps in their order.
const then =
  (...steps: ((user: UserEvent) => Promise<void>)[]) =>
  async (user: UserEvent) => {
    for (const step of steps) {
      await step(user);
    }
  };

const moreActions = click("button", "More actions");
const filterMenu = click("button", "Filter");
const openPanel = click("treeitem", /^web#31 /);
const openDetails = click("button", "Details");
const openReports = click("button", "Reports");
const openPublish = click("button", "Publish review…");

/** Place is where a control is now. */
type Place =
  | "header"
  | "strip"
  | "bar"
  | "menu"
  | "panel"
  | "dialog"
  | "card"
  | "row"
  | "section"
  | "marker"
  | "details"
  | "reports";

/** Row is a control of the components that left, in a state it appeared in, and where it is now. */
interface Row {
  origin:
    | "ReviewsHeader"
    | "ReadFailures"
    | "ReviewsFilterBar"
    | "PullRequestRow"
    | "StartReviewDialog"
    | "ReviewHeader"
    | "ReviewBar"
    | "FindingsPanel"
    | "FindingCard"
    | "PublishDialog"
    | "ReviewAgainDialog"
    | "ReportsPanel"
    | "ReviewStrip";
  control: string;
  state: string;
  /** draw renders the screen that holds the new place, in the state of the row. */
  draw: () => RenderWithStoreResult;
  /** steps is what the user does before the new place shows. */
  steps?: (user: UserEvent) => Promise<void>;
  where: Place;
  /** holder names what holds the control in a card or a marker. */
  holder?: RegExp;
  role?: Parameters<typeof screen.getByRole>[0];
  /** name is the accessible name in the new place. */
  name?: RegExp;
  /** text is what the new place says, for a control that became words. */
  text?: RegExp;
  disabled?: boolean;
  /** description is the accessible description of the control: the reason under it. */
  description?: string;
  /** check proves the rest of the new place: what the control there holds. */
  check?: (place: HTMLElement) => void;
}

// placeOf is the element of the new place, once the steps are done.
async function placeOf(where: Place, holder: RegExp | undefined): Promise<HTMLElement> {
  switch (where) {
    case "header":
      return screen.getByRole("banner");
    case "strip":
      return screen.getByRole("alert");
    case "bar":
      return (
        screen.queryByRole("search", { name: "Filter the pull requests" }) ??
        screen.getByRole("region", { name: "Request" })
      );
    case "menu":
      return screen.findByRole("menu");
    case "panel":
      return screen.getByRole("complementary", { name: /^Pull request / });
    case "dialog":
      return screen.findByRole("dialog");
    case "card":
      return holder === undefined
        ? screen.findByRole("group", { name: /^Findings of pass / })
        : screen.findByRole("article", { name: holder });
    case "row":
    case "section":
      return screen.getByRole("tree");
    case "marker":
      return screen.findByRole("article", { name: holder ?? /^$/ });
    case "details":
      return screen.getByRole("complementary", { name: "Details" });
    case "reports":
      return screen.getByRole("complementary", { name: "Reports" });
  }
}

const ROWS: Row[] = [
  // The header of Reviews.
  {
    origin: "ReviewsHeader",
    control: "the age of the reading",
    state: "read",
    draw: list(),
    where: "header",
    text: /Read 2m ago/,
  },
  {
    origin: "ReviewsHeader",
    control: "the indicator of the reading",
    state: "a reading running",
    draw: list({}, { reading: true }),
    where: "header",
    role: "status",
    text: /Reading…/,
  },
  {
    origin: "ReviewsHeader",
    control: "Refresh",
    state: "read",
    draw: list(),
    where: "header",
    name: /^Refresh$/,
  },
  {
    origin: "ReviewsHeader",
    control: "Refresh",
    state: "a reading running",
    draw: list({}, { reading: true }),
    where: "header",
    name: /^Refresh$/,
    disabled: true,
  },

  // The failures.
  {
    origin: "ReadFailures",
    control: "the line of a repository",
    state: "a repository that couldn't be read",
    draw: list(
      {},
      {
        failures: [
          makePullsFailure({
            repositoryId: "repo-2",
            repository: "dev/api",
            message: "gh is not authenticated.",
          }),
        ],
      },
    ),
    where: "strip",
    text: /Couldn't read dev\/api.*gh is not authenticated\./,
    name: /^Try again$/,
  },

  // The bar of filters.
  {
    origin: "ReviewsFilterBar",
    control: "Board",
    state: "no filter",
    draw: list(),
    steps: filterMenu,
    where: "menu",
    role: "menuitemcheckbox",
    name: /^Roadmap$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Board",
    state: "a board chosen",
    draw: list({}, { filters: makeReviewFilters({ boardId: "board-1", boardName: "Roadmap" }) }),
    where: "bar",
    name: /^Remove the filter Board: Roadmap$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Repository",
    state: "no filter",
    draw: list(),
    steps: filterMenu,
    where: "menu",
    role: "menuitemcheckbox",
    name: /^dev\/web$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Repository",
    state: "a repository chosen",
    draw: list(
      {},
      { filters: makeReviewFilters({ repositoryId: "repo-1", repositoryName: "dev/web" }) },
    ),
    where: "bar",
    name: /^Remove the filter dev\/web$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Author",
    state: "no filter",
    draw: list(),
    steps: filterMenu,
    where: "menu",
    role: "menuitem",
    name: /^alice: no filter\. Click to cycle\.$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Author",
    state: "an author hidden",
    draw: list({}, { filters: makeReviewFilters({ authorsExclude: ["dependabot"] }) }),
    where: "bar",
    name: /^Remove the filter Author −dependabot$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Label",
    state: "no filter",
    draw: list(),
    steps: filterMenu,
    where: "menu",
    role: "menuitem",
    name: /^bug: no filter\. Click to cycle\.$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Label",
    state: "a label kept",
    draw: list({}, { filters: makeReviewFilters({ labelsInclude: ["bug"] }) }),
    where: "bar",
    name: /^Remove the filter Label \+bug$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Clear filters",
    state: "a filter chosen",
    draw: list({}, { filters: makeReviewFilters({ authorsExclude: ["dependabot"] }) }),
    where: "bar",
    name: /^Clear filters$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Pending only",
    state: "a pending pull request",
    draw: list(),
    where: "section",
    role: "treeitem",
    name: /^Pending, 1 pull request$/,
  },
  {
    origin: "ReviewsFilterBar",
    control: "Pending only",
    state: "a pull request reviewed",
    draw: list({ pending: false, reviewed: true }),
    where: "section",
    role: "treeitem",
    name: /^Reviewed, 1 pull request$/,
  },

  // The row.
  {
    origin: "PullRequestRow",
    control: "the Pending dot",
    state: "pending",
    draw: list(),
    where: "section",
    role: "treeitem",
    name: /^Pending, 1 pull request$/,
  },
  {
    origin: "PullRequestRow",
    control: "the number and the title",
    state: "open",
    draw: list(),
    where: "row",
    role: "treeitem",
    name: /^web#31 Add the login screen\. /,
  },
  {
    origin: "PullRequestRow",
    control: "Draft",
    state: "a draft",
    draw: list({ draft: true }),
    where: "row",
    role: "treeitem",
    name: /\. draft\. /,
  },
  {
    origin: "PullRequestRow",
    control: "the author",
    state: "open",
    draw: list(),
    where: "row",
    role: "treeitem",
    name: /\. by alice\. /,
  },
  {
    origin: "PullRequestRow",
    control: "Task",
    state: "the pull request of a task",
    draw: list({ taskId: "task-1", action: "open_task", pending: false }),
    where: "row",
    role: "treeitem",
    name: /\. the pull request of the task login-task$/,
  },
  {
    origin: "PullRequestRow",
    control: "the state of the review",
    state: "with a review",
    draw: list({ reviewId: "review-1", action: "open_review" }),
    where: "row",
    role: "treeitem",
    name: /\. review: /,
  },
  {
    origin: "PullRequestRow",
    control: "New commits",
    state: "commits after your review",
    draw: list({ reviewed: true, newCommits: true }),
    where: "row",
    role: "treeitem",
    name: /\. pending: new commits after your review$/,
  },
  {
    origin: "PullRequestRow",
    control: "Reviewed",
    state: "reviewed",
    draw: list({ pending: false, reviewed: true }),
    where: "row",
    role: "treeitem",
    name: /\. reviewed$/,
  },
  {
    origin: "PullRequestRow",
    control: "the repository",
    state: "open",
    draw: list(),
    where: "row",
    role: "treeitem",
    name: /^web#31 /,
  },
  {
    origin: "PullRequestRow",
    control: "the repository",
    state: "open",
    draw: list(),
    steps: openPanel,
    where: "panel",
    text: /dev\/web/,
  },
  {
    origin: "PullRequestRow",
    control: "the labels",
    state: "labelled",
    draw: list({ labels: [{ name: "bug", color: "d73a4a" }] }),
    where: "row",
    role: "treeitem",
    name: /\. label bug\. /,
  },
  {
    origin: "PullRequestRow",
    control: "the labels",
    state: "labelled",
    draw: list({ labels: [{ name: "bug", color: "d73a4a" }] }),
    steps: openPanel,
    where: "panel",
    text: /Labels\s*bug/,
  },
  {
    origin: "PullRequestRow",
    control: "the card",
    state: "with a card",
    draw: list({ card: CARD }),
    steps: openPanel,
    where: "panel",
    role: "link",
    name: /^#452$/,
  },
  {
    origin: "PullRequestRow",
    control: "Open on GitHub",
    state: "open",
    draw: list(),
    steps: openPanel,
    where: "panel",
    name: /^Open web#31 on GitHub$/,
  },
  {
    origin: "PullRequestRow",
    control: "the action, Review",
    state: "to review",
    draw: list(),
    steps: openPanel,
    where: "panel",
    name: /^Start review/,
  },
  {
    origin: "PullRequestRow",
    control: "the action, Review",
    state: "a repository without a clone",
    draw: list({ action: "clone" }, {}, { cloned: false, path: "" }),
    steps: openPanel,
    where: "panel",
    name: /^Clone and continue/,
  },
  {
    origin: "PullRequestRow",
    control: "the action, Open review",
    state: "with a review",
    draw: list({ reviewId: "review-1", action: "open_review" }),
    steps: openPanel,
    where: "panel",
    name: /^Open review$/,
  },
  {
    origin: "PullRequestRow",
    control: "the action, Open task",
    state: "the pull request of a task",
    draw: list({ taskId: "task-1", action: "open_task", pending: false }),
    steps: openPanel,
    where: "panel",
    name: /^Open task$/,
  },
  {
    origin: "PullRequestRow",
    control: "the action, with the reason",
    state: "from a fork",
    draw: list({ action: "fork" }),
    steps: openPanel,
    where: "panel",
    name: /^Start review/,
    disabled: true,
    description: "Pull requests from forks can't be reviewed yet.",
  },
  {
    origin: "PullRequestRow",
    control: "the action, with the reason",
    state: "the clone missing",
    draw: list({ action: "clone_missing" }, {}, { missing: true }),
    steps: openPanel,
    where: "panel",
    name: /^Start review/,
    disabled: true,
    description: "The clone at /home/dev/projects/web is missing.",
  },
  {
    origin: "PullRequestRow",
    control: "the action, with the reason",
    state: "the clone missing",
    draw: list({ action: "clone_missing" }, {}, { missing: true }),
    steps: openPanel,
    where: "panel",
    name: /^Change path…$/,
    text: /The clone at \/home\/dev\/projects\/web is missing\./,
  },

  // The dialog that starts a review.
  {
    origin: "StartReviewDialog",
    control: "the summary",
    state: "a pull request to review",
    draw: start(),
    where: "dialog",
    text: /web#31.*Add the login screen.*alice · login-screen → dev/,
  },
  {
    origin: "StartReviewDialog",
    control: "Instructions",
    state: "a pull request to review",
    draw: start(),
    steps: click("button", "Add instructions"),
    where: "dialog",
    role: "textbox",
    name: /^Instructions/,
  },
  {
    origin: "StartReviewDialog",
    control: "the model",
    state: "a pull request to review",
    draw: start(),
    where: "dialog",
    name: /^Review model:/,
  },
  {
    origin: "StartReviewDialog",
    control: "the mode",
    state: "your own pull request",
    draw: start({ own: true }),
    steps: click("button", /^Mode · Publish/),
    where: "dialog",
    role: "radio",
    name: /^Apply$/,
  },
  {
    origin: "StartReviewDialog",
    control: "Clone and continue",
    state: "a repository without a clone",
    draw: list({ action: "clone" }, {}, { cloned: false, path: "" }),
    steps: openPanel,
    where: "panel",
    name: /^Clone and continue/,
  },
  {
    origin: "StartReviewDialog",
    control: "the clone",
    state: "the clone running",
    draw: list({ action: "clone" }, {}, { cloned: false, cloning: true, path: "" }),
    steps: openPanel,
    where: "panel",
    name: /^Cloning dev\/web…$/,
  },
  {
    origin: "StartReviewDialog",
    control: "the clone",
    state: "the clone failed",
    draw: list({ action: "clone" }, {}, { cloned: false, path: "", cloneError: "gh: not found" }),
    steps: openPanel,
    where: "panel",
    name: /^Try the clone again/,
  },

  // The header of the review.
  {
    origin: "ReviewHeader",
    control: "the mode",
    state: "publish",
    draw: review(),
    steps: openDetails,
    where: "details",
    text: /Publish · fixed/,
  },
  {
    origin: "ReviewHeader",
    control: "the mode",
    state: "apply",
    draw: review({ mode: "apply" }),
    steps: openDetails,
    where: "details",
    text: /Apply · fixed/,
  },
  {
    origin: "ReviewHeader",
    control: "the state",
    state: "ready to publish",
    draw: review(PUBLISH),
    where: "header",
    role: "list",
    name: /^Progress · Pass 1 · waiting for you: ready to publish$/,
  },
  {
    origin: "ReviewHeader",
    control: "the state",
    state: "ready to publish",
    draw: review(PUBLISH),
    where: "bar",
    text: /Ready to publish/,
  },
  {
    origin: "ReviewHeader",
    control: "the meter",
    state: "with a session",
    draw: review({ contextPercent: 44 }),
    where: "header",
    role: "meter",
    name: /^Context$/,
  },
  {
    origin: "ReviewHeader",
    control: "Pause",
    state: "the reviewer working",
    draw: review({ sessionStatus: "working", turnRunning: true }),
    where: "header",
    name: /^Pause$/,
  },
  {
    origin: "ReviewHeader",
    control: "Pause",
    state: "the session stopped on an error",
    draw: review({ sessionStatus: "error", lastError: "claude exited" }),
    where: "header",
    name: /^Pause$/,
    disabled: true,
  },
  {
    origin: "ReviewHeader",
    control: "Resume",
    state: "the session paused",
    draw: review({ sessionStatus: "paused", pausedAt: minutesAgo(3) }),
    where: "header",
    name: /^Resume$/,
  },
  {
    origin: "ReviewHeader",
    control: "the card",
    state: "with a card",
    draw: review({ card: CARD }),
    steps: openDetails,
    where: "details",
    role: "link",
    name: /^#452$/,
  },
  {
    origin: "ReviewHeader",
    control: "Reports",
    state: "a pass recorded",
    draw: review(),
    where: "header",
    name: /^Reports$/,
  },
  {
    origin: "ReviewHeader",
    control: "Reports",
    state: "a pass recorded",
    draw: review(),
    steps: openReports,
    where: "reports",
    name: /^Review 1 · changes$/,
  },
  {
    origin: "ReviewHeader",
    control: "Delete review",
    state: "a pass recorded",
    draw: review(),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Delete review…$/,
  },

  // The bar of the review.
  {
    origin: "ReviewBar",
    control: "the link of the pull request",
    state: "a pass recorded",
    draw: review(),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Open PR$/,
  },
  {
    origin: "ReviewBar",
    control: "the link of the pull request",
    state: "a pass recorded",
    draw: review(),
    steps: openDetails,
    where: "details",
    role: "link",
    name: /^dev\/web#31$/,
  },
  {
    origin: "ReviewBar",
    control: "the state",
    state: "findings to decide",
    draw: review(DECIDING),
    where: "header",
    role: "list",
    name: /^Progress · Pass 1 · waiting for you: decide findings$/,
  },
  {
    origin: "ReviewBar",
    control: "the state",
    state: "findings to decide",
    draw: review(DECIDING),
    where: "bar",
    text: /Decide findings/,
  },
  {
    origin: "ReviewBar",
    control: "stalePass",
    state: "findings to decide",
    draw: review({ ...DECIDING, stalePass: true, staleCommits: 2 }),
    where: "bar",
    text: /2 commits arrived after this pass/,
  },
  {
    origin: "ReviewBar",
    control: "stalePass",
    state: "ready to publish",
    draw: review({ ...PUBLISH, stalePass: true, staleCommits: 2 }),
    where: "bar",
    text: /2 commits arrived after this pass/,
  },
  {
    origin: "ReviewBar",
    control: "stalePass",
    state: "ready to publish",
    draw: review({ ...PUBLISH, stalePass: true, staleCommits: 2 }),
    steps: openPublish,
    where: "dialog",
    text: /2 commits arrived after this pass\./,
  },
  {
    origin: "ReviewBar",
    control: "checkError",
    state: "the reading of GitHub failing",
    draw: review({ checkError: "GitHub's rate limit was reached.", checkErrorAt: minutesAgo(3) }),
    where: "strip",
    text: /Couldn't check GitHub · 3m ago.*GitHub's rate limit was reached\./,
    name: /^Try again$/,
  },
  {
    origin: "ReviewBar",
    control: "publishError",
    state: "the publication failed",
    draw: review({
      status: "publish_failed",
      canPublish: true,
      publishError: "Couldn't publish to GitHub: 422",
      passes: [DECIDED],
      situations: [situation("publish_failed", "", "error")],
    }),
    where: "bar",
    text: /Publish failed.*Couldn't publish to GitHub: 422/,
    name: /^Publish review…$/,
  },
  {
    origin: "ReviewBar",
    control: "passBlocked",
    state: "a pass blocked",
    draw: review(BLOCKED),
    where: "bar",
    text: /Pass blocked.*The worktree couldn't be updated\./,
    name: /^Review again…$/,
  },
  {
    origin: "ReviewBar",
    control: "unreadableReport",
    state: "a report that can't be read",
    draw: review({
      status: "awaiting_reply",
      passes: [makeReviewPass({ recorded: false, findings: [] })],
      unreadableReport: "The report has no findings section.",
      situations: [situation("reply")],
    }),
    where: "bar",
    text: /Waiting for the report.*The report has no findings section\./,
  },
  {
    origin: "ReviewBar",
    control: "commitFailed",
    state: "an approval without a commit",
    draw: review({ ...APPROVE, commitFailed: true }),
    where: "bar",
    text: /Approve changes.*the last approval didn't produce a commit/,
  },
  {
    origin: "ReviewBar",
    control: "Publish review",
    state: "findings to decide",
    draw: review(DECIDING),
    where: "bar",
    name: /^Publish review…$/,
    disabled: true,
  },
  {
    origin: "ReviewBar",
    control: "Publish review",
    state: "ready to publish",
    draw: review(PUBLISH),
    where: "bar",
    name: /^Publish review…$/,
  },
  {
    origin: "ReviewBar",
    control: "Apply",
    state: "findings to decide in apply mode",
    draw: review({ ...DECIDING, mode: "apply" }),
    where: "bar",
    name: /^Apply approved$/,
    disabled: true,
  },
  {
    origin: "ReviewBar",
    control: "Apply",
    state: "ready to apply",
    draw: review(APPLY),
    where: "bar",
    name: /^Apply approved$/,
  },
  {
    origin: "ReviewBar",
    control: "Approve",
    state: "changes to review, files left to stage",
    draw: review(CHANGES),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "ReviewBar",
    control: "Approve",
    state: "changes ready to approve",
    draw: review(APPROVE),
    where: "bar",
    name: /^Approve$/,
  },
  {
    origin: "ReviewBar",
    control: "Review again",
    state: "new commits",
    draw: review(NEW_COMMITS),
    where: "bar",
    name: /^Review again…$/,
  },
  {
    origin: "ReviewBar",
    control: "Review again",
    state: "in trouble",
    draw: review(TROUBLE),
    where: "bar",
    name: /^Review again…$/,
  },
  {
    origin: "ReviewBar",
    control: "Review again",
    state: "a pass published",
    draw: review(PUBLISHED),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Review again…$/,
  },
  {
    origin: "ReviewBar",
    control: "Review again",
    state: "a pass waiting for the checks",
    draw: review({ status: "waiting_checks", canReviewAgain: false }),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Review again…/,
    disabled: true,
  },
  {
    origin: "ReviewBar",
    control: "Open in VS Code",
    state: "changes to review",
    draw: review(CHANGES),
    where: "bar",
    name: /^Open in VS Code$/,
  },
  {
    origin: "ReviewBar",
    control: "Open in VS Code",
    state: "a pass recorded",
    draw: review(),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Open in VS Code/,
  },
  {
    origin: "ReviewBar",
    control: "Open in VS Code",
    state: "before the worktree exists",
    draw: review({ worktreePath: "" }),
    steps: moreActions,
    where: "menu",
    role: "menuitem",
    name: /^Open in VS Code/,
    disabled: true,
  },

  // The panel of findings.
  {
    origin: "FindingsPanel",
    control: "the label of the report",
    state: "a pass recorded",
    draw: review(DECIDING, { transcripts: conversation(reportMarker()) }),
    where: "marker",
    holder: /^Review 1 written/,
  },
  {
    origin: "FindingsPanel",
    control: "N of M decided",
    state: "findings to decide",
    draw: review(DECIDING),
    where: "bar",
    text: /1 of 3 decided/,
  },
  {
    origin: "FindingsPanel",
    control: "the summary",
    state: "ready to publish",
    draw: review(PUBLISH),
    steps: openPublish,
    where: "dialog",
    name: /^Edit$/,
  },
  {
    origin: "FindingsPanel",
    control: "Nothing to change.",
    state: "a clean pass",
    draw: review({ ...PUBLISH, passes: [makeReviewPass({ clean: true, findings: [] })] }),
    where: "bar",
    text: /A clean pass/,
  },

  // The card of a finding.
  {
    origin: "FindingCard",
    control: "the location that opens the editor",
    state: "a finding to decide",
    draw: review(DECIDING),
    where: "card",
    name: /^Open line 12 of login\.ts in VS Code$/,
  },
  {
    origin: "FindingCard",
    control: "the text",
    state: "a finding to decide",
    draw: review(DECIDING),
    where: "card",
    name: /^Edit$/,
  },
  {
    origin: "FindingCard",
    control: "Approve",
    state: "a finding to decide",
    draw: review(DECIDING),
    where: "card",
    name: /^Approve$/,
  },
  {
    origin: "FindingCard",
    control: "Discard",
    state: "a finding to decide",
    draw: review(DECIDING),
    where: "card",
    name: /^Discard$/,
  },
  {
    origin: "FindingCard",
    control: "where it was published",
    state: "a pass published",
    draw: review(PUBLISHED, { transcripts: conversation(reportMarker()) }),
    steps: click("button", /^You decided/),
    where: "marker",
    holder: /^You decided/,
    text: /Inline comment · published/,
    // The finding there is disabled: it says where it went, and offers no decision and no edit.
    check: (place) => {
      const finding = within(place).getByRole("group", { name: /^Finding 1 of 1/ });
      expect(finding).toHaveAttribute("data-disabled");
      for (const control of [/^Approve/, /^Discard/, /^Edit/]) {
        expect(within(finding).queryByRole("button", { name: control })).not.toBeInTheDocument();
      }
    },
  },

  // The publication.
  {
    origin: "PublishDialog",
    control: "the verdict",
    state: "ready to publish",
    draw: review(PUBLISH),
    steps: openPublish,
    where: "dialog",
    role: "radio",
    name: /Request changes/,
  },
  {
    origin: "PublishDialog",
    control: "the count",
    state: "ready to publish",
    draw: review(PUBLISH),
    steps: openPublish,
    where: "dialog",
    text: /1 inline comment/,
  },
  {
    origin: "PublishDialog",
    control: "the warning of commits, with Review again instead",
    state: "commits after the pass",
    draw: review({ ...PUBLISH, stalePass: true, staleCommits: 2 }),
    steps: openPublish,
    where: "dialog",
    name: /^Review again instead$/,
  },

  // Review again.
  {
    origin: "ReviewAgainDialog",
    control: "the instructions",
    state: "new commits",
    draw: review(NEW_COMMITS),
    steps: then(click("button", "Review again…"), click("button", "Add instructions")),
    where: "dialog",
    role: "textbox",
    name: /Instructions/,
  },
  {
    origin: "ReviewAgainDialog",
    control: "the warning of the discard",
    state: "decisions never published",
    draw: review({ ...DECIDING }),
    steps: then(moreActions, click("menuitem", "Review again…")),
    where: "dialog",
    text: /The decisions and edits of review 1 will be discarded\./,
  },

  // The panel Reports.
  {
    origin: "ReportsPanel",
    control: "Context",
    state: "a pass recorded",
    draw: review(),
    steps: openReports,
    where: "reports",
    name: /^Context$/,
  },
  {
    origin: "ReportsPanel",
    control: "the reports",
    state: "a pass published",
    draw: review(PUBLISHED),
    steps: openReports,
    where: "reports",
    name: /^Review 1 · changes · published$/,
  },
  {
    origin: "ReportsPanel",
    control: "the verdict published, with its link",
    state: "a pass published",
    draw: review(PUBLISHED),
    steps: then(openReports, click("button", /^Review 1 · changes · published$/)),
    where: "reports",
    text: /Published · Request changes/,
    name: /^Open on GitHub$/,
  },

  // The strip of the apply mode.
  {
    origin: "ReviewStrip",
    control: "a file",
    state: "changes to review",
    draw: review(CHANGES),
    where: "card",
    holder: /^Changed files/,
    name: /src\/api\/login\.ts/,
  },
  {
    origin: "ReviewStrip",
    control: "a file",
    state: "changes ready to approve",
    draw: review(APPROVE),
    where: "card",
    holder: /^Changed files/,
    name: /src\/LoginForm\.tsx/,
  },
  {
    origin: "ReviewStrip",
    control: "a file",
    state: "committing",
    draw: review({ mode: "apply", status: "committing", review: makeReview() }),
    where: "card",
    holder: /^Changed files/,
    name: /src\/LoginForm\.tsx/,
  },
];

beforeEach(() => {
  // Every section of Reviews expanded, so each row is on screen.
  localStorage.setItem(REVIEWS_SECTIONS_KEY, JSON.stringify({ collapsed: [] }));
});

afterEach(() => {
  localStorage.clear();
});

describe("where the controls of the components that left went", () => {
  it.each(ROWS)(
    "$origin: $control, $state, is in the $where",
    async ({ draw, steps, where, holder, role, name, text, disabled, description, check }) => {
      const { user } = draw();
      await steps?.(user);
      const place = await placeOf(where, holder);

      if (text !== undefined) {
        await waitFor(() => expect(place).toHaveTextContent(text));
      }
      check?.(place);
      if (name === undefined) {
        return;
      }
      const [found] = await within(place).findAllByRole(role ?? "button", { name });
      expect(found).toBeDefined();
      if (disabled) {
        expect(found).toHaveAttribute("aria-disabled", "true");
      } else {
        expect(found).not.toHaveAttribute("aria-disabled", "true");
      }
      if (description !== undefined) {
        expect(found).toHaveAccessibleDescription(description);
      }
    },
  );

  it("puts Open on GitHub of the row at O", async () => {
    const { user } = list()();
    screen.getByRole("treeitem", { name: /^web#31 / }).focus();

    await user.keyboard("o");

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("puts the action of the row at R", async () => {
    const { user } = list()();
    screen.getByRole("treeitem", { name: /^web#31 / }).focus();

    await user.keyboard("r");

    expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 31 });
  });

  it("puts the reason of the action of a row from a fork at R, in the notice of the key", async () => {
    const { user } = list({ action: "fork" })();
    screen.getByRole("treeitem", { name: /^web#31 / }).focus();

    await user.keyboard("r");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "No review of web#31 · Pull requests from forks can't be reviewed yet.",
    );
    expect(useAppStore.getState().startReview).toBeNull();
  });
});

// ── The primaries ──────────────────────────────────────────────────────────────────────────────

// WRITTEN is a message written in the composer of the review, so Send could be a primary too.
const WRITTEN = { "review-1|review": "go on" };

// The situations of the bar and the paused one: the screen draws one primary at most.
const SITUATIONS: [string, Partial<ReviewSummary>, Record<string, TranscriptState>?][] = [
  [
    "question",
    { status: "reviewing", situations: [situation("question")] },
    conversation(makeEntry("question")),
  ],
  [
    "permission",
    { status: "reviewing", situations: [situation("permission")] },
    conversation(makeEntry("permission")),
  ],
  [
    "session_error, the session stopped",
    {
      status: "reviewing",
      sessionStatus: "error",
      lastError: "claude exited",
      situations: [situation("session_error", "", "error")],
    },
  ],
  [
    "session_error, a turn that failed",
    {
      status: "reviewing",
      turnFailed: true,
      situations: [situation("session_error", "", "error")],
    },
  ],
  [
    "awaiting_reply",
    {
      status: "awaiting_reply",
      unreadableReport: "The report has no findings section.",
      situations: [situation("reply")],
    },
  ],
  ["awaiting_decision", DECIDING],
  ["awaiting_decision, apply", { ...DECIDING, mode: "apply" }],
  ["ready_to_publish", PUBLISH],
  [
    "publish_failed",
    {
      status: "publish_failed",
      canPublish: true,
      publishError: "Couldn't publish to GitHub: 422",
      passes: [DECIDED],
      situations: [situation("publish_failed", "", "error")],
    },
  ],
  ["ready_to_apply", APPLY],
  ["in_review", CHANGES],
  ["ready_to_approve", APPROVE],
  [
    "ready_to_merge",
    {
      mode: "apply",
      status: "ready_to_merge",
      passes: [makeReviewPass({ clean: true, findings: [] })],
      situations: [situation("merge", "merge", "closing")],
    },
  ],
  ["new_commits", NEW_COMMITS],
  ["pr_trouble", TROUBLE],
  ["pass_blocked", BLOCKED],
  ["paused, ready to publish", { ...PUBLISH, sessionStatus: "paused", pausedAt: minutesAgo(3) }],
];

describe("the primary of the review screen", () => {
  it.each(SITUATIONS)("is one at most in %s", async (_kind, overrides, transcripts) => {
    const { container } = review(overrides, {
      drafts: WRITTEN,
      ...(transcripts === undefined ? {} : { transcripts }),
    })();

    if (transcripts !== undefined) {
      await waitFor(() => expect(container.querySelector("[data-pending-card]")).not.toBeNull());
    }
    expect(screen.getByRole("region", { name: "Request" })).toBeInTheDocument();
    expect(container.querySelectorAll("button[data-variant=primary]").length).toBeLessThanOrEqual(
      1,
    );
  });
});

/** Case is a case of the panel of a pull request, as a row and a state that bring it. */
interface Case {
  name: string;
  row: Partial<PullRequestRow>;
  repository?: Partial<Repository>;
  app?: Partial<State>;
  /** primary is the one primary the case has, null for none. */
  primary: RegExp | null;
}

// WAITING is the review of web#31 waiting for the user to decide its findings.
const WAITING = atRest({ ...DECIDING, id: "review-1" });

const CASES: Case[] = [
  { name: "start", row: {}, primary: /^Start review/ },
  { name: "start, your own pull request", row: { own: true }, primary: /^Start review/ },
  {
    name: "review, waiting for you",
    row: { reviewId: "review-1", action: "open_review" },
    app: { reviews: [WAITING] },
    primary: /^Open review$/,
  },
  {
    name: "review, working",
    row: { reviewId: "review-1", action: "open_review" },
    primary: null,
  },
  {
    name: "task, waiting for you",
    row: { taskId: "task-1", action: "open_task", pending: false },
    app: {
      tasks: [
        makeTask({
          id: "task-1",
          name: "login-task",
          situations: [makeSituation({ taskId: "task-1" })],
        }),
      ],
    },
    primary: /^Open task$/,
  },
  {
    name: "task, working",
    row: { taskId: "task-1", action: "open_task", pending: false },
    primary: null,
  },
  { name: "fork", row: { action: "fork" }, primary: /^Start review/ },
  {
    name: "clone-missing",
    row: { action: "clone_missing" },
    repository: { missing: true },
    primary: /^Start review/,
  },
  {
    name: "clone, waiting",
    row: { action: "clone" },
    repository: { cloned: false, path: "" },
    primary: /^Clone and continue/,
  },
  {
    name: "clone, running",
    row: { action: "clone" },
    repository: { cloned: false, cloning: true, path: "" },
    primary: /^Cloning dev\/web…$/,
  },
  {
    name: "clone, failed",
    row: { action: "clone" },
    repository: { cloned: false, path: "", cloneError: "gh: repository not found" },
    primary: /^Try the clone again/,
  },
];

describe("the panel of a pull request", () => {
  it.each(CASES)("has at most one primary when $name", async (item) => {
    const { user, container } = renderWithStore(<ReviewsView />, {
      state: listState(item.row, {}, item.app, item.repository),
    });
    await openPanel(user);

    const panel = screen.getByRole("complementary", { name: /^Pull request / });
    const primaries = [...container.querySelectorAll("button[data-variant=primary]")];
    expect(primaries.length).toBe(item.primary === null ? 0 : 1);
    if (item.primary !== null) {
      expect(within(panel).getByRole("button", { name: item.primary })).toBe(primaries[0]);
    }
  });
});

describe("the dialogs", () => {
  // oneIn says the dialog has one primary, the one named.
  function oneIn(dialog: HTMLElement, name: RegExp) {
    const primaries = dialog.querySelectorAll("button[data-variant=primary]");
    expect(primaries).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name })).toBe(primaries[0]);
  }

  it.each<[string, Partial<PullRequestRow>]>([
    ["a pull request to review", {}],
    ["your own pull request", { own: true }],
  ])("has Start review as the one primary of the start dialog, for %s", async (_name, row) => {
    start(row)();

    oneIn(await screen.findByRole("dialog", { name: "Review web#31" }), /^Start review/);
  });

  it("keeps the dashed Start review the one primary for a pull request that left the reading", async () => {
    renderWithStore(<StartReviewDialog />, {
      state: listState(),
      ui: { startReview: { repositoryId: "repo-1", number: 99 } },
    });

    const dialog = await screen.findByRole("dialog");
    oneIn(dialog, /^Start review/);
    expect(within(dialog).getByRole("button", { name: /^Start review/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("has Publish as the one primary of the publication, over the bar", async () => {
    const { user } = review(PUBLISH)();
    await openPublish(user);

    oneIn(await screen.findByRole("dialog", { name: "Publish the review of web#31" }), /^Publish/);
  });

  it("has Review again as the one primary of Review again…, over the bar", async () => {
    const { user } = review(NEW_COMMITS)();
    await user.click(screen.getByRole("button", { name: "Review again…" }));

    oneIn(await screen.findByRole("dialog", { name: "Review web#31 again" }), /^Review again/);
  });

  it("has no primary in the deletion, whose action is dangerous", async () => {
    const { user } = review()();
    await moreActions(user);
    await user.click(await screen.findByRole("menuitem", { name: "Delete review…" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.querySelectorAll("button[data-variant=primary]")).toHaveLength(0);
  });
});
