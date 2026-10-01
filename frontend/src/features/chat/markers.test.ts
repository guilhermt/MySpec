import { describe, expect, it } from "vitest";
import {
  derivedDecidedLineOf,
  type MarkerContext,
  type MarkerView,
  markerOf,
  mergedLineOf,
  productMessageOf,
  startLineOf,
  voiceInSentence,
  voiceOf,
} from "@/features/chat/markers";
import type { Entry, MarkerEntry, PullRequest, TaskSummary, UserEntry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import {
  makeEntry,
  makeMarkerCommit,
  makePRCheck,
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

const ctx = (stage: string, rest: Partial<MarkerContext> = {}): MarkerContext => ({
  stage,
  task,
  review: null,
  latestReport: new Map(),
  oneShot: false,
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
      "a discussion",
      markerEntry({ type: "discussion_started" }),
      prompt({ text: "Should we cache the plans?" }),
      ctx("discussion", { task: null }),
      view("start", "Discussion started", {
        body: { kind: "markdown", text: "Should we cache the plans?" },
      }),
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
      ctx("pr_review"),
      view("file", "Review 1 written", {
        complement: "changes",
        body: { kind: "artifact", name: "pr/review-1.md", openIn: "details" },
      }),
    ],
    [
      "a clean report of the PR review",
      { type: "pr_review_written", pass: 2, clean: true },
      ctx("pr_review"),
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
      ctx("review", { task: null, review: applying }),
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
