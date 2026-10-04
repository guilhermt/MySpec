/**
 * The scenes of the History and of the archived items (design/tasks/11-history-dialogs.md §1, pronto
 * 1): the list of 44 archived items in 12 days, and the archived task, review and discussion the mock
 * opens. The data is the one of the mock (design/lab/14-screen-rest/src/data.js:103–151 and
 * src/history.js:53–98) without its contradictions (§4.3 #27): the pull request of the typo in the
 * password reset email is #2275, not the #2279 that is the card of the flaky login. The scene tests
 * draw HistoryView and the archived screens from them.
 */

import { act, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { HOME as HOME_PLACE, type Location } from "@/lib/locations";
import type {
  ArchivedDiscussion,
  ArchivedReview,
  ArchivedStep,
  ArchivedTask,
  Board,
  CloseResult,
  Draft,
  Repository,
  ReviewFinding,
  ReviewPass,
  State,
  StepReport,
} from "@/lib/wails";
import { api } from "@/lib/wails";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeDraft,
  makeEntry,
  makeHistoryPage,
  makeHistorySummary,
  makeRepository,
  makeReviewFinding,
  makeReviewPass,
  makeState,
  makeTaskCard,
  makeTranscript,
} from "@/test/wails-mock";

/** HISTORY_SCENES are the four places of the mock this file draws. */
export const HISTORY_SCENES = [
  "history",
  "archived-task",
  "archived-review",
  "archived-discussion",
] as const;

/** HistorySceneName is one place of the mock. */
export type HistorySceneName = (typeof HISTORY_SCENES)[number];

/**
 * HISTORY_VARIANTS are the `?v=` of each scene, "" the plain one: the ones of the mock, then the ones
 * only the material decides (history older-loading, older-failed and filtered-empty; archived-review
 * apply and delete; archived-discussion delete).
 */
export const HISTORY_VARIANTS: Record<HistorySceneName, readonly string[]> = {
  history: [
    "",
    "fresh",
    "filtered",
    "no-match",
    "empty",
    "older-loading",
    "older-failed",
    "filtered-empty",
  ],
  "archived-task": ["", "steps", "pr", "oneshot", "delete"],
  "archived-review": ["", "apply", "delete"],
  "archived-discussion": ["", "delete"],
};

/** HistoryScene is what a test draws: the state, the place, what the screen remembers and what the user did. */
export interface HistoryScene {
  state: State;
  location: Location;
  /** back is the place behind the scene, where ← goes: Home behind History, History behind an item. */
  back: Location[];
  /** storage is what the screen remembers in localStorage, by key. */
  storage: Record<string, string>;
  /** now is the moment of the scene, local time as the mock writes it. */
  now: string;
  /** listing is how the Go answers for the items beyond the window: never, with a failure, or with no item. */
  listing: "pending" | "failed" | "empty";
  /** after drives what the scene has open: the search, a tab, the ⋯ and its dialog, the scroll. */
  after?: (user: UserEvent) => Promise<void>;
}

// DAY is the day of the scenes, as the clock of the page tells it.
const TODAY = 24;
const MONTH = "2026-09";

/** SCENE_NOW is the moment of every scene: Sep 24 at 15:10, local time as the mock writes it. */
const SCENE_NOW = `${MONTH}-${TODAY}T15:10:00`;

// local is a day and an hour of the scenes, "2026-09-24T15:02:00", as the mock writes them.
const local = (day: number, time: string) =>
  `${MONTH}-${String(day).padStart(2, "0")}T${time.length === 5 ? `${time}:00` : time}`;

// at is the instant of an hour of a day of the scenes, as the Go writes it.
const at = (day: number, time: string) => new Date(local(day, time)).toISOString();

/**
 * fixHistorySceneClock stops the clock of the page at the moment of the scene for each test that
 * runs next in the describe it is called in, and gives it back after, with what the screen
 * remembered; only Date is faked, so the timers of the page still run. It also gives the runtime the
 * answers of the scene: the documents, the conversation, the items beyond the window.
 */
export function fixHistorySceneClock(scene: HistoryScene): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(scene.now));
    vi.mocked(api.readArtifact).mockImplementation((_id, name) =>
      Promise.resolve(DOCUMENTS[name] ?? ""),
    );
    vi.mocked(api.readReviewArtifact).mockImplementation((_id, name) =>
      Promise.resolve(DOCUMENTS[name] ?? ""),
    );
    vi.mocked(api.readDiscussionArtifact).mockImplementation((_id, name) =>
      Promise.resolve(name === "discussion.md" ? DISCUSSION_DOCUMENT : ""),
    );
    vi.mocked(api.getTranscript).mockImplementation((taskId, stage) =>
      Promise.resolve(makeTranscript({ taskId, stage, entries: conversation() })),
    );
    vi.mocked(api.listArchived).mockImplementation(() => {
      switch (scene.listing) {
        case "pending":
          return new Promise(() => {});
        case "failed":
          return Promise.reject(new Error("the database is locked"));
        case "empty":
          return Promise.resolve(makeHistoryPage());
      }
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
}

// ---------------- The repositories and the boards ----------------

const OWNER = "acme";
const HOME = "/home/guilherme";

const repositoryId = (name: string) => `repo-${name}`;

const PLATFORM_ID = "board-platform";
const TOOLS_ID = "board-tools";
const MOBILE_ID = "board-mobile";

/** BOARDS are the boards the items came from, with the repositories each one lists. */
const BOARDS: { id: string; title: string; number: number; repositories: string[] }[] = [
  {
    id: PLATFORM_ID,
    title: "Platform Roadmap",
    number: 7,
    repositories: ["api", "gateway", "web"],
  },
  { id: TOOLS_ID, title: "Internal Tools", number: 3, repositories: ["tools", "admin"] },
  { id: MOBILE_ID, title: "Mobile App", number: 5, repositories: ["ios"] },
];

// REPOSITORIES are the repositories the items came from, and docs, which has none: the one the
// empty filter chooses.
const REPOSITORIES = [
  "api",
  "gateway",
  "web",
  "ios",
  "admin",
  "tools",
  "status-page",
  "sdk-js",
  "infra",
  "docs",
];

const boardOf = (name: string) =>
  BOARDS.find((board) => board.repositories.includes(name))?.id ?? "";

// ---------------- The 44 items (data.js:104–150) ----------------

/** Kind is the kind of an item of the list: a task, a One-Shot task, a review, a discussion. */
type Kind = "t" | "o" | "r" | "d";

// [day, time, kind, name, where, result, more]
type Row = [number, string, Kind, string, string, string, string];

const HIST: Row[] = [
  [24, "15:02", "t", "Idempotency keys for payment intents", "api#398", "#1279 merged", "6 steps"],
  [24, "13:20", "r", "Retry the export when S3 throttles", "gateway#88", "Merged", "1 pass"],
  [24, "11:47", "d", "Webhook delivery guarantees", "Platform Roadmap", "4 cards published", ""],
  [24, "10:05", "o", "Fix the flaky login e2e", "web#2279", "#2290 merged", "One-Shot"],
  [23, "18:31", "t", "Scheduled exports to S3", "gateway#84", "#91 merged", "8 steps"],
  [23, "16:20", "r", "Migrate settings page to react-hook-form", "web#2291", "Merged", "2 passes"],
  [
    23,
    "15:12",
    "d",
    "Usage alerts at 80% of the plan",
    "Platform Roadmap",
    "3 cards published",
    "",
  ],
  [23, "11:03", "o", "Bump Go to 1.25 in CI", "api", "#1276 merged", "One-Shot"],
  [23, "09:40", "r", "Dark mode for the admin tables", "admin#77", "Merged", "3 passes"],
  [22, "19:15", "t", "Audit log for key changes", "api#415", "#1271 merged", "5 steps"],
  [22, "17:02", "t", "Offline banner on the task list", "ios#91", "#318 merged", "4 steps"],
  [22, "14:48", "r", "Paginate the invoices endpoint", "api#1266", "Merged", "1 pass"],
  [22, "12:30", "d", "Mobile onboarding without a password", "Mobile App", "5 cards published", ""],
  [22, "10:11", "o", "Remove the legacy pricing page", "web", "#2283 merged", "One-Shot"],
  [21, "16:44", "t", "Workspace invitations by link", "web#2260", "#2281 merged", "7 steps"],
  [21, "11:20", "r", "Cache the plan lookup in the gateway", "gateway#86", "Merged", "2 passes"],
  [20, "18:02", "o", "Typo in the password reset email", "web", "#2275 merged", "One-Shot"],
  [20, "15:37", "t", "Retry-After on 503 from the gateway", "gateway#79", "#83 merged", "4 steps"],
  [20, "10:26", "d", "Status page for partial outages", "Internal Tools", "2 cards published", ""],
  [19, "19:09", "t", "Export the audit log as CSV", "api#463", "#1262 merged", "6 steps"],
  [19, "16:51", "r", "Share sheet crash when offline", "ios#312", "Merged", "2 passes"],
  [19, "14:14", "r", "Sign in with Apple on the web", "web#2240", "Merged", "1 pass"],
  [19, "09:58", "d", "Admin roles for support agents", "Internal Tools", "4 cards published", ""],
  [18, "18:40", "o", "Upgrade React Router to v7", "web", "#2270 merged", "One-Shot"],
  [18, "15:05", "t", "Rotate the signing keys of webhooks", "api#441", "#1255 merged", "5 steps"],
  [18, "12:22", "r", "Stream the build logs", "tools#31", "Merged", "1 pass"],
  [18, "10:00", "d", "Search in the docs site", "Platform Roadmap", "1 card published", ""],
  [17, "17:48", "t", "Plan picker with yearly prices", "web#2244", "#2266 merged", "6 steps"],
  [17, "13:31", "r", "Fix the timezone of scheduled exports", "gateway#81", "Merged", "3 passes"],
  [17, "11:15", "o", "Drop Node 18 from the SDK", "sdk-js", "#44 merged", "One-Shot"],
  [16, "19:22", "t", "Invoice PDF with line items", "web#2236", "#2262 merged", "7 steps"],
  [16, "16:03", "d", "Offline mode on mobile, round 1", "Mobile App", "6 cards published", ""],
  [16, "14:40", "r", "Rate limit headers in the SDK", "sdk-js#41", "Merged", "1 pass"],
  [16, "09:12", "t", "Staging deploy on every merge to dev", "infra#12", "#57 merged", "4 steps"],
  [15, "18:55", "t", "Two-factor with passkeys", "web#2231", "#2258 merged", "9 steps"],
  [15, "15:21", "r", "Tokens page redesign", "web#2250", "Merged", "2 passes"],
  [15, "11:44", "d", "Kill switch for the gateway", "Platform Roadmap", "2 cards published", ""],
  [15, "10:02", "o", "Sentry release tags", "api", "#1239 merged", "One-Shot"],
  [13, "17:10", "t", "Bulk archive in the admin", "admin#70", "#74 merged", "5 steps"],
  [13, "12:36", "r", "Move status checks to GitHub Actions", "status-page#19", "Closed", "1 pass"],
  [13, "10:48", "d", "Docs versioning", "Platform Roadmap", "3 cards published", ""],
  [12, "18:20", "t", "Webhook signing secrets per endpoint", "api#470", "#1231 merged", "6 steps"],
  [12, "15:03", "o", "Health check for the worker", "gateway", "#72 merged", "One-Shot"],
  [12, "11:30", "d", "Public API for usage", "Platform Roadmap", "1 card published", ""],
];

// SKIPPED are the closings that skipped the update of the base (8 of 22 in the real database): the row says it.
const SKIPPED = new Set([
  "Idempotency keys for payment intents",
  "Audit log for key changes",
  "Workspace invitations by link",
  "Export the audit log as CSV",
  "Remove the legacy pricing page",
  "Typo in the password reset email",
  "Two-factor with passkeys",
  "Health check for the worker",
]);

// The boards of the discussions of the list that reached a repository: the filter of the mock keeps
// Usage alerts at 80% of the plan for web.
const DISCUSSION_REPOSITORIES: Record<string, string[]> = {
  "Platform Roadmap": ["api", "gateway"],
  "Internal Tools": ["tools"],
  "Mobile App": ["ios"],
};
const USAGE_ALERTS = "Usage alerts at 80% of the plan";

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// whereOf is the repository and the number of a place of a row: "api#398" is api and 398, "web" is web.
function whereOf(where: string): { name: string; number: number } {
  const [name = "", number] = where.split("#");
  return { name, number: number === undefined ? 0 : Number(number) };
}

const prNumber = (result: string) => Number(result.replace(/^#(\d+) merged$/, "$1"));
const stepCount = (more: string) => (more === "One-Shot" ? 1 : Number(more.split(" ")[0]));
const passCount = (more: string) => Number(more.split(" ")[0]);

// idOf is the id of an item, by its place in the list.
const idOf = (kind: Kind, index: number) => `${kind === "o" ? "t" : kind}-${index + 1}`;

// closeOf is what the closing of a task did: the base is the one part that may be skipped.
function closeOf(name: string, mode: "structured" | "one_shot", row: Row): CloseResult {
  const skipped = SKIPPED.has(name);
  return {
    worktree: { outcome: "done", reason: "", detail: "" },
    branch: { outcome: "done", reason: "", detail: "" },
    base: skipped
      ? { outcome: "skipped", reason: "not_checked_out", detail: "" }
      : { outcome: "done", reason: "", detail: "" },
    worktreePath: `${HOME}/.local/share/myspec/worktrees/${OWNER}/${whereOf(row[4]).name}/${slug(name)}`,
    branchName: slug(name),
    baseBranch: "dev",
    baseCommits: mode === "one_shot" ? 3 : 7,
    closedAt: at(row[0], row[1]),
  };
}

const STEP_TITLES = [
  "Idempotency key column and index",
  "Store the key on payment intent create",
  "Replay the stored response on a repeated key",
  "Expire keys after 24 hours",
  "Return 422 when the body differs",
  "Docs for the Idempotency-Key header",
];
const SHAS = ["a41c9e2", "7b20d15", "c93f0aa", "e18d4b7", "0f6a2c1", "5d77e90"];
// REPORTS are the passes of the agent review of each step of the task opened: clean or with changes.
const REPORTS: boolean[][] = [[true], [false, true], [false, false, true], [true], [true], [true]];

const stepFile = (title: string, number: number) => `${number}-${slug(title)}.md`;

// stepsOf are the steps of an archived task: the six of the task opened, and numbered ones for the rest.
function stepsOf(name: string, count: number, oneShot: boolean): ArchivedStep[] {
  if (oneShot) {
    return [{ number: 1, file: "one-shot.md", title: name, reports: [], commitSha: SHAS[0] ?? "" }];
  }
  return Array.from({ length: count }, (_, index) => {
    const title = STEP_TITLES[index] ?? `Step ${index + 1} of ${name}`;
    const reports: StepReport[] = (REPORTS[index] ?? [true]).map((clean, pass) => ({
      pass: pass + 1,
      file: `step-${index + 1}-review-${pass + 1}.md`,
      clean,
      findings: clean ? 0 : pass + 1,
    }));
    return {
      number: index + 1,
      file: stepFile(title, index + 1),
      title,
      reports,
      commitSha: SHAS[index] ?? "b7d1e40",
    };
  });
}

// MERGE_TO_CLOSE is how long before the closing the pull request was merged: Sep 24 at 14:51 for the
// task closed at 15:02, as the material writes them.
const MERGE_TO_CLOSE = 11 * 60_000;

// mergedBefore is the moment the pull request of a task closed at an instant was merged.
const mergedBefore = (closed: string) =>
  new Date(Date.parse(closed) - MERGE_TO_CLOSE).toISOString();

function taskOf(row: Row, index: number): ArchivedTask {
  const [day, time, kind, name, where, result, more] = row;
  const { name: repository, number } = whereOf(where);
  const oneShot = kind === "o";
  const mode = oneShot ? "one_shot" : "structured";
  const task = makeArchivedTask({
    id: idOf(kind, index),
    name,
    repositoryId: repositoryId(repository),
    repository: `${OWNER}/${repository}`,
    card:
      number === 0
        ? null
        : makeTaskCard({
            boardId: boardOf(repository),
            key: `${OWNER}/${repository}#${number}`,
            repository: `${OWNER}/${repository}`,
            number,
            title: name,
            url: `https://github.com/${OWNER}/${repository}/issues/${number}`,
            status: "Done",
            state: "closed",
          }),
    mode,
    hasPrd: !oneShot,
    hasTechSpec: !oneShot,
    hasOneShot: oneShot,
    steps: stepsOf(name, stepCount(more), oneShot),
    pr: {
      number: prNumber(result),
      url: `https://github.com/${OWNER}/${repository}/pull/${prNumber(result)}`,
      state: "merged",
      base: "dev",
      mergedBy: "lnakamura",
      mergedAt: mergedBefore(at(day, time)),
    },
    createdAt: at(day - (oneShot ? 0 : 7), "10:03"),
    archivedAt: at(day, time),
    hasPrDraft: true,
    prReports: [
      { pass: 1, file: "review-1.md", clean: false, structured: true, findings: 2 },
      { pass: 2, file: "review-2.md", clean: true, structured: true, findings: 0 },
    ],
  });
  return { ...task, close: closeOf(name, mode, row) };
}

function reviewOf(row: Row, index: number): ArchivedReview {
  const [day, time, , title, where, result, more] = row;
  const { name: repository, number } = whereOf(where);
  const closed = result === "Closed";
  const passes: ReviewPass[] = Array.from({ length: passCount(more) }, (_, pass) =>
    makeReviewPass({
      pass: pass + 1,
      file: `review-${pass + 1}.md`,
      published: true,
      publishedAt: at(day, "09:00"),
      verdict: pass + 1 === passCount(more) ? "approve" : "request_changes",
      findings: [],
    }),
  );
  return makeArchivedReview({
    id: idOf("r", index),
    repositoryId: repositoryId(repository),
    repository: `${OWNER}/${repository}`,
    number,
    title,
    author: "tchen",
    url: `https://github.com/${OWNER}/${repository}/pull/${number}`,
    outcome: closed ? "closed" : "merged",
    baseBranch: "dev",
    passes,
    mergedBy: closed ? "" : "rsouza",
    mergedAt: closed ? "" : at(day, time),
    closedAt: closed ? at(day, time) : "",
    createdAt: at(day - 1, "10:00"),
    archivedAt: at(day, time),
  });
}

function discussionOf(row: Row, index: number): ArchivedDiscussion {
  const [day, time, , title, where, result] = row;
  const published = Number(result.split(" ")[0]);
  const board = BOARDS.find((one) => one.title === where);
  const reached = title === USAGE_ALERTS ? ["web"] : (DISCUSSION_REPOSITORIES[where] ?? []);
  const drafts = Array.from({ length: published }, (_, number) =>
    makeDraft({
      id: `${idOf("d", index)}-draft-${number + 1}`,
      position: number + 1,
      title: `${title}, card ${number + 1}`,
      repository: `${OWNER}/${reached[0] ?? "api"}`,
      repositoryId: repositoryId(reached[0] ?? "api"),
      decision: "approved",
      outcome: "created",
      published: true,
      publishedAt: at(day, time),
      number: 500 + number,
    }),
  );
  return makeArchivedDiscussion({
    id: idOf("d", index),
    boardId: board?.id ?? "",
    board: where,
    title,
    text: title,
    cards: [],
    drafts,
    publishedCount: published,
    repositoryIds: reached.map(repositoryId),
    createdAt: at(day, "09:00"),
    archivedAt: at(day, time),
  });
}

// ITEMS are the 44 archived items of the mock, by kind.
const ITEMS = HIST.map((row, index) => ({ row, index }));
const TASKS = ITEMS.filter(({ row }) => row[2] === "t" || row[2] === "o").map(({ row, index }) =>
  taskOf(row, index),
);
const REVIEWS = ITEMS.filter(({ row }) => row[2] === "r").map(({ row, index }) =>
  reviewOf(row, index),
);
const DISCUSSIONS = ITEMS.filter(({ row }) => row[2] === "d").map(({ row, index }) =>
  discussionOf(row, index),
);

const countIn = (name: string) => ({
  archivedTasks: TASKS.filter((task) => task.repositoryId === repositoryId(name)).length,
  archivedReviews: REVIEWS.filter((review) => review.repositoryId === repositoryId(name)).length,
  archivedDiscussions: DISCUSSIONS.filter((one) =>
    (one.repositoryIds ?? []).includes(repositoryId(name)),
  ).length,
});

function repositories(): Repository[] {
  return REPOSITORIES.map((name) =>
    makeRepository({
      id: repositoryId(name),
      owner: OWNER,
      name,
      fullName: `${OWNER}/${name}`,
      path: `${HOME}/code/${name}`,
      boardId: boardOf(name),
      ...countIn(name),
    }),
  );
}

function boards(): Board[] {
  return BOARDS.map((board) =>
    makeBoard({
      id: board.id,
      owner: OWNER,
      number: board.number,
      title: board.title,
      url: `https://github.com/orgs/${OWNER}/projects/${board.number}`,
      repositoryIds: board.repositories.map(repositoryId),
      readAt: at(TODAY, "15:00"),
      viewer: "gmartins",
    }),
  );
}

// ---------------- The three items the mock opens (history.js:53–98) ----------------

const TASK_ID = idOf("t", 0);
const ONE_SHOT_ID = idOf("o", 3);
const REVIEW_ID = idOf("r", 5);
const DISCUSSION_ID = idOf("d", 2);

// The task opened is the one of the first row, with the dates of the mock.
function openedTask(id: string): ArchivedTask {
  const found = TASKS.find((task) => task.id === id);
  if (found === undefined) {
    throw new Error(`the scenes have no task ${id}`);
  }
  return found;
}

const FINDINGS: ReviewFinding[] = [
  makeReviewFinding({
    number: 1,
    title: "The time zone lost its required rule.",
    path: "src/settings/schema.ts",
    line: 22,
    text: "The time zone lost its required rule.",
    decision: "approved",
    placement: "inline",
  }),
  makeReviewFinding({
    number: 2,
    title: "Settings asks about unsaved changes as soon as it opens.",
    path: "src/settings/SettingsForm.tsx",
    line: 48,
    text: "Settings asks about unsaved changes as soon as it opens.",
    decision: "approved",
    placement: "inline",
  }),
  makeReviewFinding({
    number: 3,
    title: "The e2e selectors are out of date; the spec is skipped, so it can wait.",
    path: "",
    line: 0,
    text: "The e2e selectors are out of date; the spec is skipped, so it can wait.",
    decision: "approved",
    placement: "body",
  }),
];

// openedReview is the review of web#2291: two passes, the first with three findings, in the mode of the variant.
function openedReview(mode: "publish" | "apply"): ArchivedReview {
  const base = REVIEWS.find((review) => review.id === REVIEW_ID);
  if (base === undefined) {
    throw new Error("the scenes have no review 2291");
  }
  const apply = mode === "apply";
  const pass = (number: number, when: string, findings: ReviewFinding[]): ReviewPass =>
    makeReviewPass({
      pass: number,
      file: `review-${number}.md`,
      findings,
      published: !apply,
      publishedAt: apply ? "" : at(23, when),
      sent: apply,
      sentAt: apply ? at(23, when) : "",
      verdict: number === 1 ? "request_changes" : "approve",
    });
  return {
    ...base,
    mode,
    card: {
      boardId: PLATFORM_ID,
      number: 2238,
      title: "Settings form keeps the old validation",
      url: "https://github.com/acme/web/issues/2238",
      status: "Done",
    },
    passes: [pass(1, "13:41", FINDINGS), pass(2, "15:48", [])],
  };
}

// openedDiscussion is the discussion Webhook delivery guarantees: an epic with two cards, a card
// that was discarded and an update of an existing one; 4 of 5 drafts published.
function openedDiscussion(): ArchivedDiscussion {
  const base = DISCUSSIONS.find((one) => one.id === DISCUSSION_ID);
  if (base === undefined) {
    throw new Error("the scenes have no discussion Webhook delivery guarantees");
  }
  const draft = (fields: Partial<Draft>): Draft =>
    makeDraft({
      repository: `${OWNER}/api`,
      repositoryId: repositoryId("api"),
      decision: "approved",
      outcome: "created",
      published: true,
      publishedAt: at(TODAY, "11:47"),
      round: 1,
      ...fields,
    });
  const issue = (repository: string, number: number) =>
    `https://github.com/${OWNER}/${repository}/issues/${number}`;
  const member = { draft: "w-epic", key: "", reference: "", title: "", url: "" };
  return {
    ...base,
    cards: [
      {
        key: `${OWNER}/api#447`,
        repository: `${OWNER}/api`,
        number: 447,
        title: "Retries",
        url: issue("api", 447),
      },
      {
        key: `${OWNER}/api#449`,
        repository: `${OWNER}/api`,
        number: 449,
        title: "Dead letters",
        url: issue("api", 449),
      },
    ],
    drafts: [
      draft({
        id: "w-epic",
        position: 1,
        kind: "epic",
        title: "Webhook delivery guarantees",
        number: 452,
        url: issue("api", 452),
      }),
      draft({
        id: "w-retry",
        position: 2,
        title: "Retry failed webhook deliveries with backoff",
        epic: member,
        number: 453,
        url: issue("api", 453),
      }),
      draft({
        id: "w-dead",
        position: 3,
        title: "Dead-letter queue for webhooks",
        epic: member,
        number: 454,
        url: issue("api", 454),
      }),
      draft({
        id: "w-replay",
        position: 4,
        title: "Replay a webhook from the delivery log",
        epic: member,
        decision: "discarded",
        outcome: "",
        published: false,
        publishedAt: "",
      }),
      draft({
        id: "w-signed",
        position: 5,
        kind: "update",
        title: "Signed webhook payloads",
        repository: `${OWNER}/gateway`,
        repositoryId: repositoryId("gateway"),
        outcome: "updated",
        number: 440,
        url: issue("gateway", 440),
      }),
    ],
    publishedCount: 4,
    createdAt: at(TODAY, "10:02"),
  };
}

// ---------------- What the documents read ----------------

const DISCUSSION_DOCUMENT = `## Context

The gateway sends each webhook once. A receiver that is down at that moment never gets it, and support replays events by hand from the logs.

## In scope

- Retries with backoff for 24 hours, then a dead-letter queue.
- Signed payloads, so a replay is verifiable.

## Out of scope

- Ordering guarantees between events.`;

const PRD = `## Context

A client that retries \`POST /payment_intents\` after a timeout can charge a customer twice. Support refunded 41 double charges in August.

## Problem

The API has no way to tell a retry from a new request.

## Goals

- A client sends \`Idempotency-Key\`; a repeated key within 24 hours returns the first response.
- A repeated key with a different body is refused with \`422\`.

## Out of scope

- Idempotency on other endpoints.
- Keys that live longer than 24 hours.

## Acceptance criteria

- Two requests with the same key and body create one payment intent.
- The second response has the header \`Idempotent-Replayed: true\`.`;

const ONE_SHOT = `## What to fix

The login e2e fails about one run in eight: the test clicks \`Sign in\` before the form mounts its handler.

## The change

- Wait for the form's \`data-ready\` attribute before typing.
- Drop the fixed 500 ms sleep.

## Done when

- Fifty runs in CI pass in a row.`;

const PR_DRAFT = `---
title: Idempotency keys for payment intents
---

Adds the \`Idempotency-Key\` header to \`POST /payment_intents\`. A repeated key within 24 hours returns the stored response; a repeated key with a different body returns \`422\`.

Closes acme/api#398`;

const CLEAN =
  "Nothing to change. The step does what its file asks, and the tests cover the new path.";
const CHANGES =
  "The replay reads the stored response before checking that the request body matches; a different body with the same key returns the old response.";

// DOCUMENTS are the documents the archived items read, by the name the screen asks for.
const DOCUMENTS: Record<string, string> = {
  "PRD.md": PRD,
  "tech-spec.md": "## Approach\n\nThe key lives in its own table, with the response it stored.",
  "one-shot.md": ONE_SHOT,
  "pr/draft.md": PR_DRAFT,
  "pr/review-1.md":
    "## Findings\n\n1. The migration adds the index without CONCURRENTLY and locks the table.\n2. The 24 hours are a literal in two places.",
  "pr/review-2.md": "Both findings fixed. The checks pass and the branch merges clean into dev.",
  "review-1.md":
    "The move to react-hook-form keeps every field and the submit flow, and the six checks pass. Two things to fix before merging.",
  "review-2.md":
    "Both findings fixed in 3f1a9c0. Nothing else changed. The checks pass and the branch merges clean into dev.",
  ...Object.fromEntries(
    REPORTS.flatMap((passes, step) =>
      passes.map((clean, pass) => [
        `step-reviews/step-${step + 1}-review-${pass + 1}.md`,
        clean ? CLEAN : CHANGES,
      ]),
    ),
  ),
};

// conversation is the 31 messages of the discussion, which the page folds: the first two are the ones of the mock.
function conversation() {
  const talk = [
    "Webhooks get lost when a receiver is down. I want retries and a way to see what failed.",
    "The gateway sends from internal/webhooks/send.go with a single attempt and no record of the failure. Should a retry keep the original signature, or sign again at send time?",
  ];
  return Array.from({ length: 31 }, (_, index) => {
    const text = talk[index] ?? (index % 2 === 0 ? "Go on" : "Understood.");
    if (index % 2 === 0) {
      const { user } = makeEntry("user");
      return makeEntry("user", {
        createdAt: at(TODAY, "10:02"),
        user: user === null ? null : { ...user, text },
      });
    }
    const { assistant } = makeEntry("assistant");
    return makeEntry("assistant", {
      createdAt: at(TODAY, "10:03"),
      assistant: assistant === null ? null : { ...assistant, text, complete: true },
    });
  });
}

// ---------------- The scenes ----------------

// summaryOf is the History as the sidebar counts it: the items of the window and, with beyond, the
// 24 older ones the Go has and the list has not asked for.
function summaryOf(beyond: number) {
  return makeHistorySummary({
    tasks: TASKS.length + beyond,
    reviews: REVIEWS.length,
    discussions: DISCUSSIONS.length,
    oldest: beyond > 0 ? at(3, "10:00").replace("-09-", "-08-") : at(12, "11:30"),
    windowStart: at(12, "00:00"),
  });
}

function stateOf(options: { beyond?: number; filter?: string; empty?: boolean } = {}): State {
  const { beyond = 0, filter = "", empty = false } = options;
  return makeState({
    repositories: empty
      ? repositories().map((repository) => ({
          ...repository,
          archivedTasks: 0,
          archivedReviews: 0,
          archivedDiscussions: 0,
        }))
      : repositories(),
    repositoryFilter: filter,
    boards: boards(),
    history: empty ? [] : TASKS,
    reviewHistory: empty ? [] : REVIEWS,
    discussionHistory: empty ? [] : DISCUSSIONS,
    historySummary: empty ? makeHistorySummary() : summaryOf(beyond),
  });
}

// scrollToEnd brings the end of the list into view, where the sentinel that asks for the next page
// is, and then the line the asking adds under it: loading, or the failure.
async function scrollToEnd() {
  await act(async () => {
    document.querySelector("[data-older-sentinel]")?.scrollIntoView({ block: "end" });
  });
  await vi.waitFor(() => expect(vi.mocked(api.listArchived)).toHaveBeenCalled());
  const line = await vi.waitFor(() => {
    const found = document.querySelector("[data-older-sentinel] + p");
    if (found === null) {
      throw new Error("the line under the list is not drawn");
    }
    return found;
  });
  await act(async () => {
    line.scrollIntoView({ block: "end" });
  });
}

// openMenu opens the ⋯ of an archived item and chooses Delete…, which opens its dialog.
async function openDelete(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: /^Delete…/ }));
}

// chooseTab opens a tab of the documents of an archived task.
async function chooseTab(user: UserEvent, name: RegExp) {
  await user.click(within(document.body).getByRole("tab", { name }));
}

function historyScreen(variant: string): HistoryScene {
  const base = { back: [HOME_PLACE], storage: {}, now: SCENE_NOW, listing: "empty" as const };
  const location: Location = { kind: "history" };
  switch (variant) {
    case "fresh":
      return {
        ...base,
        state: stateOf(),
        location: { kind: "history", fresh: { kind: "task", id: TASK_ID } },
      };
    case "filtered": {
      const filter = repositoryId("web");
      return { ...base, state: stateOf({ filter }), location };
    }
    case "filtered-empty":
      return { ...base, state: stateOf({ filter: repositoryId("docs") }), location };
    case "no-match":
      return {
        ...base,
        state: stateOf(),
        location,
        after: async (user) => {
          await user.type(screen.getByRole("searchbox", { name: "Search History" }), "refund");
          await vi.waitFor(() => expect(vi.mocked(api.listArchived)).toHaveBeenCalled());
        },
      };
    case "empty":
      return { ...base, state: stateOf({ empty: true }), location };
    case "older-loading":
      return {
        ...base,
        listing: "pending",
        state: stateOf({ beyond: 24 }),
        location,
        after: scrollToEnd,
      };
    case "older-failed":
      return {
        ...base,
        listing: "failed",
        state: stateOf({ beyond: 24 }),
        location,
        after: scrollToEnd,
      };
    default:
      return { ...base, state: stateOf(), location };
  }
}

function archivedScreen(name: HistorySceneName, variant: string): HistoryScene {
  const base = {
    back: [{ kind: "history" } satisfies Location],
    storage: {},
    now: SCENE_NOW,
    listing: "empty" as const,
  };
  const withdraw = (
    history: ArchivedTask[],
    review: ArchivedReview[],
    discussion: ArchivedDiscussion[],
  ) =>
    ({
      ...stateOf(),
      history,
      reviewHistory: review,
      discussionHistory: discussion,
    }) satisfies State;
  switch (name) {
    case "archived-task": {
      const id = variant === "oneshot" ? ONE_SHOT_ID : TASK_ID;
      // The task of the mock is the one of the first row, with the dates of its detail.
      const task = {
        ...openedTask(id),
        createdAt: at(
          variant === "oneshot" ? TODAY : 17,
          variant === "oneshot" ? "08:12" : "10:03",
        ),
      };
      const state = withdraw(
        TASKS.map((one) => (one.id === id ? task : one)),
        REVIEWS,
        DISCUSSIONS,
      );
      const after =
        variant === "steps"
          ? async (user: UserEvent) => chooseTab(user, /^Steps/)
          : variant === "pr"
            ? async (user: UserEvent) => chooseTab(user, /^Pull request/)
            : variant === "delete"
              ? openDelete
              : undefined;
      return {
        ...base,
        state,
        location: { kind: "archived-task", id },
        ...(after === undefined ? {} : { after }),
      };
    }
    case "archived-review": {
      const review = openedReview(variant === "apply" ? "apply" : "publish");
      return {
        ...base,
        state: withdraw(
          TASKS,
          REVIEWS.map((one) => (one.id === REVIEW_ID ? review : one)),
          DISCUSSIONS,
        ),
        location: { kind: "archived-review", id: REVIEW_ID },
        ...(variant === "delete" ? { after: openDelete } : {}),
      };
    }
    default: {
      const discussion = openedDiscussion();
      return {
        ...base,
        state: withdraw(
          TASKS,
          REVIEWS,
          DISCUSSIONS.map((one) => (one.id === DISCUSSION_ID ? discussion : one)),
        ),
        location: { kind: "archived-discussion", id: DISCUSSION_ID },
        ...(variant === "delete" ? { after: openDelete } : {}),
      };
    }
  }
}

/**
 * historyScene is a place of the mock with the variant of its `?v=`, "" for the plain one: what the
 * state, the location and the user did to draw it.
 */
export function historyScene(name: HistorySceneName, variant = ""): HistoryScene {
  if (!HISTORY_VARIANTS[name].includes(variant)) {
    throw new Error(`the scene ${name} has no variant "${variant}"`);
  }
  const scene = name === "history" ? historyScreen(variant) : archivedScreen(name, variant);
  return scene;
}

/** HISTORY_ITEMS are how many items of the list the scene has: 44. */
export const HISTORY_ITEMS = HIST.length;
