import { describe, expect, it } from "vitest";
import {
  contextLineOf,
  type DiscussionInput,
  type DraftRowView,
  documentLineOf,
  publishedLineOf,
  type RoundFolds,
  revisedLineOf,
  roundFolds,
  roundLineOf,
  unreadableLineOf,
  writtenLineOf,
} from "@/features/chat/discussion-markers";
import {
  derivedDecidedLineOf,
  discussionOpeningOf,
  type MarkerContext,
  type MarkerView,
  markerOf,
  mergedLineOf,
  productMessageOf,
  startLineOf,
  voiceInSentence,
  voiceOf,
} from "@/features/chat/markers";
import type {
  DiscussionCard,
  Draft,
  DraftBefore,
  Entry,
  MarkerEntry,
  PRReport,
  PullRequest,
  TaskSummary,
  UserEntry,
} from "@/lib/wails";
import { clockTime } from "@/lib/when";
import {
  makeDiscussionCard,
  makeDraft,
  makeDraftRef,
  makeEntry,
  makeMarkerCommit,
  makePRCheck,
  makePRReport,
  makePullRequest,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeStep,
  makeTask,
  makeTaskCard,
  makeTextPRReport,
} from "@/test/wails-mock";

// A marker and a message as an old transcript keeps them: every field at its zero.
const MARKER: MarkerEntry = {
  type: "compacted",
  preTokens: 0,
  stage: "",
  step: 0,
  pass: 0,
  clean: false,
  findings: -1,
  restarted: false,
  percent: 0,
  attempts: 0,
  reason: "",
  interruptedBy: "",
  sha: "",
  subject: "",
  pushed: false,
  number: 0,
  base: "",
  passed: 0,
  total: 0,
  failed: [],
  conflict: false,
  title: "",
  files: 0,
  problems: [],
  model: "",
  effort: "",
  mode: "",
  approved: 0,
  discarded: 0,
  verdict: "",
  inline: 0,
  body: 0,
  summary: false,
  minimal: false,
  url: "",
  commits: [],
  count: 0,
  board: "",
  epics: [],
  round: 0,
  first: false,
  changed: 0,
  added: 0,
  dropped: 0,
  before: [],
};
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

const marker = (fields: Partial<MarkerEntry>): MarkerEntry => ({ ...MARKER, ...fields });
const markerEntry = (fields: Partial<MarkerEntry>): Entry =>
  makeEntry("marker", { marker: marker(fields) });
const user = (fields: Partial<UserEntry>): UserEntry => ({ ...USER, ...fields });
const prompt = (fields: Partial<UserEntry>): Entry =>
  makeEntry("user", { user: user({ prompt: true, ...fields }) });

const pr = (fields: Partial<PullRequest> = {}) =>
  makePullRequest({ prNumber: 1284, prBase: "dev", ...fields });
const task: TaskSummary = makeTask({
  repository: "acme/api",
  card: makeTaskCard({ repository: "acme/api", number: 412 }),
  steps: [
    makeStep({
      number: 3,
      file: "03-token-bucket.md",
      reports: [{ pass: 1, file: "03-token-bucket-1.md", clean: false, findings: 2 }],
    }),
  ],
  pr: pr({
    reports: [makeTextPRReport(1, false), makeTextPRReport(2, true)],
    draft: { title: "Limit requests per API key", body: "", file: "draft.md" },
  }),
});

// LATEST_PASSES says the marker read with no id is the latest of passes 1 and 2.
const LATEST_PASSES = new Map([
  [1, ""],
  [2, ""],
]);

const ctx = (stage: string, rest: Partial<MarkerContext> = {}): MarkerContext => ({
  stage,
  task,
  review: null,
  latestReport: new Map(),
  latestDecided: new Map(),
  oneShot: false,
  discussion: null,
  ...rest,
});

/** view is the expected line: the icon, the text and what differs from a line without complement or body. */
function view(icon: MarkerView["icon"], text: string, rest: Partial<MarkerView> = {}): MarkerView {
  return { icon, text, complement: "", body: { kind: "none" }, timeHidden: false, ...rest };
}

const FIRST_PASS = "pass 1 · the step, the PRD, the tech spec and the implementer's answer";

describe("voiceOf", () => {
  it.each([
    ["prd", "PRD agent"],
    ["tech_spec", "Tech spec agent"],
    ["plan", "Plan agent"],
    ["one_shot", "Planning agent"],
    ["step:3", "Implementer"],
    ["step_review:3", "Reviewer"],
    ["pr", "PR agent"],
    ["pr_review", "PR agent"],
    ["review", "Reviewer"],
    ["discussion", "Discussion agent"],
    ["closing", ""],
  ])("names who talks in %s: %j", (stage, expected) => {
    expect(voiceOf(stage)).toBe(expected);
  });
});

describe("voiceInSentence", () => {
  it.each([
    ["Implementer", "implementer"],
    ["Tech spec agent", "tech spec agent"],
    ["PRD agent", "PRD agent"],
    ["PR agent", "PR agent"],
    ["", ""],
  ])("writes %j inside a sentence as %j", (voice, expected) => {
    expect(voiceInSentence(voice)).toBe(expected);
  });
});

describe("startLineOf", () => {
  it.each<[string, Entry | null, Entry | null, MarkerContext, MarkerView]>([
    [
      "the PRD with its card",
      markerEntry({ type: "stage_started", stage: "prd" }),
      prompt({ text: "Limit each API key." }),
      ctx("prd"),
      view("start", "PRD started", {
        complement: "with the card acme/api#412",
        body: { kind: "markdown", text: "Limit each API key." },
      }),
    ],
    [
      "the PRD restarted from a description",
      markerEntry({ type: "stage_started", stage: "prd", restarted: true }),
      prompt({ text: "Limit each API key." }),
      ctx("prd", { task: makeTask() }),
      view("start", "PRD restarted", {
        complement: "with your description",
        body: { kind: "markdown", text: "Limit each API key." },
      }),
    ],
    [
      "the planning of a One-Shot task",
      markerEntry({ type: "stage_started", stage: "one_shot" }),
      prompt({ text: "" }),
      ctx("one_shot", { task: makeTask(), oneShot: true }),
      view("start", "Planning started", { complement: "with your description" }),
    ],
    [
      "the tech spec with the prompt it got",
      markerEntry({ type: "stage_started", stage: "tech_spec" }),
      prompt({ sent: "Write the tech spec." }),
      ctx("tech_spec"),
      view("start", "Tech spec started", {
        complement: "from PRD.md",
        body: { kind: "markdown", text: "Write the tech spec." },
      }),
    ],
    [
      "the tech spec of an old transcript, without the prompt it got",
      markerEntry({ type: "stage_started", stage: "tech_spec" }),
      prompt({}),
      ctx("tech_spec"),
      view("start", "Tech spec started", { complement: "from PRD.md" }),
    ],
    [
      "the plan",
      markerEntry({ type: "stage_started", stage: "plan" }),
      prompt({ sent: "Write the plan." }),
      ctx("plan"),
      view("start", "Plan started", {
        complement: "from PRD.md and tech-spec.md",
        body: { kind: "markdown", text: "Write the plan." },
      }),
    ],
    [
      "a step, with its file",
      markerEntry({ type: "step_started", step: 3 }),
      prompt({}),
      ctx("step:3"),
      view("start", "Started with", {
        complement: "steps/03-token-bucket.md",
        body: { kind: "artifact", name: "steps/03-token-bucket.md", openIn: "artifacts" },
      }),
    ],
    [
      "a step started over",
      markerEntry({ type: "step_started", step: 3, restarted: true }),
      prompt({}),
      ctx("step:3"),
      view("start", "Restarted with", {
        complement: "steps/03-token-bucket.md",
        body: { kind: "artifact", name: "steps/03-token-bucket.md", openIn: "artifacts" },
      }),
    ],
    [
      "a step whose file the task does not list",
      markerEntry({ type: "step_started", step: 9 }),
      prompt({}),
      ctx("step:9"),
      view("start", "Started with", { complement: "" }),
    ],
    [
      "the implementation of a One-Shot task",
      markerEntry({ type: "step_started", step: 1 }),
      prompt({}),
      ctx("step:1", { oneShot: true }),
      view("start", "Started with", {
        complement: "one-shot.md",
        body: { kind: "artifact", name: "one-shot.md", openIn: "artifacts" },
      }),
    ],
    [
      "the PR",
      markerEntry({ type: "stage_started", stage: "pr" }),
      prompt({ sent: "Write the draft." }),
      ctx("pr"),
      view("start", "PR started", {
        complement: "writes the draft from the branch",
        body: { kind: "markdown", text: "Write the draft." },
      }),
    ],
    [
      "the review of the pull request",
      markerEntry({ type: "stage_started", stage: "pr_review" }),
      prompt({ sent: "Review #1284." }),
      ctx("pr_review"),
      view("start", "PR review started", {
        complement: "pass 1 · #1284 into dev",
        body: { kind: "markdown", text: "Review #1284." },
      }),
    ],
    [
      "a review",
      markerEntry({
        type: "review_started",
        model: "claude-opus-5-5[1m]",
        effort: "high",
        mode: "publish",
      }),
      null,
      ctx("review", { task: null }),
      view("start", "Review started", { complement: "Opus 5.5 (1M) · high · Publish" }),
    ],
    [
      "a review to apply, whose prompt is the message of the user",
      markerEntry({
        type: "review_started",
        model: "claude-sonnet-5-5",
        effort: "medium",
        mode: "apply",
      }),
      prompt({ text: "Focus on the migrations." }),
      ctx("review", { task: null }),
      view("start", "Review started", { complement: "Sonnet 5.5 · medium · Apply" }),
    ],
    [
      "a review started before the marker kept its model",
      markerEntry({ type: "review_started" }),
      null,
      ctx("review", { task: null }),
      view("start", "Review started"),
    ],
    [
      "a discussion with its model, effort and board, whose prompt reads as the line Context",
      markerEntry({
        type: "discussion_started",
        model: "claude-opus-5-5[1m]",
        effort: "high",
        board: "Platform Roadmap",
      }),
      prompt({ text: "Should we cache the plans?" }),
      ctx("discussion", { task: null }),
      view("start", "Discussion started", {
        complement: "Opus 5.5 (1M) · high · Platform Roadmap",
      }),
    ],
    [
      "a discussion started before the marker kept its model",
      markerEntry({ type: "discussion_started" }),
      prompt({ text: "Should we cache the plans?" }),
      ctx("discussion", { task: null }),
      view("start", "Discussion started"),
    ],
    [
      "a marker whose prompt has not arrived",
      markerEntry({ type: "stage_started", stage: "plan" }),
      null,
      ctx("plan"),
      view("start", "Plan started", { complement: "from PRD.md and tech-spec.md" }),
    ],
    [
      "a prompt without its marker, from the stage",
      null,
      prompt({ text: "Limit each API key." }),
      ctx("prd"),
      view("start", "PRD started", {
        complement: "with the card acme/api#412",
        body: { kind: "markdown", text: "Limit each API key." },
      }),
    ],
    [
      "the first pass of a reviewer before its prompt",
      markerEntry({ type: "step_review_started", step: 3 }),
      null,
      ctx("step_review:3"),
      view("start", "MySpec → Reviewer", { complement: FIRST_PASS }),
    ],
  ])("reads %s", (_, start, first, context, expected) => {
    expect(startLineOf(start, first, context)).toEqual(expected);
  });
});

describe("productMessageOf", () => {
  const product = (complement: string, text = "The message.") =>
    view("product", "MySpec → Implementer", {
      complement,
      body: { kind: "markdown", text },
    });
  const app = (fields: Partial<UserEntry>) => user({ app: true, text: "The message.", ...fields });

  it.each<[string, UserEntry, MarkerView]>([
    [
      "a report with its findings",
      app({ appKind: "report", appPass: 1, appRound: 1, appRounds: 3, appCount: 2 }),
      product("Review 1 · 2 findings · round 1 of 3"),
    ],
    [
      "a report with one finding",
      app({ appKind: "report", appPass: 2, appRound: 2, appRounds: 3, appCount: 1 }),
      product("Review 2 · 1 finding · round 2 of 3"),
    ],
    [
      "a report whose findings were not counted",
      app({ appKind: "report", appPass: 1, appRound: 1, appRounds: 3, appCount: -1 }),
      product("Review 1 · round 1 of 3"),
    ],
    [
      "the next pass",
      app({ appKind: "pass", appPass: 2 }),
      product("pass 2 · the implementer is done with your last report"),
    ],
    ["a commit", app({ appKind: "commit" }), product("Commit · the staged files")],
    [
      "a commit after a clean report",
      app({ appKind: "commit_all" }),
      product("Commit · every change of the step"),
    ],
    [
      "a commit that pushes",
      app({ appKind: "commit_push" }),
      product("Commit and push · the staged files"),
    ],
    [
      "a correction of the plan",
      app({ appKind: "correction", appRound: 1, appRounds: 3, appCount: 3 }),
      product("The plan isn't valid yet · 3 problems · correction 1 of 3"),
    ],
    [
      "the opening of the pull request",
      app({ appKind: "open" }),
      product("Open the pull request · the approved draft"),
    ],
    [
      "the next pass of the review",
      app({ appKind: "pr_pass", appPass: 2 }),
      product("pass 2 · review the pull request again"),
    ],
    [
      "the approved findings",
      app({ appKind: "apply", appCount: 3 }),
      product("apply 3 approved findings"),
    ],
    [
      "a message of an old transcript",
      app({ text: "x".repeat(1341) }),
      product("a message · 1,341 characters", "x".repeat(1341)),
    ],
  ])("reads %s", (_, message, expected) => {
    expect(productMessageOf(message, "Implementer", ctx("step:3"))).toEqual(expected);
  });

  it.each([
    [false, FIRST_PASS],
    [true, "pass 1 · the One-Shot document and the implementer's answer"],
  ])("reads the first pass of the reviewer, One-Shot %s", (oneShot, complement) => {
    const first = user({ prompt: true, app: true, text: "Step 3 is done." });
    expect(productMessageOf(first, "Reviewer", ctx("step_review:3", { oneShot }))).toEqual(
      view("product", "MySpec → Reviewer", {
        complement,
        body: { kind: "markdown", text: "Step 3 is done." },
      }),
    );
  });

  it("opens nothing for an empty message", () => {
    expect(productMessageOf(user({ app: true }), "Implementer", ctx("step:3")).body).toEqual({
      kind: "none",
    });
  });
});

describe("markerOf", () => {
  const problems = [
    { file: "steps/02.md", message: "missing title" },
    { file: "steps/04.md", message: "no checklist" },
  ];

  it.each<[string, Partial<MarkerEntry>, MarkerContext, MarkerView | null]>([
    [
      "the PRD written",
      { type: "prd_written" },
      ctx("prd"),
      view("file", "Written PRD.md", {
        body: { kind: "artifact", name: "PRD.md", openIn: "artifacts" },
      }),
    ],
    [
      "the tech spec updated",
      { type: "tech_spec_updated" },
      ctx("tech_spec"),
      view("file", "Updated tech-spec.md", {
        body: { kind: "artifact", name: "tech-spec.md", openIn: "artifacts" },
      }),
    ],
    [
      "the One-Shot document written",
      { type: "one_shot_written" },
      ctx("one_shot"),
      view("file", "Written one-shot.md", {
        body: { kind: "artifact", name: "one-shot.md", openIn: "artifacts" },
      }),
    ],
    [
      "a document without its task",
      { type: "prd_updated" },
      ctx("prd", { task: null }),
      view("file", "Updated PRD.md"),
    ],
    [
      "the plan written",
      { type: "plan_written" },
      ctx("plan"),
      view("file", "Written the plan", { complement: "1 step file" }),
    ],
    ["the plan updated", { type: "plan_updated" }, ctx("plan"), view("file", "Updated the plan")],
    [
      "a report of the step review with its findings",
      { type: "step_review_written", pass: 1, findings: 2 },
      ctx("step_review:3"),
      view("file", "Review 1 written", {
        complement: "changes · 2 findings",
        body: { kind: "artifact", name: "step-reviews/03-token-bucket-1.md", openIn: "details" },
      }),
    ],
    [
      "a report of the step review without the count",
      { type: "step_review_written", pass: 2 },
      ctx("step_review:3"),
      view("file", "Review 2 written", { complement: "changes" }),
    ],
    [
      "a clean report of the step review",
      { type: "step_review_written", pass: 2, clean: true, findings: 0 },
      ctx("step:3"),
      view("file", "Review 2 written", { complement: "clean" }),
    ],
    [
      "a report of the PR review with changes",
      { type: "pr_review_written", pass: 1 },
      ctx("pr_review", { latestReport: LATEST_PASSES }),
      view("file", "Review 1 written", {
        complement: "changes",
        body: { kind: "artifact", name: "pr/review-1.md", openIn: "details" },
      }),
    ],
    [
      "a clean report of the PR review",
      { type: "pr_review_written", pass: 2, clean: true },
      ctx("pr_review", { latestReport: LATEST_PASSES }),
      view("file", "Review 2 written", {
        complement: "clean",
        body: { kind: "artifact", name: "pr/review-2.md", openIn: "details" },
      }),
    ],
    [
      "an old report of a review, without clean",
      { type: "pr_review_written", pass: 1 },
      ctx("review", { task: null }),
      view("file", "Review 1 written"),
    ],
    [
      "a commit",
      { type: "committed", sha: "c19f02e", subject: "Add the token bucket" },
      ctx("step:3"),
      view("commit", "Committed c19f02e", { complement: "Add the token bucket" }),
    ],
    [
      "a commit pushed to the pull request",
      {
        type: "committed",
        sha: "9ab31c0",
        subject: "Round Retry-After up",
        pushed: true,
        number: 1284,
      },
      ctx("pr_review"),
      view("commit", "Committed 9ab31c0", {
        complement: "Round Retry-After up · pushed to #1284",
      }),
    ],
    [
      "the pull request opened",
      { type: "pr_opened", number: 1284, base: "dev" },
      ctx("pr"),
      view("pullRequest", "Opened #1284", { complement: "into dev" }),
    ],
    [
      "the checks read before a pass",
      {
        type: "checks_read",
        pass: 1,
        passed: 4,
        total: 5,
        failed: ["e2e / rate-limit-burst"],
      },
      ctx("pr_review"),
      view("checks", "Checks read before pass 1", {
        complement: "4 of 5 passed · e2e / rate-limit-burst failed",
      }),
    ],
    [
      "no checks and a conflict",
      { type: "checks_read", pass: 2, conflict: true },
      ctx("pr_review"),
      view("checks", "Checks read before pass 2", { complement: "no checks · conflict with dev" }),
    ],
    [
      "the context compacted",
      { type: "compacted", preTokens: 162_000, percent: 81 },
      ctx("step:3"),
      view("compact", "Context compacted", { complement: "at 81%" }),
    ],
    [
      "the context compacted in an old transcript",
      { type: "compacted", preTokens: 162_000 },
      ctx("step:3"),
      view("compact", "Context compacted"),
    ],
    ["a pause", { type: "paused" }, ctx("step:3"), view("pause", "Paused by you")],
    [
      "a retry, which never shows its time",
      { type: "retried", attempts: 2, reason: "overloaded" },
      ctx("step:3"),
      view("retry", "Retried on its own", {
        complement: "the API was overloaded · 2 attempts",
        timeHidden: true,
      }),
    ],
    [
      "a retry of the rate limit",
      { type: "retried", attempts: 1, reason: "rate_limit" },
      ctx("step:3"),
      view("retry", "Retried on its own", {
        complement: "the rate limit was reached · 1 attempt",
        timeHidden: true,
      }),
    ],
    [
      "a retry of a server error",
      { type: "retried", attempts: 3, reason: "server" },
      ctx("step:3"),
      view("retry", "Retried on its own", {
        complement: "the API failed · 3 attempts",
        timeHidden: true,
      }),
    ],
    [
      "a retry of the connection",
      { type: "retried", attempts: 3, reason: "connection" },
      ctx("step:3"),
      view("retry", "Retried on its own", {
        complement: "the connection failed · 3 attempts",
        timeHidden: true,
      }),
    ],
    [
      "a retry for another reason",
      { type: "retried", attempts: 3, reason: "other" },
      ctx("step:3"),
      view("retry", "Retried on its own", {
        complement: "the API refused the request · 3 attempts",
        timeHidden: true,
      }),
    ],
    [
      "the draft approved",
      { type: "draft_approved", title: "Limit requests per API key" },
      ctx("pr"),
      view("check", "You approved the draft", {
        complement: "Limit requests per API key",
        body: { kind: "artifact", name: "pr/draft.md", openIn: "artifacts" },
      }),
    ],
    [
      "the changes approved",
      { type: "changes_approved", files: 3 },
      ctx("step:3"),
      view("check", "You approved the changes", { complement: "3 files staged" }),
    ],
    [
      "the plan still invalid",
      { type: "plan_invalid", problems },
      ctx("plan"),
      view("problem", "The plan is still invalid", {
        complement: "2 problems",
        body: { kind: "problems", problems },
      }),
    ],
    [
      "a turn you interrupted",
      { type: "interrupted", interruptedBy: "user" },
      ctx("step:3"),
      view("ban", "Interrupted by you"),
    ],
    [
      "a turn interrupted in an old transcript",
      { type: "interrupted" },
      ctx("step:3"),
      view("ban", "Interrupted"),
    ],
    [
      "a start marker alone",
      { type: "stage_started", stage: "tech_spec" },
      ctx("tech_spec"),
      view("start", "Tech spec started", { complement: "from PRD.md" }),
    ],
    [
      "the start of a step alone",
      { type: "step_started", step: 3 },
      ctx("step:3"),
      view("start", "Started with", {
        complement: "steps/03-token-bucket.md",
        body: { kind: "artifact", name: "steps/03-token-bucket.md", openIn: "artifacts" },
      }),
    ],
    [
      "the start of a reviewer alone",
      { type: "step_review_started", step: 3 },
      ctx("step_review:3"),
      view("start", "MySpec → Reviewer", { complement: FIRST_PASS }),
    ],
    ["a type the app does not know", { type: "rewound" }, ctx("step:3"), null],
  ])("reads %s", (_, fields, context, expected) => {
    expect(markerOf(marker(fields), context)).toEqual(expected);
  });
});

describe("markerOf in a review", () => {
  const NOW = Date.parse("2026-09-30T15:00:00Z");
  // The hour as the machine writes it: the same instant reads differently by time zone.
  const PUBLISHED = clockTime("2026-09-30T13:41:00Z", NOW);
  const findings = [
    makeReviewFinding({
      number: 1,
      title: "The token is never cleared",
      placement: "inline",
      decision: "approved",
    }),
    makeReviewFinding({
      number: 2,
      title: "No test",
      path: "",
      line: 0,
      placement: "body",
      decision: "approved",
    }),
    makeReviewFinding({ number: 3, title: "Naming", decision: "discarded" }),
  ];
  const review = makeReviewSummary({
    baseBranch: "origin/dev",
    passes: [
      makeReviewPass({
        pass: 1,
        findings,
        publishedAt: "2026-09-30T13:41:00Z",
        checks: [makePRCheck({ name: "lint", state: "failed" })],
        mergeable: "conflicting",
        checksReadAt: "2026-09-30T12:00:00Z",
      }),
      makeReviewPass({ pass: 2, checks: [], checksReadAt: "" }),
    ],
  });
  const inReview = ctx("review", {
    task: null,
    review,
    latestReport: new Map([[1, "entry-9"]]),
    latestDecided: new Map([[1, "entry-4"]]),
  });

  it.each([
    { type: "pr_review_written", findings: 3, want: "changes · 3 findings" },
    { type: "pr_review_written", findings: 1, want: "changes · 1 finding" },
    { type: "pr_review_written", findings: -1, want: "changes" },
    { type: "pr_review_written", clean: true, findings: 0, want: "clean" },
    { type: "pr_review_revised", findings: 2, want: "changes · 2 findings" },
  ])("reads the report $type with $findings findings as $want", ({ want, ...fields }) => {
    const read = markerOf(marker({ pass: 1, ...fields }), inReview, "entry-9", NOW);

    expect(read?.complement).toBe(want);
    expect(read?.text).toBe(
      fields.type === "pr_review_revised" ? "Review 1 revised" : "Review 1 written",
    );
  });

  it("opens the report of a pass only at its latest marker", () => {
    const written = marker({ type: "pr_review_written", pass: 1 });

    expect(markerOf(written, inReview, "entry-9", NOW)?.body).toEqual({
      kind: "artifact",
      name: "review-1.md",
      openIn: "reports",
    });
    expect(markerOf(written, inReview, "entry-3", NOW)?.body).toEqual({ kind: "none" });
  });

  it("opens the checks a pass started from, against the base of the pull request", () => {
    const read = markerOf(
      marker({
        type: "checks_read",
        pass: 1,
        passed: 0,
        total: 1,
        failed: ["lint"],
        conflict: true,
      }),
      inReview,
      "entry-2",
      NOW,
    );

    expect(read?.complement).toBe("0 of 1 passed · lint failed · conflict with dev");
    expect(read?.body).toEqual({
      kind: "checks",
      reading: {
        checks: review.passes?.[0]?.checks,
        mergeable: "conflicting",
        checkedAt: "2026-09-30T12:00:00Z",
        base: "dev",
      },
      summary: "0 of 1 passed · 1 failed · conflict with dev",
    });
  });

  it("opens no checks for a pass that kept none", () => {
    const read = markerOf(
      marker({ type: "checks_read", pass: 2, total: 0 }),
      inReview,
      "entry-2",
      NOW,
    );

    expect(read?.body).toEqual({ kind: "none" });
  });

  it("reads what the user decided and opens the findings where each went", () => {
    const read = markerOf(
      marker({ type: "findings_decided", pass: 1, approved: 2, discarded: 1 }),
      inReview,
      "entry-4",
      NOW,
    );

    expect(read).toMatchObject({
      icon: "check",
      text: "You decided",
      complement: "2 approved · 1 discarded",
    });
    expect(read?.body.kind).toBe("findings");
    const shown = read?.body.kind === "findings" ? read.body.findings : [];
    expect(shown.map((finding) => finding.disabled)).toEqual([
      `Inline comment · published ${PUBLISHED}`,
      `In the review body · published ${PUBLISHED}`,
      "Not published",
    ]);
    expect(shown[0]?.name).toBe(
      "Finding 1 of 3: The token is never cleared. src/login.ts, line 12. Approved.",
    );
  });

  it.each([
    { approved: 2, discarded: 0, want: "2 approved" },
    { approved: 0, discarded: 3, want: "3 discarded" },
    { approved: 0, discarded: 0, want: "nothing decided" },
  ])("drops the zero of $approved approved and $discarded discarded", ({ want, ...counts }) => {
    const read = markerOf(
      marker({ type: "findings_decided", pass: 1, ...counts }),
      inReview,
      "e",
      NOW,
    );

    expect(read?.complement).toBe(want);
  });

  it("says where a pass went in apply mode", () => {
    const applying = makeReviewSummary({
      mode: "apply",
      passes: [makeReviewPass({ pass: 1, findings, sent: true, sentAt: "2026-09-30T13:41:00Z" })],
    });
    const read = markerOf(
      marker({ type: "findings_decided", pass: 1, approved: 2, discarded: 1 }),
      ctx("review", { task: null, review: applying, latestDecided: new Map([[1, "e"]]) }),
      "e",
      NOW,
    );

    const shown = read?.body.kind === "findings" ? read.body.findings : [];
    expect(shown.map((finding) => finding.disabled)).toEqual([
      `Sent to the agent · ${PUBLISHED}`,
      `Sent to the agent · ${PUBLISHED}`,
      "Not sent",
    ]);
  });

  it("opens nothing for a decision the review does not hold", () => {
    const read = markerOf(
      marker({ type: "findings_decided", pass: 1, approved: 1 }),
      ctx("review", { task: null }),
      "e",
      NOW,
    );

    expect(read).toEqual(view("check", "You decided", { complement: "1 approved" }));
  });

  it.each([
    {
      name: "inline and the summary",
      fields: { verdict: "request_changes", inline: 2, summary: true },
      complement: "Request changes · 2 inline comments · the summary in the body",
    },
    {
      name: "the minimal body",
      fields: { verdict: "comment", inline: 1, minimal: true },
      complement: 'Comment · 1 inline comment · "Review with 1 inline comment." in the body',
    },
    {
      name: "a bare approval",
      fields: { verdict: "approve" },
      complement: "Approve · the verdict only",
    },
  ])("reads a review published with $name", ({ fields, complement }) => {
    const read = markerOf(
      marker({
        type: "review_published",
        pass: 2,
        url: "https://github.com/dev/web/pull/31#r1",
        ...fields,
      }),
      inReview,
      "e",
      NOW,
    );

    expect(read).toEqual(
      view("pullRequest", "Published pass 2", {
        complement,
        link: { label: "GitHub", url: "https://github.com/dev/web/pull/31#r1" },
      }),
    );
  });

  it("links to no review it has no address for", () => {
    const read = markerOf(
      marker({ type: "review_published", pass: 1, verdict: "approve" }),
      inReview,
      "e",
      NOW,
    );

    expect(read?.link).toBeUndefined();
  });

  it.each([
    {
      name: "commits by two people",
      fields: {
        count: 2,
        commits: [
          makeMarkerCommit(),
          makeMarkerCommit({ sha: "ab12cd3", subject: "Cover it", author: "tchen" }),
        ],
      },
      text: "2 new commits",
      complement: "by rsouza and tchen",
      body: {
        kind: "commits" as const,
        commits: [
          { sha: "c19f02e", subject: "Fix the time zone rule" },
          { sha: "ab12cd3", subject: "Cover it" },
        ],
        more: 0,
      },
    },
    {
      name: "one commit",
      fields: { count: 1, commits: [makeMarkerCommit({ subject: "Fix it" })] },
      text: "1 new commit",
      complement: "by rsouza",
      body: { kind: "commits" as const, commits: [{ sha: "c19f02e", subject: "Fix it" }], more: 0 },
    },
    {
      name: "a count that is not known",
      fields: { count: -1, commits: [makeMarkerCommit({ subject: "Fix it", author: "a" })] },
      text: "New commits",
      complement: "by a",
      body: { kind: "commits" as const, commits: [{ sha: "c19f02e", subject: "Fix it" }], more: 0 },
    },
  ])("reads $name", ({ fields, text, complement, body }) => {
    expect(markerOf(marker({ type: "new_commits", ...fields }), inReview, "e", NOW)).toEqual(
      view("commit", text, { complement, body }),
    );
  });

  it("lists the last twenty commits and counts the rest", () => {
    const commits = Array.from({ length: 32 }, (_, index) =>
      makeMarkerCommit({
        sha: `c${String(index).padStart(6, "0")}`,
        subject: `Commit ${index}`,
        author: ["a", "b", "a", "c"][index % 4] ?? "",
      }),
    );

    const read = markerOf(marker({ type: "new_commits", count: 32, commits }), inReview, "e", NOW);

    expect(read?.complement).toBe("by a, b and c");
    expect(read?.body).toMatchObject({ kind: "commits", more: 12 });
    expect(read?.body.kind === "commits" ? read.body.commits : []).toHaveLength(20);
    expect(read?.body.kind === "commits" ? read.body.commits[0]?.subject : "").toBe("Commit 12");
  });
});

describe("derivedDecidedLineOf", () => {
  it("counts the decisions of a pass from before the marker", () => {
    const pass = makeReviewPass({
      pass: 1,
      published: true,
      publishedAt: "2026-09-30T13:41:00Z",
      findings: [
        makeReviewFinding({ number: 1, decision: "approved", placement: "inline" }),
        makeReviewFinding({ number: 2, decision: "discarded" }),
      ],
    });
    const review = makeReviewSummary({ passes: [pass] });

    const line = derivedDecidedLineOf(review, pass, Date.parse("2026-09-30T15:00:00Z"));

    expect(line).toMatchObject({ text: "You decided", complement: "1 approved · 1 discarded" });
    expect(line.body.kind).toBe("findings");
  });
});

describe("mergedLineOf", () => {
  it.each<[string, Partial<PullRequest>, MarkerView | null]>([
    [
      "the merge, with who merged",
      { prState: "merged", mergedBy: "lnakamura", mergedAt: "2026-09-28T18:02:00Z" },
      view("merge", "Merged #1284 into dev", { complement: "by lnakamura" }),
    ],
    [
      "a merge read before who merged was kept",
      { prState: "merged" },
      view("merge", "Merged #1284 into dev"),
    ],
    [
      "a pull request closed without a merge",
      { prState: "closed" },
      view("merge", "Closed #1284 without a merge"),
    ],
    ["an open pull request", { prState: "open" }, null],
    ["a pull request not opened", { prNumber: 0, prState: "" }, null],
  ])("draws %s", (_, fields, expected) => {
    expect(mergedLineOf(pr(fields))).toEqual(expected);
  });
});

describe("markerOf in the PR review of a task", () => {
  const NOW = Date.parse("2026-09-30T15:00:00Z");
  const sent = makePRReport({
    pass: 1,
    file: "review-1.md",
    sentAt: "2026-09-30T14:36:00Z",
    findings: [
      makeReviewFinding({ number: 1, decision: "approved" }),
      makeReviewFinding({ number: 2, decision: "discarded" }),
    ],
  });
  const inTask = (reports: PRReport[], rest: Partial<MarkerContext> = {}) =>
    ctx("pr_review", { task: makeTask({ pr: pr({ reports }) }), ...rest });

  it.each([
    { fields: { findings: 4 }, want: "changes · 4 findings" },
    { fields: { findings: 1 }, want: "changes · 1 finding" },
    { fields: { findings: -1 }, want: "changes" },
    { fields: { clean: true, findings: 0 }, want: "clean" },
  ])("reads a structured report with $fields as $want", ({ fields, want }) => {
    const read = markerOf(
      marker({ type: "pr_review_written", pass: 1, ...fields }),
      inTask([sent]),
      "e",
      NOW,
    );

    expect(read?.complement).toBe(want);
  });

  it("reads a revised report and opens only the latest one", () => {
    const context = inTask([sent], { latestReport: new Map([[1, "e2"]]) });
    const revised = marker({ type: "pr_review_revised", pass: 1, findings: 5 });

    expect(markerOf(revised, context, "e2", NOW)).toMatchObject({
      text: "Review 1 revised",
      complement: "changes · 5 findings",
      body: { kind: "artifact", name: "pr/review-1.md", openIn: "details" },
    });
    expect(markerOf(revised, context, "e1", NOW)?.body).toEqual({ kind: "none" });
  });

  it("opens no report for a pass whose file isn't written", () => {
    const context = inTask([makePRReport({ file: "", recorded: false })], {
      latestReport: new Map([[1, "e"]]),
    });

    expect(
      markerOf(marker({ type: "pr_review_written", pass: 1 }), context, "e", NOW)?.body,
    ).toEqual({ kind: "none" });
  });

  it("reads a pass in text as changes", () => {
    const read = markerOf(
      marker({ type: "pr_review_written", pass: 1 }),
      inTask([makeTextPRReport(1, false)]),
      "e",
      NOW,
    );

    expect(read?.complement).toBe("changes");
  });

  it("opens the findings of a decision disabled with where each went, only at the latest line", () => {
    const decided = marker({ type: "findings_decided", pass: 1, approved: 1, discarded: 1 });
    const context = inTask([sent], { latestDecided: new Map([[1, "e2"]]) });

    const latest = markerOf(decided, context, "e2", NOW);
    const shown = latest?.body.kind === "findings" ? latest.body.findings : [];
    expect(latest?.complement).toBe("1 approved · 1 discarded");
    expect(shown.map((finding) => finding.disabled)).toEqual([
      `Sent to the agent · ${clockTime(sent.sentAt, NOW)}`,
      "Not sent",
    ]);
    expect(markerOf(decided, context, "e1", NOW)?.body).toEqual({ kind: "none" });
  });

  it("reads the message that applies the approved findings", () => {
    const read = productMessageOf(
      user({ app: true, appKind: "apply", appCount: 3 }),
      "PR agent",
      inTask([sent]),
    );

    expect(read.text).toBe("MySpec → PR agent");
    expect(read.complement).toBe("apply 3 approved findings");
  });
});

// The times are local, as the screen writes them.
const NOW = new Date(2026, 8, 24, 16, 0).getTime();
const at = (hour: number, minute: number) => new Date(2026, 8, 24, hour, minute).toISOString();

const draftOf = (id: string, overrides: Partial<Draft> = {}): Draft =>
  makeDraft({ id, title: `Title of ${id}`, position: Number(id.replace(/\D/g, "")), ...overrides });

const onGitHub = (id: string, number: number, overrides: Partial<Draft> = {}): Draft =>
  draftOf(id, {
    repository: "acme/billing",
    number,
    url: `https://github.com/acme/billing/issues/${number}`,
    decision: "approved",
    published: true,
    outcome: "created",
    publishedAt: at(15, 10),
    ...overrides,
  });

const cardsOf = (...numbers: number[]): DiscussionCard[] =>
  numbers.map((number) => makeDiscussionCard({ key: `acme/billing#${number}`, number }));

const input = (overrides: Partial<DiscussionInput> = {}): DiscussionInput => ({
  id: "discussion-1",
  drafts: [],
  text: "",
  cards: [],
  documentRevision: 0,
  documents: true,
  ...overrides,
});

const NO_FOLDS: RoundFolds = {
  current: 0,
  asRound: new Map(),
  hidden: new Set(),
  before: new Map(),
  cardAfter: "end",
  revisions: new Map(),
  latestDocument: "",
  epics: null,
};

const discussionCtx = (
  drafts: Draft[],
  folds: Partial<RoundFolds> = {},
  rest: Partial<DiscussionInput> = {},
): MarkerContext =>
  ctx("discussion", {
    task: null,
    discussion: { ...input({ drafts, ...rest }), folds: { ...NO_FOLDS, ...folds } },
  });

const row = (fields: Partial<DraftRowView>): DraftRowView => ({
  key: "",
  glyph: null,
  prefix: "",
  title: "",
  status: "",
  tone: "normal",
  link: null,
  ...fields,
});

describe("contextLineOf", () => {
  const prompted = user({ text: "a".repeat(5690), prompt: true });

  it.each<[string, DiscussionCard[], number | null, string]>([
    ["one card and its epic", cardsOf(455), 1, "#455 and its epic"],
    ["two cards and their epic", cardsOf(455, 461), 1, "#455, #461 and their epic"],
    ["two cards and their two epics", cardsOf(455, 461), 2, "#455, #461 and their 2 epics"],
    ["three cards and their epic", cardsOf(455, 461, 470), 1, "#455, #461, #470 and their epic"],
    [
      "four cards: the first three and a count, with the epic",
      cardsOf(455, 461, 470, 480),
      1,
      "#455, #461, #470 and 1 more card, with their epic",
    ],
    [
      "five cards with two epics",
      cardsOf(455, 461, 470, 480, 490),
      2,
      "#455, #461, #470 and 2 more cards, with their 2 epics",
    ],
    ["cards without an epic", cardsOf(455, 461), 0, "#455 and #461"],
    ["one card without an epic", cardsOf(455), 0, "#455"],
    ["three cards without an epic", cardsOf(455, 461, 470), 0, "#455, #461 and #470"],
    [
      "four cards without an epic",
      cardsOf(455, 461, 470, 480),
      0,
      "#455, #461, #470 and 1 more card",
    ],
    [
      "cards of a discussion from before the epics were recorded: no part of the epic",
      cardsOf(455, 461),
      null,
      "#455 and #461",
    ],
    ["no cards", [], null, "the board and your text"],
    ["no cards, whatever the epics", [], 1, "the board and your text"],
  ])("says %s", (_name, cards, epics, complement) => {
    expect(contextLineOf(prompted, input({ cards }), epics)).toEqual(
      view("file", "Context", {
        complement: `${complement} · 5,690 characters`,
        body: { kind: "discussionDocument", name: "context.md", text: "a".repeat(5690) },
      }),
    );
  });

  it("counts the characters by code point", () => {
    const line = contextLineOf(user({ text: "😀😀😀", prompt: true }), input(), null);

    expect(line.complement).toBe("the board and your text · 3 characters");
  });

  it("says where the context comes from and opens nothing without the prompt", () => {
    expect(contextLineOf(null, input({ cards: cardsOf(455) }), 1)).toEqual(
      view("file", "Context", { complement: "#455 and its epic" }),
    );
  });
});

describe("discussionOpeningOf", () => {
  it("gives the line Context and what the user wrote", () => {
    const folds = { ...NO_FOLDS, epics: 1 };
    const context: MarkerContext = ctx("discussion", {
      task: null,
      discussion: { ...input({ cards: cardsOf(455), text: "Cap the overage." }), folds },
    });
    const opening = discussionOpeningOf(prompt({ text: "The context." }), context);

    expect(opening.message).toBe("Cap the overage.");
    expect(opening.context).toEqual(
      view("file", "Context", {
        complement: "#455 and its epic · 12 characters",
        body: { kind: "discussionDocument", name: "context.md", text: "The context." },
      }),
    );
  });

  it("has no message when the user wrote nothing", () => {
    const opening = discussionOpeningOf(prompt({ text: "The context." }), discussionCtx([]));

    expect(opening.message).toBe("");
    expect(opening.context?.complement).toBe("the board and your text · 12 characters");
  });

  it("has the line without the prompt that hasn't arrived", () => {
    expect(discussionOpeningOf(null, discussionCtx([])).context).toEqual(
      view("file", "Context", { complement: "the board and your text" }),
    );
  });

  it("has nothing outside a discussion", () => {
    expect(discussionOpeningOf(prompt({ text: "x" }), ctx("prd"))).toEqual({
      context: null,
      message: "",
    });
  });
});

describe("documentLineOf", () => {
  it.each([
    [true, true, "Written discussion.md", true],
    [false, true, "Updated discussion.md", true],
    [true, false, "Written discussion.md", false],
    [false, false, "Updated discussion.md", false],
  ])("first %s, latest %s: %s, opens %s", (first, latest, text, opens) => {
    expect(documentLineOf(marker({ type: "discussion_document", first }), latest)).toEqual(
      view("file", text, {
        complement: "the understanding",
        body: opens
          ? { kind: "discussionDocument", name: "discussion.md", text: null }
          : { kind: "none" },
      }),
    );
  });
});

describe("writtenLineOf", () => {
  it.each([
    [5, "round 1 · 5 drafts"],
    [1, "round 1 · 1 draft"],
  ])("says %i drafts", (count, complement) => {
    expect(writtenLineOf(marker({ type: "drafts_written", round: 1, count }))).toEqual(
      view("file", "Drafts written", { complement }),
    );
  });
});

describe("unreadableLineOf", () => {
  it("says the reason", () => {
    expect(
      unreadableLineOf(
        marker({
          type: "drafts_unreadable",
          reason: "Draft invoice-overage: it has no ### Title.",
        }),
      ),
    ).toEqual(
      view("problem", "drafts.md can't be read", {
        complement: "Draft invoice-overage: it has no ### Title.",
      }),
    );
  });
});

describe("revisedLineOf", () => {
  const earlier = (fields: Partial<DraftBefore>): DraftBefore => ({
    title: "A draft",
    kind: "new",
    decision: "",
    outcome: "",
    reference: "",
    changes: [],
    dropped: false,
    added: false,
    approvalCleared: false,
    ...fields,
  });

  it.each([
    [{ changed: 3, added: 1, dropped: 1 }, "round 1 · 3 changed, 1 added, 1 dropped"],
    [{ changed: 3, added: 0, dropped: 0 }, "round 1 · 3 changed"],
    [{ changed: 0, added: 2, dropped: 0 }, "round 1 · 2 added"],
    [{ changed: 1, added: 0, dropped: 4 }, "round 1 · 1 changed, 4 dropped"],
    [{ changed: 0, added: 0, dropped: 0 }, "round 1"],
  ])("says the parts that aren't zero: %o", (counts, complement) => {
    const line = revisedLineOf(marker({ type: "drafts_revised", round: 1, ...counts }));

    expect(line.text).toBe("Drafts revised");
    expect(line.complement).toBe(complement);
    expect(line.body).toEqual({ kind: "none" });
  });

  it("opens the round as it was, a row for each, with what changed", () => {
    const line = revisedLineOf(
      marker({
        type: "drafts_revised",
        round: 1,
        changed: 2,
        added: 1,
        dropped: 1,
        before: [
          earlier({ title: "Overage", changes: ["title", "body"], decision: "approved" }),
          earlier({
            title: "Tier limits",
            changes: ["epic"],
            decision: "approved",
            approvalCleared: true,
          }),
          earlier({ title: "Export", dropped: true }),
          earlier({ title: "Invoice list", decision: "approved" }),
          earlier({ title: "Alerts", decision: "discarded" }),
          earlier({ title: "Undecided" }),
          earlier({
            title: "Billing page",
            decision: "approved",
            outcome: "created",
            reference: "acme/billing#479",
          }),
          earlier({ title: "Brand new", added: true }),
          earlier({
            title: "Rate limits",
            kind: "update",
            changes: ["cards"],
            reference: "acme/gateway#461",
          }),
          earlier({ title: "Pricing", kind: "epic", changes: ["cards"] }),
        ],
      }),
    );

    expect(line.body).toEqual({
      kind: "drafts",
      rows: [
        row({ key: "0·Overage", glyph: "pencil", title: "Overage", status: "title, body" }),
        row({
          key: "1·Tier limits",
          glyph: "pencil",
          title: "Tier limits",
          status: "epic · your approval was cleared",
        }),
        row({ key: "2·Export", title: "Export", status: "dropped by the agent", tone: "quiet" }),
        row({
          key: "3·Invoice list",
          title: "Invoice list",
          status: "not changed · approved",
          tone: "quiet",
        }),
        row({ key: "4·Alerts", title: "Alerts", status: "not changed · discarded", tone: "quiet" }),
        row({ key: "5·Undecided", title: "Undecided", status: "not changed", tone: "quiet" }),
        row({
          key: "6·Billing page",
          title: "Billing page",
          status: "Created billing#479",
          tone: "quiet",
        }),
        row({
          key: "7·Rate limits",
          glyph: "pencil",
          prefix: "Update gateway#461 · ",
          title: "Rate limits",
          status: "cards",
        }),
        row({
          key: "8·Pricing",
          glyph: "pencil",
          prefix: "Epic · ",
          title: "Pricing",
          status: "cards",
        }),
        row({ key: "9·Brand new", glyph: "pencil", title: "Brand new", status: "added" }),
      ],
    });
  });

  it("tells apart the rows that read the same, by their place", () => {
    const line = revisedLineOf(
      marker({
        type: "drafts_revised",
        round: 1,
        before: [earlier({ title: "", kind: "epic" }), earlier({ title: "", kind: "epic" })],
      }),
    );

    const rows = line.body.kind === "drafts" ? line.body.rows : [];
    expect(rows.map((one) => one.key)).toEqual(["0·", "1·"]);
  });

  it("has no body without a draft before", () => {
    expect(revisedLineOf(marker({ type: "drafts_revised", round: 1, before: [] })).body).toEqual({
      kind: "none",
    });
  });
});

describe("publishedLineOf", () => {
  it("says how many are out so far while a draft of the round isn't on GitHub or discarded", () => {
    const drafts = [
      onGitHub("d1", 479, { publishedAt: at(14, 29) }),
      onGitHub("d2", 480, { publishedAt: at(15, 12) }),
      draftOf("d3", { decision: "approved" }),
      draftOf("d4", { decision: "discarded" }),
    ];

    const line = publishedLineOf(1, drafts, NOW);

    expect(line).toMatchObject({
      icon: "pullRequest",
      text: "Published",
      complement: "round 1 · 2 so far",
      timeText: "14:29 – 15:12",
    });
    expect(line.tone).toBeUndefined();
  });

  it("says what the round published once every draft is settled", () => {
    const drafts = [
      onGitHub("d1", 479),
      onGitHub("d2", 480),
      onGitHub("d3", 481),
      onGitHub("d4", 482),
      onGitHub("d5", 461, { outcome: "updated", kind: "update" }),
      draftOf("d6", { decision: "discarded" }),
    ];

    expect(publishedLineOf(1, drafts, NOW)).toMatchObject({
      text: "Published",
      complement: "round 1 · 4 created, 1 updated",
      timeText: "15:10",
    });
  });

  it("says only one kind when the round published one", () => {
    expect(publishedLineOf(1, [onGitHub("d1", 479)], NOW).complement).toBe("round 1 · 1 created");
    expect(publishedLineOf(1, [onGitHub("d1", 461, { outcome: "updated" })], NOW).complement).toBe(
      "round 1 · 1 updated",
    );
  });

  it("says nothing was published when the round has no draft left but a discarded one", () => {
    expect(publishedLineOf(1, [draftOf("d1", { decision: "discarded" })], NOW).complement).toBe(
      "round 1 · nothing published",
    );
  });

  it("says where the publication stopped, with the error tone", () => {
    const drafts = [
      onGitHub("d1", 479),
      onGitHub("d2", 480),
      onGitHub("d3", 481),
      draftOf("d4", {
        title: "Overage on the monthly invoice",
        decision: "approved",
        publishError: "Rate limited.",
      }),
    ];

    expect(publishedLineOf(1, drafts, NOW)).toMatchObject({
      icon: "problem",
      text: "Publication stopped",
      complement: "round 1 · 3 published · Overage on the monthly invoice failed",
      tone: "error",
    });
  });

  it("leaves the count out when nothing was published, and counts the other failures", () => {
    const drafts = [
      draftOf("d1", { title: "Overage", decision: "approved", publishError: "No." }),
      draftOf("d2", { title: "Export", decision: "approved", publishError: "No." }),
    ];

    expect(publishedLineOf(1, drafts, NOW)).toMatchObject({
      complement: "round 1 · Overage and 1 more failed",
      tone: "error",
    });
    expect(publishedLineOf(1, drafts, NOW).timeText).toBeUndefined();
  });

  it("names the first failure in the order of the card, a card of an epic before a loose one", () => {
    const drafts = [
      draftOf("d1", { position: 1, title: "Loose", decision: "approved", publishError: "No." }),
      draftOf("d2", { position: 2, kind: "epic", title: "Pricing", decision: "approved" }),
      draftOf("d3", {
        position: 3,
        title: "Card of the epic",
        decision: "approved",
        publishError: "No.",
        epic: makeDraftRef({ draft: "d2" }),
      }),
    ];

    expect(publishedLineOf(1, drafts, NOW).complement).toBe(
      "round 1 · Card of the epic and 1 more failed",
    );
  });

  it("looks at the drafts of its round alone", () => {
    const drafts = [
      onGitHub("d1", 479, { round: 1 }),
      draftOf("d2", { round: 2, decision: "approved" }),
    ];

    expect(publishedLineOf(1, drafts, NOW).complement).toBe("round 1 · 1 created");
  });

  it("opens the list of the round in the order of the card, each draft by what became of it", () => {
    const epic = draftOf("d1", {
      kind: "epic",
      title: "Pricing",
      decision: "approved",
      hold: { reason: "epic_short", title: "", left: 0, approved: 1, cards: 3 },
    });
    const drafts = [
      draftOf("d9", { position: 9, title: "Loose" }),
      draftOf("d2", {
        position: 2,
        title: "Created one",
        decision: "approved",
        published: true,
        outcome: "created",
        repository: "acme/billing",
        number: 479,
        url: "https://github.com/acme/billing/issues/479",
        epic: makeDraftRef({ draft: "d1" }),
      }),
      epic,
      draftOf("d3", {
        position: 3,
        decision: "approved",
        publishing: true,
        title: "Running",
        epic: makeDraftRef({ draft: "d1" }),
      }),
      draftOf("d4", {
        position: 4,
        decision: "approved",
        title: "Next one",
        epic: makeDraftRef({ draft: "d1" }),
      }),
      draftOf("d5", {
        position: 5,
        title: "Waits",
        decision: "approved",
        hold: { reason: "epic", title: "", left: 0, approved: 0, cards: 0 },
        epic: makeDraftRef({ draft: "d1" }),
      }),
      draftOf("d6", {
        position: 6,
        title: "Waits for a draft",
        decision: "approved",
        hold: { reason: "draft", title: "Tier limits", left: 0, approved: 0, cards: 0 },
      }),
      draftOf("d7", {
        position: 7,
        title: "Waits for cards",
        kind: "epic",
        decision: "approved",
        hold: { reason: "cards", left: 2, title: "", approved: 0, cards: 0 },
      }),
      draftOf("d8", {
        position: 8,
        title: "Epic is out",
        decision: "approved",
        hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
      }),
      draftOf("d10", { position: 10, title: "Dropped", decision: "discarded" }),
      draftOf("d11", {
        position: 11,
        title: "Left the board",
        repositoryId: "",
      }),
      draftOf("d12", {
        position: 12,
        title: "Failed",
        decision: "approved",
        publishError: "Rate limited.",
      }),
      draftOf("d13", {
        position: 13,
        title: "Update",
        kind: "update",
        decision: "approved",
        published: true,
        outcome: "updated",
        repository: "acme/gateway",
        number: 461,
        url: "https://github.com/acme/gateway/issues/461",
        card: makeDiscussionCard({ repository: "acme/gateway", number: 461 }),
      }),
    ];

    const line = publishedLineOf(1, drafts, NOW);

    expect(line.body).toEqual({
      kind: "drafts",
      rows: [
        row({
          key: "d1",
          glyph: "hold",
          prefix: "Epic · ",
          title: "Pricing",
          status: "The epic needs two approved cards",
        }),
        row({
          key: "d2",
          glyph: "check",
          title: "Created one",
          status: "Created billing#479",
          link: { label: "billing#479", url: "https://github.com/acme/billing/issues/479" },
        }),
        row({ key: "d3", glyph: "spinner", title: "Running", status: "Publishing…" }),
        row({ key: "d4", title: "Next one", status: "Next", tone: "quiet" }),
        row({
          key: "d5",
          glyph: "hold",
          title: "Waits",
          status: "Waits for the epic",
          tone: "quiet",
        }),
        row({
          key: "d7",
          glyph: "hold",
          prefix: "Epic · ",
          title: "Waits for cards",
          status: "Waits for 2 more cards of the epic",
          tone: "quiet",
        }),
        row({
          key: "d6",
          glyph: "hold",
          title: "Waits for a draft",
          status: "Waits for Tier limits",
          tone: "quiet",
        }),
        row({
          key: "d8",
          glyph: "hold",
          title: "Epic is out",
          status: "The epic is discarded · not published",
          tone: "normal",
        }),
        row({ key: "d9", title: "Loose", status: "Not decided", tone: "quiet" }),
        row({ key: "d10", title: "Dropped", status: "Discarded · not published", tone: "quiet" }),
        row({
          key: "d11",
          glyph: "blocked",
          title: "Left the board",
          status: "Can't publish · the repository left the board",
          tone: "quiet",
        }),
        row({
          key: "d12",
          glyph: "error",
          title: "Failed",
          status: "Rate limited.",
          tone: "error",
        }),
        row({
          key: "d13",
          glyph: "check",
          prefix: "Update gateway#461 · ",
          title: "Update",
          status: "Updated gateway#461",
          link: { label: "gateway#461", url: "https://github.com/acme/gateway/issues/461" },
        }),
      ],
    });
  });
});

describe("publishedLineOf, the rows", () => {
  it("keys each row by its draft, also two untitled epics", () => {
    const drafts = [
      draftOf("d1", { kind: "epic", title: "", position: 1 }),
      draftOf("d2", { kind: "epic", title: "", position: 2 }),
    ];

    const { body } = publishedLineOf(1, drafts, NOW);

    expect(body.kind === "drafts" ? body.rows.map((one) => [one.key, one.title]) : []).toEqual([
      ["d1", "Untitled epic"],
      ["d2", "Untitled epic"],
    ]);
  });
});

describe("roundLineOf", () => {
  const round = [
    onGitHub("d1", 479, { round: 1 }),
    onGitHub("d2", 480, { round: 1 }),
    onGitHub("d3", 481, { round: 1 }),
    onGitHub("d4", 482, { round: 1 }),
    onGitHub("d5", 461, { round: 1, outcome: "updated" }),
    draftOf("d6", { round: 2 }),
  ];

  it.each([
    [0, "5 drafts · 4 created, 1 updated"],
    [1, "5 drafts, revised once · 4 created, 1 updated"],
    [2, "5 drafts, revised twice · 4 created, 1 updated"],
    [3, "5 drafts, revised 3 times · 4 created, 1 updated"],
  ])("says %i revisions", (revisions, complement) => {
    const line = roundLineOf(1, round, revisions);

    expect(line.text).toBe("Round 1");
    expect(line.complement).toBe(complement);
  });

  it("says nothing published when the whole round was discarded", () => {
    const drafts = [
      draftOf("d1", { decision: "discarded" }),
      draftOf("d2", { decision: "discarded" }),
    ];

    expect(roundLineOf(1, drafts, 1).complement).toBe("2 drafts, revised once · nothing published");
    expect(roundLineOf(1, drafts, 0).complement).toBe("2 drafts · nothing published");
  });

  it("opens the list of the round with the links, a discarded draft as Discarded", () => {
    const drafts = [
      onGitHub("d1", 479, { round: 1 }),
      draftOf("d2", { round: 1, position: 2, decision: "discarded" }),
      draftOf("d3", { round: 2 }),
    ];

    expect(roundLineOf(1, drafts, 0).body).toEqual({
      kind: "drafts",
      rows: [
        row({
          key: "d1",
          glyph: "check",
          title: "Title of d1",
          status: "Created billing#479",
          link: { label: "billing#479", url: "https://github.com/acme/billing/issues/479" },
        }),
        row({
          key: "d2",
          title: "Title of d2",
          status: "Discarded · not published",
          tone: "quiet",
        }),
      ],
    });
  });
});

describe("roundFolds", () => {
  const entry = (id: string, fields: Partial<MarkerEntry>): Entry =>
    makeEntry("marker", { id, marker: marker(fields) });
  const two = [draftOf("d1", { round: 1 }), draftOf("d2", { round: 2 })];

  it("folds a published round into its publication and hides the rest of it", () => {
    const entries = [
      entry("start", { type: "discussion_started" }),
      entry("w1", { type: "drafts_written", round: 1, count: 5 }),
      entry("r1", { type: "drafts_revised", round: 1, changed: 1 }),
      entry("p1", { type: "drafts_published", round: 1 }),
      entry("w2", { type: "drafts_written", round: 2, count: 1 }),
    ];

    const folds = roundFolds(entries, two);

    expect(folds.current).toBe(2);
    expect([...folds.asRound]).toEqual([["p1", 1]]);
    expect([...folds.hidden].sort()).toEqual(["r1", "w1"]);
    expect([...folds.before]).toEqual([]);
    expect(folds.cardAfter).toBe("w2");
    expect([...folds.revisions]).toEqual([[1, 1]]);
  });

  it("folds a round whose drafts were all discarded into its Drafts written", () => {
    const entries = [
      entry("w1", { type: "drafts_written", round: 1, count: 2 }),
      entry("r1", { type: "drafts_revised", round: 1 }),
      entry("w2", { type: "drafts_written", round: 2, count: 1 }),
    ];

    const folds = roundFolds(entries, two);

    expect([...folds.asRound]).toEqual([["w1", 1]]);
    expect([...folds.hidden]).toEqual(["r1"]);
    expect([...folds.before]).toEqual([]);
  });

  it("folds a round emptied and written again into its first Drafts written, hiding the second", () => {
    const entries = [
      entry("w1", { type: "drafts_written", round: 1, count: 2 }),
      entry("r1", { type: "drafts_revised", round: 1, dropped: 2 }),
      entry("w1b", { type: "drafts_written", round: 1, count: 1 }),
      entry("p1", { type: "drafts_published", round: 1 }),
      entry("w2", { type: "drafts_written", round: 2, count: 1 }),
    ];
    const unpublished = entries.filter((one) => one.id !== "p1");

    const published = roundFolds(entries, two);
    const discarded = roundFolds(unpublished, two);

    expect([...published.asRound]).toEqual([["p1", 1]]);
    expect([...published.hidden].sort()).toEqual(["r1", "w1", "w1b"]);
    expect([...discarded.asRound]).toEqual([["w1", 1]]);
    expect([...discarded.hidden].sort()).toEqual(["r1", "w1b"]);
    expect([...discarded.before]).toEqual([]);
  });

  it("keeps both Drafts written of a current round emptied and written again, the card after the second", () => {
    const entries = [
      entry("w1", { type: "drafts_written", round: 1, count: 2 }),
      entry("r1", { type: "drafts_revised", round: 1, dropped: 2 }),
      entry("w1b", { type: "drafts_written", round: 1, count: 1 }),
    ];

    const folds = roundFolds(entries, [draftOf("d3", { round: 1 })]);

    expect([...folds.asRound]).toEqual([]);
    expect([...folds.hidden]).toEqual([]);
    expect(folds.cardAfter).toBe("w1b");
  });

  it("folds a round of a discussion from before the task before the Drafts written of the next", () => {
    const entries = [
      entry("start", { type: "discussion_started" }),
      entry("w2", { type: "drafts_written", round: 2, count: 1 }),
    ];

    const folds = roundFolds(entries, two);

    expect([...folds.before]).toEqual([["w2", 1]]);
    expect([...folds.asRound]).toEqual([]);
    expect([...folds.hidden]).toEqual([]);
  });

  it("folds that round before the card when the next round has no marker either", () => {
    const folds = roundFolds([entry("start", { type: "discussion_started" })], two);

    expect([...folds.before]).toEqual([["end", 1]]);
  });

  it("folds nothing in the first round, and keeps every marker of the current one", () => {
    const entries = [
      entry("w1", { type: "drafts_written", round: 1, count: 2 }),
      entry("p1", { type: "drafts_published", round: 1 }),
    ];

    const folds = roundFolds(entries, [draftOf("d1", { round: 1 })]);

    expect(folds.current).toBe(1);
    expect([...folds.asRound]).toEqual([]);
    expect([...folds.hidden]).toEqual([]);
    expect([...folds.before]).toEqual([]);
  });

  it("has no round without drafts", () => {
    const folds = roundFolds([], []);

    expect(folds.current).toBe(0);
    expect(folds.cardAfter).toBe("end");
  });

  it("puts the card after the latest of the Drafts written and Drafts revised of the current round", () => {
    const entries = [
      entry("w1", { type: "drafts_written", round: 1 }),
      entry("r1", { type: "drafts_revised", round: 1 }),
      entry("r2", { type: "drafts_revised", round: 1 }),
      entry("document", { type: "discussion_document", first: true }),
    ];

    expect(roundFolds(entries, [draftOf("d1", { round: 1 })]).cardAfter).toBe("r2");
  });

  it("puts the card at the end without either marker", () => {
    expect(
      roundFolds(
        [entry("document", { type: "discussion_document" })],
        [draftOf("d1", { round: 1 })],
      ).cardAfter,
    ).toBe("end");
  });

  it("never folds the drafts that can't be read", () => {
    const entries = [
      entry("u1", { type: "drafts_unreadable", round: 1, reason: "No title." }),
      entry("p1", { type: "drafts_published", round: 1 }),
      entry("w2", { type: "drafts_written", round: 2 }),
    ];

    const folds = roundFolds(entries, two);

    expect(folds.hidden.has("u1")).toBe(false);
    expect(folds.asRound.has("u1")).toBe(false);
  });

  it("counts the revisions of each round", () => {
    const entries = [
      entry("r1", { type: "drafts_revised", round: 1 }),
      entry("r2", { type: "drafts_revised", round: 1 }),
      entry("r3", { type: "drafts_revised", round: 2 }),
    ];

    expect([...roundFolds(entries, two).revisions]).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("finds the latest document", () => {
    const entries = [
      entry("d1", { type: "discussion_document", first: true }),
      entry("d2", { type: "discussion_document" }),
    ];

    expect(roundFolds(entries, []).latestDocument).toBe("d2");
    expect(roundFolds([], []).latestDocument).toBe("");
  });

  it.each([
    ["the epics the start recorded", { model: "claude-opus-5-5", epics: ["a", "b"] }, 2],
    ["a start that recorded its model and no epics", { model: "claude-opus-5-5", epics: [] }, 0],
    ["a start that recorded epics without a model", { epics: ["a"] }, 1],
    ["a start from before the task: neither", {}, null],
  ])("reads %s", (_name, fields, epics) => {
    const folds = roundFolds([entry("start", { type: "discussion_started", ...fields })], []);

    expect(folds.epics).toBe(epics);
  });

  it("has no epics without a start", () => {
    expect(roundFolds([], []).epics).toBeNull();
  });
});

describe("markerOf in a discussion", () => {
  const dctx = (folds: Partial<RoundFolds> = {}, drafts: Draft[] = []) =>
    discussionCtx(drafts, { current: 2, ...folds });

  it.each([
    "discussion_document",
    "drafts_written",
    "drafts_revised",
    "drafts_unreadable",
    "drafts_published",
  ])("draws nothing for %s outside a discussion", (type) => {
    expect(markerOf(marker({ type, round: 1 }), ctx("prd"), "e", NOW)).toBeNull();
    expect(
      markerOf(marker({ type, round: 1 }), ctx("discussion", { task: null }), "e", NOW),
    ).toBeNull();
  });

  it("draws the lines of the markers of the drafts", () => {
    const drafts = [onGitHub("d1", 479, { round: 2 })];
    const context = dctx({ latestDocument: "doc" }, drafts);

    expect(
      markerOf(marker({ type: "drafts_written", round: 2, count: 1 }), context, "w", NOW)?.text,
    ).toBe("Drafts written");
    expect(
      markerOf(marker({ type: "drafts_revised", round: 2, changed: 1 }), context, "r", NOW)?.text,
    ).toBe("Drafts revised");
    expect(
      markerOf(marker({ type: "drafts_unreadable", reason: "No title." }), context, "u", NOW)?.text,
    ).toBe("drafts.md can't be read");
    expect(
      markerOf(marker({ type: "drafts_published", round: 2 }), context, "p", NOW),
    ).toMatchObject({
      text: "Published",
      complement: "round 2 · 1 created",
    });
  });

  it("opens the document only on the latest marker", () => {
    const context = dctx({ latestDocument: "doc2" });

    expect(
      markerOf(marker({ type: "discussion_document", first: true }), context, "doc1", NOW)?.body,
    ).toEqual({ kind: "none" });
    expect(markerOf(marker({ type: "discussion_document" }), context, "doc2", NOW)?.body).toEqual({
      kind: "discussionDocument",
      name: "discussion.md",
      text: null,
    });
  });

  it("draws nothing for what a folded round leaves", () => {
    const context = dctx({ hidden: new Set(["w1", "r1"]) });

    expect(markerOf(marker({ type: "drafts_written", round: 1 }), context, "w1", NOW)).toBeNull();
    expect(markerOf(marker({ type: "drafts_revised", round: 1 }), context, "r1", NOW)).toBeNull();
  });

  it("draws the publication, or the Drafts written, of a folded round as Round N", () => {
    const drafts = [onGitHub("d1", 479, { round: 1 }), draftOf("d2", { round: 2 })];
    const context = dctx(
      {
        asRound: new Map([
          ["p1", 1],
          ["w1", 1],
        ]),
        revisions: new Map([[1, 2]]),
      },
      drafts,
    );

    expect(
      markerOf(marker({ type: "drafts_published", round: 1 }), context, "p1", NOW),
    ).toMatchObject({
      text: "Round 1",
      complement: "1 draft, revised twice · 1 created",
    });
    expect(
      markerOf(marker({ type: "drafts_written", round: 1 }), context, "w1", NOW),
    ).toMatchObject({
      text: "Round 1",
    });
  });
});
