/**
 * The scenes of Reviews and of the screen of a review: the nine open pull requests of the twelve
 * repositories of acme, and the review of web#2291 at the eleven moments of the mock, with the flags
 * own, stale, apply and checkerr. The scene tests draw ReviewsView and ReviewView from them.
 */

import { act, screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import type { Location } from "@/lib/locations";
import type {
  ActionEntry,
  ArchivedReview,
  Entry,
  MarkerEntry,
  MarkerType,
  PRCheck,
  PullCard,
  PullRequestRow,
  Repository,
  ReviewFinding,
  ReviewPass,
  ReviewSummary,
  State,
  TaskSummary,
  UserEntry,
} from "@/lib/wails";
import { REVIEW_STAGE, sessionKey } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { fromTranscript, type TranscriptState } from "@/store/transcript";
import { inStep } from "@/test/task-scenes";
import {
  makeAction,
  makeArchivedReview,
  makeBoard,
  makeEntry,
  makePRCheck,
  makePullRequestRow,
  makePullReview,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeStepReviewer,
  makeTranscript,
} from "@/test/wails-mock";

/** REVIEW_SCENES are the eleven moments of the mock: four of Reviews, seven of the review of web#2291. */
export const REVIEW_SCENES = [
  "list",
  "list-empty",
  "list-failed",
  "start",
  "checks",
  "pass",
  "findings",
  "publish",
  "clean",
  "again",
  "merged",
] as const;

/** ReviewSceneName is one moment of the mock. */
export type ReviewSceneName = (typeof REVIEW_SCENES)[number];

/**
 * ReviewFlags are the flags of the mock: own is your own pull request (web#2288 in the start dialog,
 * web#2291 in the review), stale the two commits after the pass, apply the Apply mode, and checkerr
 * the reading of every minute that fails.
 */
export interface ReviewFlags {
  own?: boolean;
  stale?: boolean;
  apply?: boolean;
  checkerr?: boolean;
}

/** ReviewScene is what a test draws for a moment: the state, the place and what the user did. */
export interface ReviewScene {
  state: State;
  location: Location;
  /** transcripts are the conversations on screen, already read, by sessionKey. */
  transcripts: Record<string, TranscriptState>;
  /** storage is what Reviews remembers in localStorage, by key. */
  storage: Record<string, string>;
  /** now is the moment of the scene, local time as the mock writes it. */
  now: string;
  /** after drives what the scene has open: the panel of api#1302, a dialog. */
  after?: (user: UserEvent) => Promise<void>;
}

/** REVIEW_ID is the id of the review of web#2291, the one the review scenes draw. */
export const REVIEW_ID = "review-web-2291";

/** IOS_REVIEW_ID is the id of the review of ios#312, published with changes requested. */
export const IOS_REVIEW_ID = "review-ios-312";

// DAY is the day of the scenes; the hours are written without a zone, as board-scenes.ts writes its
// moment, so they are the local ones on any machine.
const DAY = "2026-09-24";

// local is an hour of a day of the scenes, "13:08" or "13:09:20", as the mock writes it.
function local(time: string, day = DAY): string {
  return `${day}T${time.length === 5 ? `${time}:00` : time}`;
}

// at is the instant of an hour of a day of the scenes, as the Go writes it.
function at(time: string, day = DAY): string {
  return new Date(local(time, day)).toISOString();
}

// before is the instant some seconds before another.
function before(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) - seconds * 1000).toISOString();
}

/** SCENE_NOW is the hour of each scene, by the table of the material (§1). */
const SCENE_NOW: Record<ReviewSceneName, string> = {
  list: local("18:00"),
  "list-empty": local("18:00"),
  "list-failed": local("18:00"),
  start: local("18:00"),
  checks: local("13:10"),
  pass: local("13:15:10"),
  findings: local("13:53"),
  publish: local("14:00"),
  clean: local("14:00"),
  again: local("15:14"),
  merged: local("16:21"),
};

/**
 * fixReviewSceneClock stops the clock of the page at the moment of a scene for each test that runs
 * next in the describe it is called in, and gives it back after, with what Reviews remembered; only
 * Date is faked, so the timers of the page still run.
 */
export function fixReviewSceneClock(scene: ReviewScene): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(scene.now));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
}

// ---------------- The repositories and the boards ----------------

const OWNER = "acme";

/** ME is the account of gh on the machine of the scenes. */
const ME = "gmartins";

const PLATFORM_ID = "board-platform";
const MOBILE_ID = "board-mobile";

const repositoryId = (name: string) => `repo-${name}`;

// BOARD_OF is the board of each repository: the five with open pull requests, billing on Platform
// Roadmap and android on Mobile App; the others are on no board.
const BOARD_OF: Record<string, string> = {
  api: PLATFORM_ID,
  web: PLATFORM_ID,
  gateway: PLATFORM_ID,
  docs: PLATFORM_ID,
  billing: PLATFORM_ID,
  ios: MOBILE_ID,
  android: MOBILE_ID,
};

// REPOSITORIES are the twelve repositories of acme: five with open pull requests, seven without.
const REPOSITORIES = [
  "android",
  "api",
  "billing",
  "cli",
  "docs",
  "gateway",
  "infra",
  "ios",
  "marketing-site",
  "sdk-js",
  "status-page",
  "web",
];

function repositories(): Repository[] {
  return REPOSITORIES.map((name) =>
    makeRepository({
      id: repositoryId(name),
      owner: OWNER,
      name,
      fullName: `${OWNER}/${name}`,
      path: `/home/dev/code/${name}`,
      boardId: BOARD_OF[name] ?? "",
    }),
  );
}

function boards() {
  return [
    makeBoard({
      id: PLATFORM_ID,
      owner: OWNER,
      number: 7,
      title: "Platform Roadmap",
      url: "https://github.com/orgs/acme/projects/7",
      repositoryIds: REPOSITORIES.filter((name) => BOARD_OF[name] === PLATFORM_ID).map(
        repositoryId,
      ),
      readAt: at("17:58"),
      viewer: ME,
    }),
    makeBoard({
      id: MOBILE_ID,
      owner: OWNER,
      number: 5,
      title: "Mobile App",
      url: "https://github.com/orgs/acme/projects/5",
      repositoryIds: [repositoryId("ios"), repositoryId("android")],
      readAt: at("17:58"),
      viewer: ME,
    }),
  ];
}

// ---------------- The pull requests ----------------

/** CheckSpec is a check of the mock: its state, its name and how long it ran in seconds. */
type CheckSpec = [state: "passed" | "failed" | "running" | "queued", name: string, seconds: number];

// checksOf are the checks of a reading: the finished ones ended some seconds before it, one after
// the other; a running one started its seconds before the moment of the scene.
function checksOf(specs: readonly CheckSpec[], readAt: string, now: string): PRCheck[] {
  return specs.map(([state, name, seconds], index) => {
    const url = `https://github.com/acme/actions/runs/${4100 + index}`;
    switch (state) {
      case "running":
        return makePRCheck({
          name,
          state,
          conclusion: "",
          startedAt: before(now, seconds),
          completedAt: "",
          url,
        });
      case "queued":
        return makePRCheck({ name, state, conclusion: "", startedAt: "", completedAt: "", url });
      default: {
        const completedAt = before(readAt, 60 + index * 20);
        return makePRCheck({
          name,
          state,
          conclusion: state === "passed" ? "success" : "failure",
          startedAt: before(completedAt, seconds),
          completedAt,
          url,
        });
      }
    }
  });
}

// passedChecks are some checks that passed, named as the mock names the ones it doesn't list.
function passedChecks(count: number): CheckSpec[] {
  return ["build", "lint", "unit", "e2e", "docs", "typecheck"]
    .slice(0, count)
    .map((name, index) => ["passed", name, (index + 1) * 60 + index]);
}

// The checks of web#2291: the six of the mock, all passed, or with e2e / chromium still running and
// preview-deploy queued while the first pass waits for them.
const WEB_CHECKS: CheckSpec[] = [
  ["passed", "build", 112],
  ["passed", "lint", 48],
  ["passed", "typecheck", 66],
  ["passed", "unit", 151],
  ["passed", "e2e / chromium", 418],
  ["passed", "preview-deploy", 130],
];
const WEB_CHECKS_WAITING: CheckSpec[] = [
  ["passed", "build", 112],
  ["passed", "lint", 48],
  ["passed", "typecheck", 66],
  ["passed", "unit", 151],
  ["running", "e2e / chromium", 340],
  ["queued", "preview-deploy", 0],
];

const BODY_1302 = `Payment retries from the job queue can run twice when a worker dies after the charge and before the ack. This adds an idempotency key per charge attempt, stored with a unique index in the ledger.

- The key is \`sha256(invoice_id, attempt)\`, set by the scheduler, not by the worker.
- A second charge with the same key returns the first result instead of calling the provider.
- Keys expire after 7 days, with the attempt window.

**Testing.** A new integration test kills the worker between the charge and the ack and checks there is one charge.`;

const BODY_88 = `Bodies over 1 MB are read into memory before the upstream call, and uploads time out at 30 s. The gateway now streams them with a 256 KB buffer.

Since your review: the buffer is pooled, the timeout counts from the last byte, and there is a test for a 40 MB upload.`;

/** Spec is a pull request of the mock before it becomes a PullRequestRow. */
interface Spec {
  repository: string;
  number: number;
  title: string;
  author: string;
  /** updated is how many minutes before the moment of the list it was updated. */
  updated: number;
  checks: CheckSpec[];
  head: string;
  card?: [number, string, string];
  labels?: string[];
  draft?: boolean;
  reviewId?: string;
  taskId?: string;
  /** reviewed is your last review, with how many commits came after it when the pull request is pending. */
  reviewed?: { state: string; at: string; newCommits: number };
  body?: string;
}

// SPECS are the nine open pull requests of the mock, in its order. api#1298 carries dependencies besides
// the mock's dependabot, so a row has labels to give way at the narrow lists.
const SPECS: Spec[] = [
  {
    repository: "web",
    number: 2291,
    title: "Migrate settings page to react-hook-form",
    author: "rsouza",
    updated: 12,
    checks: WEB_CHECKS,
    head: "settings-rhf",
    card: [437, "Settings forms on react-hook-form", "In progress"],
    reviewId: REVIEW_ID,
  },
  {
    repository: "ios",
    number: 312,
    title: "Crash on share sheet when offline",
    author: "tchen",
    updated: 180,
    checks: passedChecks(4),
    head: "share-offline",
    reviewId: IOS_REVIEW_ID,
  },
  {
    repository: "gateway",
    number: 88,
    title: "Stream request bodies over 1 MB",
    author: "apatel",
    updated: 25,
    checks: [
      ["failed", "e2e / large-upload", 451],
      ["passed", "build", 80],
      ["passed", "lint", 34],
      ["passed", "unit", 122],
    ],
    head: "stream-bodies",
    card: [466, "Uploads over 1 MB time out at the gateway", "Code review"],
    reviewed: { state: "changes_requested", at: at("09:30", "2026-09-22"), newCommits: 3 },
    body: BODY_88,
  },
  {
    repository: "api",
    number: 1302,
    title: "Idempotency keys for payment retries",
    author: "lnakamura",
    updated: 120,
    checks: [
      ["passed", "build", 124],
      ["passed", "lint", 51],
      ["passed", "unit", 220],
      ["running", "integration / ledger", 372],
      ["queued", "e2e / checkout", 0],
    ],
    head: "idempotency-keys",
    card: [452, "Retries must not charge twice", "Code review"],
    body: BODY_1302,
  },
  {
    repository: "api",
    number: 1298,
    title: "Bump golang.org/x/net from 0.29.0 to 0.33.0",
    author: "dependabot",
    updated: 300,
    checks: passedChecks(5),
    head: "dependabot/go_modules/golang.org/x/net-0.33.0",
    labels: ["dependabot", "dependencies"],
  },
  {
    repository: "web",
    number: 2296,
    title: "Empty state for the audit log",
    author: "rsouza",
    updated: 24 * 60,
    checks: passedChecks(6),
    head: "audit-empty",
    draft: true,
  },
  {
    repository: "docs",
    number: 140,
    title: "Rate limit tables per plan",
    author: "lnakamura",
    updated: 240,
    checks: passedChecks(2),
    head: "rate-limit-docs",
    reviewed: { state: "approved", at: at("10:02"), newCommits: 0 },
  },
  {
    repository: "api",
    number: 1284,
    title: "Rate limit requests per API key",
    author: ME,
    updated: 40,
    checks: passedChecks(5),
    head: "rate-limit-per-api-key",
    card: [412, "Rate limit per API key", "In progress"],
    taskId: "t1",
  },
  {
    repository: "web",
    number: 2288,
    title: "Keyboard shortcuts sheet",
    author: ME,
    updated: 2 * 24 * 60,
    checks: passedChecks(6),
    head: "shortcuts-sheet",
  },
];

// cardOf is the card of a pull request on Platform Roadmap.
function cardOf(repository: string, [number, title, status]: [number, string, string]): PullCard {
  return {
    boardId: PLATFORM_ID,
    number,
    title,
    url: `https://github.com/${OWNER}/${repository}/issues/${number}`,
    status,
  };
}

// actionOf is what R does on a pull request of the mock.
function actionOf(spec: Spec): string {
  if (spec.reviewId !== undefined) return "open_review";
  if (spec.taskId !== undefined) return "open_task";
  return "review";
}

// rowOf is a pull request of the mock as the reading of 17:58 has it, at a moment.
function rowOf(spec: Spec, now: string): PullRequestRow {
  const readAt = at("17:58");
  const own = spec.author === ME;
  const reviewed = spec.reviewed;
  return makePullRequestRow({
    key: `${OWNER}/${spec.repository}#${spec.number}`,
    repositoryId: repositoryId(spec.repository),
    repository: `${OWNER}/${spec.repository}`,
    boardId: BOARD_OF[spec.repository] ?? "",
    number: spec.number,
    title: spec.title,
    url: `https://github.com/${OWNER}/${spec.repository}/pull/${spec.number}`,
    author: spec.author,
    labels: (spec.labels ?? []).map((name) => ({ name, color: "0366d6" })),
    draft: spec.draft === true,
    own,
    card: spec.card === undefined ? null : cardOf(spec.repository, spec.card),
    reviewed: reviewed !== undefined,
    newCommits: (reviewed?.newCommits ?? 0) > 0,
    pending:
      spec.reviewId === undefined &&
      !own &&
      spec.taskId === undefined &&
      (reviewed === undefined || reviewed.newCommits > 0),
    taskId: spec.taskId ?? "",
    reviewId: spec.reviewId ?? "",
    action: actionOf(spec),
    updatedAt: before(new Date(now).toISOString(), spec.updated * 60),
    headBranch: spec.head,
    baseBranch: "dev",
    body: spec.body ?? `${spec.title}.\n\nNo more description.`,
    checks: checksOf(spec.checks, readAt, new Date(now).toISOString()),
    mergeable: "mergeable",
    yourReview:
      reviewed === undefined ? null : makePullReview({ state: reviewed.state, at: reviewed.at }),
    newCommitCount: reviewed?.newCommits ?? 0,
  });
}

// ---------------- The findings and the summary of web#2291 ----------------

const WEB = { repository: "web", number: 2291 };
const WEB_URL = "https://github.com/acme/web/pull/2291";
const WEB_TITLE = "Migrate settings page to react-hook-form";

// FINDINGS are the three findings of pass 1, the text of the mock in Markdown.
const FINDINGS: ReviewFinding[] = [
  makeReviewFinding({
    number: 1,
    title: "The time zone field is no longer required",
    path: "web/src/settings/GeneralForm.tsx",
    line: 84,
    lineUrl: `${WEB_URL}/files#diff-4f1c2e9ab7R84`,
    text: 'The old form rejected an empty time zone on blur. The new schema declares `timezone` as `z.string()` without `.min(1)`, and the API answers 422 for an empty value (`internal/settings/handler.go:57`), so the user sees a generic error only after submitting. Add `.min(1, "Choose a time zone")`.',
  }),
  makeReviewFinding({
    number: 2,
    title: "Settings asks about unsaved changes as soon as it opens",
    path: "web/src/settings/useSettingsForm.ts",
    line: 31,
    lineUrl: `${WEB_URL}/files#diff-9d03b61ce2R31`,
    text: "`reset(defaults)` runs in an effect after the first render, so `isDirty` is true for one render and the router guard registers. Opening Settings and leaving at once asks “Discard unsaved changes?”. Pass `values: defaults` to `useForm` and drop the effect.",
  }),
  makeReviewFinding({
    number: 3,
    title: "An end-to-end test still looks for the old field ids",
    path: "",
    line: 0,
    lineUrl: "",
    text: "`e2e/settings.spec.ts` queries `#settings-name` and `#settings-tz`, which this pull request renames. The e2e job passes only because the spec is on the `testIgnore` list of `playwright.config.ts`. Update the selectors and take the spec off the list.",
  }),
];

const SUMMARY =
  "The move to react-hook-form keeps every field and the submit flow, and the six checks pass. Two things to fix before merging: the time zone lost its required rule, and Settings asks about unsaved changes as soon as it opens. The e2e selectors are out of date too, but the spec is skipped, so that can wait.";

const CLEAN_SUMMARY =
  "The move to react-hook-form keeps every field, the validation the old page did on blur and the submit flow. The six checks pass and the branch merges clean into dev. Nothing to change.";

/** INSTRUCTIONS are what the user wrote when starting the review, their first message. */
const INSTRUCTIONS =
  "can we merge safely? The old page validated on blur, and the API rejects an empty time zone.";

// decided are the findings with the decisions of a moment: 1 approved while they are decided, then 1
// and 2 approved and 3 discarded; published, where each went.
function decided(moment: "deciding" | "decided" | "published"): ReviewFinding[] {
  return FINDINGS.map((finding) => {
    if (moment === "deciding") {
      return finding.number === 1 ? { ...finding, decision: "approved" } : finding;
    }
    const approved = finding.number !== 3;
    return {
      ...finding,
      decision: approved ? "approved" : "discarded",
      placement: moment === "published" && approved ? "inline" : "",
    };
  });
}

const OPUS = "claude-opus-5-5[1m]";

const WORKTREE = "/home/dev/.local/share/myspec/worktrees/acme/web/pr_2291";

// firstPass is pass 1 of web#2291 at a moment: asked for and waiting, running with the checks it
// read at 13:12, or recorded at 13:19 with its report.
function firstPass(moment: "asked" | "running" | "recorded", fields: Partial<ReviewPass> = {}) {
  const readAt = at("13:12");
  const recorded = moment === "recorded";
  return makeReviewPass({
    pass: 1,
    file: "review-1.md",
    recorded,
    instructions: INSTRUCTIONS,
    summary: recorded ? SUMMARY : "",
    findings: recorded ? FINDINGS : [],
    checks: moment === "asked" ? [] : checksOf(WEB_CHECKS, readAt, readAt),
    mergeable: moment === "asked" ? "" : "mergeable",
    checksReadAt: moment === "asked" ? "" : readAt,
    recordedAt: recorded ? at("13:19") : "",
    ...fields,
  });
}

// ---------------- The reviews ----------------

const REPORT_PLACE = { kind: "review", stage: REVIEW_STAGE, step: 0 };

// reviewSituation is a situation of the review of web#2291, started at an instant.
function reviewSituation(kind: string, form: string, startedAt: string) {
  return makeSituation({
    id: `${REVIEW_ID}-${kind}`,
    taskId: REVIEW_ID,
    kind,
    group: "waiting",
    form,
    place: REPORT_PLACE,
    startedAt,
  });
}

// The moments of the review of web#2291: the four of the review screen, and the one the list shows.
type WebMoment = "checks" | "pass" | "findings" | "publish" | "clean" | "again";

// webReview is the review of web#2291 at a moment of the mock, at the hour of its scene.
function webReview(moment: WebMoment, flags: ReviewFlags, now: string): ReviewSummary {
  const own = flags.own === true || flags.apply === true;
  const apply = flags.apply === true;
  const nowIso = new Date(now).toISOString();
  const live = moment === "checks" ? WEB_CHECKS_WAITING : WEB_CHECKS;
  // The last good reading of every minute: with a reading that failed at 13:50, the one before it at
  // 13:49; otherwise 40 seconds ago, or 13:09:20 while the checks run. The checks completed before it.
  const checkedAt =
    flags.checkerr === true
      ? at("13:49")
      : moment === "checks"
        ? at("13:09:20")
        : before(nowIso, 40);
  const base: Partial<ReviewSummary> = {
    id: REVIEW_ID,
    repositoryId: repositoryId(WEB.repository),
    repository: `${OWNER}/${WEB.repository}`,
    number: WEB.number,
    title: WEB_TITLE,
    author: own ? ME : "rsouza",
    url: WEB_URL,
    headBranch: "settings-rhf",
    baseBranch: "dev",
    own,
    mode: apply ? "apply" : "publish",
    card: cardOf(WEB.repository, [437, "Settings forms on react-hook-form", "In progress"]),
    worktreePath: WORKTREE,
    checks: checksOf(live, checkedAt, nowIso),
    mergeable: "mergeable",
    checkedAt,
    verdicts: own ? ["comment"] : ["approve", "request_changes", "comment"],
    sessionStage: REVIEW_STAGE,
    sessionStatus: "waiting",
    sessionModel: OPUS,
    sessionEffort: "high",
    turnRunning: false,
    processRunning: true,
    contextPercent: 31,
    createdAt: at("13:08"),
    ...(flags.stale === true ? { stalePass: true, staleCommits: 2 } : {}),
    ...(flags.checkerr === true
      ? {
          checkError: "GitHub's rate limit was reached. It resets at 14:32.",
          checkErrorAt: at("13:50"),
        }
      : {}),
  };
  switch (moment) {
    case "checks":
      // The session starts when the checks finish: until then there is no conversation to talk to.
      return makeReviewSummary({
        ...base,
        status: "waiting_checks",
        passes: [firstPass("asked")],
        sessionStage: "",
        processRunning: false,
        contextPercent: 0,
      });
    case "pass":
      return makeReviewSummary({
        ...base,
        status: "reviewing",
        passes: [firstPass("running")],
        sessionStatus: "working",
        turnRunning: true,
        turnStartedAt: at("13:13:00"),
        contextPercent: 22,
        actionLabel: "Reading",
        actionTarget: "web/src/settings/GeneralForm.tsx",
      });
    case "findings":
      return makeReviewSummary({
        ...base,
        status: "awaiting_decision",
        passes: [firstPass("recorded", { findings: decided("deciding") })],
        canReviewAgain: true,
        // The mock waits 34 minutes on the findings at every hour it draws them.
        situations: [reviewSituation("review_report", "decide", before(nowIso, 34 * 60))],
      });
    case "publish":
      return makeReviewSummary({
        ...base,
        status: apply ? "ready_to_apply" : "ready_to_publish",
        passes: [firstPass("recorded", { findings: decided("decided") })],
        canPublish: !apply,
        canApply: apply,
        canReviewAgain: true,
        situations: [reviewSituation("review_report", apply ? "apply" : "publish", at("13:19"))],
      });
    case "clean":
      return makeReviewSummary({
        ...base,
        status: "ready_to_publish",
        passes: [firstPass("recorded", { clean: true, findings: [], summary: CLEAN_SUMMARY })],
        canPublish: true,
        canReviewAgain: true,
        situations: [reviewSituation("review_report", "publish", at("13:19"))],
      });
    case "again":
      return makeReviewSummary({
        ...base,
        status: "new_commits",
        newCommits: 3,
        passes: [
          firstPass("recorded", {
            findings: decided("published"),
            published: true,
            publishedAt: at("13:41"),
            publishedUrl: `${WEB_URL}#pullrequestreview-2291001`,
            verdict: "request_changes",
            summaryPublished: true,
          }),
        ],
        canReviewAgain: true,
        situations: [reviewSituation("new_commits", "", at("15:02"))],
      });
  }
}

// iosReview is the review of ios#312: published yesterday, with changes requested.
function iosReview(): ReviewSummary {
  return makeReviewSummary({
    id: IOS_REVIEW_ID,
    repositoryId: repositoryId("ios"),
    repository: `${OWNER}/ios`,
    number: 312,
    title: "Crash on share sheet when offline",
    author: "tchen",
    url: "https://github.com/acme/ios/pull/312",
    headBranch: "share-offline",
    baseBranch: "dev",
    status: "published",
    worktreePath: "/home/dev/.local/share/myspec/worktrees/acme/ios/pr_312",
    passes: [
      makeReviewPass({
        pass: 1,
        recorded: true,
        summary: "The offline check runs after the sheet opens.",
        findings: [
          makeReviewFinding({
            number: 1,
            title: "The share sheet opens before the network check",
            path: "App/Share/ShareController.swift",
            line: 42,
            lineUrl: "https://github.com/acme/ios/pull/312/files#diff-a1R42",
            decision: "approved",
            placement: "inline",
          }),
        ],
        published: true,
        publishedAt: at("16:12", "2026-09-23"),
        publishedUrl: "https://github.com/acme/ios/pull/312#pullrequestreview-312001",
        verdict: "request_changes",
        recordedAt: at("15:50", "2026-09-23"),
      }),
    ],
    sessionStage: REVIEW_STAGE,
    sessionStatus: "waiting",
    sessionModel: OPUS,
    sessionEffort: "high",
    turnRunning: false,
    processRunning: false,
    createdAt: at("15:31", "2026-09-23"),
  });
}

// archivedWeb is the review of web#2291 once rsouza merged it at 16:20: pass 1 published with
// changes requested, pass 2 clean and approved.
function archivedWeb(): ArchivedReview {
  return makeArchivedReview({
    id: REVIEW_ID,
    repositoryId: repositoryId(WEB.repository),
    repository: `${OWNER}/${WEB.repository}`,
    number: WEB.number,
    title: WEB_TITLE,
    author: "rsouza",
    url: WEB_URL,
    mode: "publish",
    outcome: "merged",
    baseBranch: "dev",
    card: cardOf(WEB.repository, [437, "Settings forms on react-hook-form", "In progress"]),
    passes: [
      firstPass("recorded", {
        findings: decided("published"),
        published: true,
        publishedAt: at("13:41"),
        verdict: "request_changes",
        summaryPublished: true,
      }),
      makeReviewPass({
        pass: 2,
        file: "review-2.md",
        recorded: true,
        clean: true,
        summary: "The three commits fix both findings. Nothing to change.",
        findings: [],
        published: true,
        publishedAt: at("15:48"),
        verdict: "approve",
        summaryPublished: true,
        recordedAt: at("15:40"),
      }),
    ],
    mergedBy: "rsouza",
    mergedAt: at("16:20"),
    createdAt: at("13:08"),
    archivedAt: at("16:20"),
  });
}

// ---------------- The task ----------------

// t1 is Rate limit per API key, the task of api#1284: a question of the reviewer of step 3 for 18
// minutes, as the task scenes have it.
function t1(now: string): TaskSummary {
  return inStep(
    3,
    {
      status: "agent_review",
      reviewPass: 2,
      reviewer: makeStepReviewer({ sessionStage: "step_review:3", sessionStatus: "needs_answer" }),
    },
    {
      id: "t1",
      sessionStatus: "waiting",
      situations: [
        makeSituation({
          id: "t1-question",
          taskId: "t1",
          kind: "question",
          group: "waiting",
          place: { kind: "step_review", stage: "", step: 3 },
          startedAt: before(new Date(now).toISOString(), 18 * 60),
        }),
      ],
    },
    false,
  );
}

// ---------------- The conversations ----------------

const USER: UserEntry = {
  text: "",
  pending: false,
  prompt: false,
  app: false,
  sent: "",
  appKind: "",
  appPass: 0,
  appRound: 0,
  appRounds: 0,
  appCount: 0,
};

function marker(time: string, type: MarkerType, fields: Partial<MarkerEntry> = {}): Entry {
  const base = makeEntry("marker").marker;
  if (base === null) {
    throw new Error("a marker entry has no marker");
  }
  return makeEntry("marker", { createdAt: at(time), marker: { ...base, type, ...fields } });
}

function speech(time: string, text: string): Entry {
  return makeEntry("assistant", {
    createdAt: at(time),
    assistant: {
      messageId: `msg_${time.replaceAll(":", "")}`,
      blockIndex: 0,
      text,
      complete: true,
      interrupted: false,
      parentToolUseId: "",
      interruptedBy: "",
    },
  });
}

/** Act is an action of a group: the tool, what the agent wrote it does, and its target. */
type Act = [tool: "Bash" | "Read" | "Grep", description: string, target: string];

// group is a turn of actions started at an hour, spread over some seconds; running leaves the last
// one running.
function group(time: string, span: number, acts: readonly Act[], running = false): Entry[] {
  const turnId = `turn_${time.replaceAll(":", "")}`;
  const first = Date.parse(at(time));
  const gap = span / Math.max(acts.length, 1);
  return acts.map(([tool, description, target], index) => {
    const startedAt = new Date(first + index * gap * 1000).toISOString();
    const live = running && index === acts.length - 1;
    const fields: Partial<ActionEntry> = {
      toolUseId: `toolu_${turnId}_${index}`,
      tool,
      label: tool,
      target,
      description: tool === "Bash" ? description : "",
      commandLines: tool === "Bash" ? 1 : 0,
      status: live ? "running" : "done",
      startedAt,
      finishedAt: live ? "" : new Date(Date.parse(startedAt) + 100).toISOString(),
      exitCode: live ? -1 : 0,
    };
    return makeEntry("action", { turnId, createdAt: startedAt, action: makeAction(fields) });
  });
}

// repeated is a run of acts taken in turn from a pool, as long as a group of the mock.
function repeated(count: number, pool: readonly Act[]): Act[] {
  return Array.from({ length: count }, (_, index) => {
    const one = pool[index % pool.length];
    if (one === undefined) {
      throw new Error("the pool of a group is empty");
    }
    return one;
  });
}

const READS: Act[] = [
  ["Read", "", "web/src/settings/GeneralForm.tsx"],
  ["Read", "", "web/src/settings/useSettingsForm.ts"],
  ["Read", "", "web/src/settings/NotificationsForm.tsx"],
  ["Read", "", "web/src/settings/schema.ts"],
  ["Read", "", "internal/settings/handler.go"],
  ["Read", "", "e2e/settings.spec.ts"],
];

// The first actions of the pass: the commits, the diff and the context, then six files read.
const FIRST_LOOK: Act[] = [
  ["Bash", "List the commits of the pull request", "git log --oneline origin/dev..HEAD"],
  ["Bash", "Measure the diff", "git diff origin/dev...HEAD --stat"],
  ["Bash", "Read the context", "cat .myspec/reviews/web-2291/context.md"],
  ...READS,
];

// The actions after the plan, while the pass runs: the old validation, then the new schema.
const COMPARING: Act[] = [
  ...repeated(15, READS),
  ["Bash", "Read the old validation", "git show origin/dev:web/src/settings/GeneralForm.jsx"],
  ["Bash", "Read the new schema", "sed -n '60,110p' web/src/settings/GeneralForm.tsx"],
];

// The whole pass: 24 actions over six minutes, reading, searching, the tests and git.
const WHOLE_PASS: Act[] = [
  ...repeated(14, READS),
  ...repeated(6, [
    ["Grep", "", "timezone"],
    ["Grep", "", "testIgnore"],
    ["Grep", "", "isDirty"],
  ] as Act[]),
  ["Bash", "Read the old validation", "git show origin/dev:web/src/settings/GeneralForm.jsx"],
  ["Bash", "Find where the API checks the time zone", 'rg -n "timezone" internal/settings'],
  ["Bash", "Run the settings tests", "pnpm vitest run src/settings"],
  ["Bash", "Look for skipped end-to-end specs", "rg -n testIgnore playwright.config.ts"],
];

// conversationOf is the conversation of the review of web#2291 at a moment of the mock.
function conversationOf(moment: WebMoment, flags: ReviewFlags): Entry[] {
  const clean = moment === "clean";
  const entries: Entry[] = [
    marker("13:08", "review_started", {
      model: OPUS,
      effort: "high",
      mode: flags.apply === true ? "apply" : "publish",
    }),
    makeEntry("user", {
      createdAt: at("13:08"),
      user: { ...USER, text: INSTRUCTIONS, prompt: true },
    }),
  ];
  if (moment === "checks") {
    return entries;
  }
  entries.push(
    marker("13:12", "checks_read", { pass: 1, passed: 6, total: 6, failed: [], conflict: false }),
  );
  if (moment === "pass") {
    return [
      ...entries,
      ...group("13:13:00", 40, FIRST_LOOK),
      speech(
        "13:13:40",
        "18 files change, most of them the three settings forms. I'll compare each schema with the validation the old page did on blur, then run the settings tests.",
      ),
      ...group("13:13:45", 80, COMPARING, true),
    ];
  }
  entries.push(
    ...group("13:13:00", 360, WHOLE_PASS),
    speech(
      "13:19",
      clean
        ? "Yes. The migration keeps every field, the time zone stays required through the shared schema, and the settings tests and the six checks pass. Nothing to change."
        : "Not yet. The migration keeps every field and the submit flow, but the time zone lost its required rule and Settings asks about unsaved changes as soon as it opens. Three findings in the report.",
    ),
    marker("13:19", "pr_review_written", { pass: 1, clean, findings: clean ? 0 : 3 }),
  );
  if (moment !== "again") {
    return entries;
  }
  return [
    ...entries,
    marker("13:40", "findings_decided", { pass: 1, approved: 2, discarded: 1 }),
    marker("13:41", "review_published", {
      pass: 1,
      verdict: "request_changes",
      inline: 2,
      body: 0,
      summary: true,
      url: `${WEB_URL}#pullrequestreview-2291001`,
    }),
    marker("15:02", "new_commits", {
      pass: 1,
      count: 3,
      commits: [
        {
          sha: "a41c9e2",
          subject: "Require a time zone in the general settings",
          author: "rsouza",
        },
        {
          sha: "7be0d13",
          subject: "Set the form's values instead of resetting them on mount",
          author: "rsouza",
        },
        { sha: "c19f02e", subject: "Update the settings e2e selectors", author: "rsouza" },
      ],
    }),
  ];
}

// transcriptsOf are the conversation of the review of web#2291 at a moment, already read.
function transcriptsOf(moment: WebMoment, flags: ReviewFlags): Record<string, TranscriptState> {
  const transcript = makeTranscript({
    taskId: REVIEW_ID,
    sessionId: "session-review-web-2291",
    stage: REVIEW_STAGE,
    entries: conversationOf(moment, flags),
  });
  return { [sessionKey(REVIEW_ID, REVIEW_STAGE)]: fromTranscript(transcript) };
}

// ---------------- The scenes ----------------

// the row of a pull request in the list, by its reference.
const rowNamed = (reference: string) =>
  screen.getByRole("treeitem", { name: new RegExp(`^${reference} `) });

// stateOf is the state of the scenes at a moment: the reading of 17:58, the task and the reviews.
function stateOf(now: string, web: ReviewSummary | null, fields: Partial<State> = {}): State {
  const readAt = at("17:58");
  return makeState({
    repositories: repositories(),
    boards: boards(),
    tasks: [t1(now)],
    reviews: web === null ? [iosReview()] : [web, iosReview()],
    reviewCenter: makeReviewCenter({
      pullRequests: SPECS.map((spec) => rowOf(spec, now)),
      readAt,
      pendingCount: 4,
      authors: [...new Set(SPECS.map((spec) => spec.author))].sort(),
      labels: ["dependabot", "dependencies"],
    }),
    cloneFolder: "/home/dev/code",
    ...fields,
  });
}

/**
 * reviewScene is what a test draws for a moment of the mock with its flags: the state, the place,
 * the conversation on screen, what Reviews remembers, and what the user does once it is on screen.
 */
export function reviewScene(name: ReviewSceneName, flags: ReviewFlags = {}): ReviewScene {
  const now = SCENE_NOW[name];
  const reviews: Location = { kind: "reviews" };
  const review: Location = { kind: "review", id: REVIEW_ID };
  // The list shows the review of web#2291 with its findings being decided.
  const listState = () => stateOf(now, webReview("findings", {}, now));
  switch (name) {
    case "list":
      return {
        state: listState(),
        location: reviews,
        transcripts: {},
        storage: {},
        now,
        after: async (user) => {
          await user.click(rowNamed("api#1302"));
        },
      };
    case "list-empty": {
      const state = stateOf(now, null, { reviews: [] });
      return {
        state: {
          ...state,
          reviewCenter: { ...state.reviewCenter, pullRequests: [], pendingCount: 0, authors: [] },
        },
        location: reviews,
        transcripts: {},
        storage: {},
        now,
      };
    }
    case "list-failed": {
      const state = listState();
      return {
        state: {
          ...state,
          reviewCenter: {
            ...state.reviewCenter,
            failures: [
              makePullsFailure({
                repositoryId: repositoryId("ios"),
                repository: `${OWNER}/ios`,
                message: "gh can't read this repository. Run gh auth refresh -s repo.",
                failedAt: at("17:56"),
              }),
            ],
          },
        },
        location: reviews,
        transcripts: {},
        storage: {},
        now,
      };
    }
    case "start": {
      const number = flags.own === true ? 2288 : 1302;
      const repository = flags.own === true ? "web" : "api";
      return {
        state: listState(),
        location: reviews,
        transcripts: {},
        storage: {},
        now,
        after: async () => {
          act(() =>
            useAppStore.getState().openStartReview({
              repositoryId: repositoryId(repository),
              number,
            }),
          );
        },
      };
    }
    case "merged":
      return {
        state: stateOf(now, null, { reviewHistory: [archivedWeb()] }),
        // The store names a review that left by its pull request, as reviewName does.
        location: { kind: "gone", item: "review", id: REVIEW_ID, name: "web#2291", boardId: "" },
        transcripts: {},
        storage: {},
        now,
      };
    default: {
      const web = webReview(name, flags, now);
      const scene: ReviewScene = {
        state: stateOf(now, web),
        location: review,
        transcripts: transcriptsOf(name, flags),
        storage: {},
        now,
      };
      // The findings are decided with the focus on the second, the first one not decided yet.
      if (name === "findings") {
        scene.after = async () => {
          act(() => screen.getByRole("group", { name: /^Finding 2 of 3/ }).focus());
        };
      }
      // In the Apply mode nothing is published: the bar sends the approved findings to the agent.
      if ((name === "publish" || name === "clean") && flags.apply !== true) {
        scene.after = async () => {
          act(() => useAppStore.getState().openReviewDialog(REVIEW_ID, "publish"));
        };
      }
      return scene;
    }
  }
}
