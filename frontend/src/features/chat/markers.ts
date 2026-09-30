import type { FindingView } from "@/components/system/Finding";
import { publishedGoes, verdictName } from "@/features/reviews/publish";
import { findingViews } from "@/features/reviews/review-conversation";
import { modelLabel } from "@/lib/models";
import { baseName, type ChecksReading, checksSummary, prBaseName } from "@/lib/pull-requests";
import { lowerFirst } from "@/lib/situations";
import { asLifecycleStage, stageLabel } from "@/lib/stages";
import type {
  Entry,
  MarkerEntry,
  MarkerType,
  PlanProblem,
  PullRequest,
  ReviewPass,
  ReviewSummary,
  TaskSummary,
  UserEntry,
} from "@/lib/wails";
import {
  asAppKind,
  asInterruptedBy,
  asMarkerType,
  asPRState,
  asRetryReason,
  DISCUSSION_STAGE,
  REVIEW_STAGE,
} from "@/lib/wails";

/** MarkerIcon is the icon of a line of the conversation, a meaning of ICONS. */
export type MarkerIcon =
  | "file"
  | "start"
  | "product"
  | "commit"
  | "pullRequest"
  | "checks"
  | "compact"
  | "pause"
  | "retry"
  | "check"
  | "problem"
  | "ban"
  | "merge";

/**
 * MarkerBody is what a line opens in place: nothing; Markdown (a prompt, an initial context, a
 * message of the product); a document of the task or of the review, read on opening, with the panel
 * of its foot; the problems of a plan; the checks a pass started from; the findings a pass decided;
 * or the commits that reached a pull request.
 */
export type MarkerBody =
  | { kind: "none" }
  | { kind: "markdown"; text: string }
  | { kind: "artifact"; name: string; openIn: "artifacts" | "details" | "reports" }
  | { kind: "problems"; problems: PlanProblem[] }
  | { kind: "checks"; reading: ChecksReading; summary: string }
  | { kind: "findings"; pass: number; findings: FindingView[] }
  | { kind: "commits"; commits: { sha: string; subject: string }[]; more: number };

/** MarkerView is a line of the conversation: a marker, a start line, a message of the product. */
export interface MarkerView {
  icon: MarkerIcon;
  /** text is "Committed c19f02e", "MySpec → Reviewer". */
  text: string;
  /** complement is what follows the text, in the quiet tone; "" when none. */
  complement: string;
  body: MarkerBody;
  /** link is the external action of the line, drawn on the right before the time. */
  link?: { label: string; url: string };
  /** timeHidden says the line never shows its time, not even on hover: a retry. */
  timeHidden: boolean;
}

/** MarkerContext is what a line needs to know about its conversation. */
export interface MarkerContext {
  /** stage is the session key of the conversation: prd, step:3, step_review:3, review… */
  stage: string;
  /** task is the task of the conversation, null in a review and a discussion. */
  task: TaskSummary | null;
  /** review is the review of the conversation, null in a task and a discussion. */
  review: ReviewSummary | null;
  /** latestReport is the id of the latest report marker of each pass of a review; empty elsewhere. */
  latestReport: ReadonlyMap<number, string>;
  oneShot: boolean;
}

// The voices of the conversations with a single session key.
const VOICES: Record<string, string> = {
  prd: "PRD agent",
  tech_spec: "Tech spec agent",
  plan: "Plan agent",
  one_shot: "Planning agent",
  pr: "PR agent",
  pr_review: "PR agent",
  [REVIEW_STAGE]: "Reviewer",
  [DISCUSSION_STAGE]: "Discussion agent",
};

/** voiceOf is the word of who talks in a conversation, by its stage key: "Implementer", "Reviewer", "PRD agent"… */
export function voiceOf(stage: string): string {
  if (stage.startsWith("step_review:")) {
    return "Reviewer";
  }
  if (stage.startsWith("step:")) {
    return "Implementer";
  }
  return VOICES[stage] ?? "";
}

/** voiceInSentence is the voice inside a sentence: "implementer", "tech spec agent"; an acronym keeps its capitals, "PRD agent". */
export function voiceInSentence(voice: string): string {
  return lowerFirst(voice);
}

const NONE: MarkerBody = { kind: "none" };

// counted is a count with its noun: "1 finding", "3 findings".
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// parts joins the parts of a complement that say something.
function parts(...all: string[]): string {
  return all.filter((part) => part !== "").join(" · ");
}

// markdownOf is a text to open in place, nothing when it is empty.
function markdownOf(text: string): MarkerBody {
  return text.trim() === "" ? NONE : { kind: "markdown", text };
}

// line is a view that shows its time on hover and focus.
function line(
  icon: MarkerIcon,
  text: string,
  complement = "",
  body: MarkerBody = NONE,
): MarkerView {
  return { icon, text, complement, body, timeHidden: false };
}

// stepNumberOf is the number of the step of a stage key, step:3 or step_review:3; null for any other.
function stepNumberOf(stage: string): number | null {
  const match = /^step(?:_review)?:(\d+)$/.exec(stage);
  return match === null ? null : Number(match[1]);
}

// firstPassComplement is what the first message to the reviewer carries.
function firstPassComplement(oneShot: boolean): string {
  return oneShot
    ? "pass 1 · the One-Shot document and the implementer's answer"
    : "pass 1 · the step, the PRD, the tech spec and the implementer's answer";
}

// StartOf is what opened a conversation: its marker, or for a prompt without
// one, what the stage of the conversation says it was.
type StartOf = Pick<MarkerEntry, "type" | "stage" | "step" | "restarted"> &
  Partial<Pick<MarkerEntry, "model" | "effort" | "mode">>;

function startOfStage(stage: string): StartOf {
  const step = stepNumberOf(stage) ?? 0;
  const type: MarkerType = stage.startsWith("step_review:")
    ? "step_review_started"
    : stage.startsWith("step:")
      ? "step_started"
      : stage === REVIEW_STAGE
        ? "review_started"
        : stage === DISCUSSION_STAGE
          ? "discussion_started"
          : "stage_started";
  return { type, stage, step, restarted: false };
}

// stepStart is the start line of a step: the file it started with.
function stepStart(start: StartOf, ctx: MarkerContext): MarkerView {
  const text = start.restarted ? "Restarted with" : "Started with";
  if (ctx.oneShot) {
    const body: MarkerBody =
      ctx.task === null ? NONE : { kind: "artifact", name: "one-shot.md", openIn: "artifacts" };
    return line("start", text, "one-shot.md", body);
  }
  const step = (ctx.task?.steps ?? []).find((one) => one.number === start.step);
  if (step === undefined) {
    return line("start", text);
  }
  const name = `steps/${step.file}`;
  return line("start", text, name, { kind: "artifact", name, openIn: "artifacts" });
}

// stageComplement is what the start line of a stage says it started from.
function stageComplement(stage: string, task: TaskSummary | null): string {
  switch (stage) {
    case "prd":
    case "one_shot": {
      const card = task?.card ?? null;
      return card === null
        ? "with your description"
        : `with the card ${card.repository}#${card.number}`;
    }
    case "tech_spec":
      return "from PRD.md";
    case "plan":
      return "from PRD.md and tech-spec.md";
    case "pr":
      return "writes the draft from the branch";
    case "pr_review": {
      const pr = task?.pr ?? null;
      return pr === null || pr.prNumber === 0
        ? "pass 1"
        : `pass 1 · #${pr.prNumber} into ${prBaseName(pr)}`;
    }
    default:
      return "";
  }
}

// stageStart is the start line of a planning stage or of the PR stage.
function stageStart(start: StartOf, prompt: UserEntry | null, ctx: MarkerContext): MarkerView {
  const stage = start.stage !== "" ? start.stage : ctx.stage;
  const known = asLifecycleStage(stage);
  const name = known === null ? "Stage" : stageLabel(known);
  // The PRD and the planning open with what the user wrote; the other stages
  // with the prompt the session got, kept only since it is recorded.
  const opened = stage === "prd" || stage === "one_shot" ? prompt?.text : prompt?.sent;
  return line(
    "start",
    `${name} ${start.restarted ? "restarted" : "started"}`,
    stageComplement(stage, ctx.task),
    markdownOf(opened ?? ""),
  );
}

function startView(start: StartOf, prompt: UserEntry | null, ctx: MarkerContext): MarkerView {
  switch (start.type) {
    case "step_started":
      return stepStart(start, ctx);
    // The first pass of a reviewer reads as the message of the product it is;
    // alone, before its prompt arrives, it opens nothing.
    case "step_review_started":
      return line(
        "start",
        `MySpec → ${voiceOf(ctx.stage)}`,
        firstPassComplement(ctx.oneShot),
        markdownOf(prompt?.text ?? ""),
      );
    // What the user wrote for the first pass reads as their own message after this line.
    case "review_started":
      return line(
        "start",
        "Review started",
        parts(
          modelLabel(start.model ?? ""),
          start.effort ?? "",
          start.mode === "publish" ? "Publish" : start.mode === "apply" ? "Apply" : "",
        ),
      );
    case "discussion_started":
      return line("start", "Discussion started", "", markdownOf(prompt?.text ?? ""));
    default:
      return stageStart(start, prompt, ctx);
  }
}

/**
 * startLineOf is the one line of the marker that opens a conversation and the
 * prompt that follows it (table Linhas de início). Either can be missing: a
 * marker whose prompt has not arrived opens nothing, and a prompt without a
 * marker reads from the stage of the conversation.
 */
export function startLineOf(
  marker: Entry | null,
  prompt: Entry | null,
  ctx: MarkerContext,
): MarkerView {
  const start = marker?.marker ?? startOfStage(ctx.stage);
  return startView(start, prompt?.user ?? null, ctx);
}

// appComplement is what a message of the product says it is (table Mensagens do produto).
function appComplement(user: UserEntry): string {
  switch (asAppKind(user.appKind)) {
    case "report":
      return user.appCount < 0
        ? `Review ${user.appPass} · round ${user.appRound} of ${user.appRounds}`
        : `Review ${user.appPass} · ${counted(user.appCount, "finding")} · round ${user.appRound} of ${user.appRounds}`;
    case "pass":
      return `pass ${user.appPass} · the implementer is done with your last report`;
    case "commit":
      return "Commit · the staged files";
    case "commit_all":
      return "Commit · every change of the step";
    case "commit_push":
      return "Commit and push · the staged files";
    case "correction":
      return `The plan isn't valid yet · ${counted(user.appCount, "problem")} · correction ${user.appRound} of ${user.appRounds}`;
    case "open":
      return "Open the pull request · the approved draft";
    case "pr_pass":
      return `pass ${user.appPass} · review the pull request again`;
    case "apply":
      return `apply ${counted(user.appCount, "approved finding")}`;
    case "": {
      const length = user.text.length;
      return `a message · ${length.toLocaleString("en-US")} character${length === 1 ? "" : "s"}`;
    }
  }
}

/** productMessageOf is a message the product sent the agent: "MySpec → Implementer" and what it is. */
export function productMessageOf(user: UserEntry, voice: string, ctx: MarkerContext): MarkerView {
  // The first message to the reviewer is its prompt, which carries the implementer's answer.
  const complement =
    user.prompt && user.app ? firstPassComplement(ctx.oneShot) : appComplement(user);
  return line("product", `MySpec → ${voice}`, complement, markdownOf(user.text));
}

// artifactOf is a document of the task to open, nothing without the task.
function artifactOf(
  ctx: MarkerContext,
  name: string,
  openIn: "artifacts" | "details" | "reports",
): MarkerBody {
  return ctx.task === null ? NONE : { kind: "artifact", name, openIn };
}

// documentLine is the marker of a document written or updated.
function documentLine(written: boolean, name: string, ctx: MarkerContext): MarkerView {
  return line(
    "file",
    `${written ? "Written" : "Updated"} ${name}`,
    "",
    artifactOf(ctx, name, "artifacts"),
  );
}

// stepReviewLine is the report of a pass of the review of a step, opened from its file.
function stepReviewLine(marker: MarkerEntry, ctx: MarkerContext): MarkerView {
  const verdict = marker.clean
    ? "clean"
    : marker.findings > 0
      ? `changes · ${counted(marker.findings, "finding")}`
      : "changes";
  const number = stepNumberOf(ctx.stage);
  const step = (ctx.task?.steps ?? []).find((one) => one.number === number);
  const report = (step?.reports ?? []).find((one) => one.pass === marker.pass);
  const body: MarkerBody =
    report === undefined
      ? NONE
      : { kind: "artifact", name: `step-reviews/${report.file}`, openIn: "details" };
  return line("file", `Review ${marker.pass} written`, verdict, body);
}

// prReviewLine is the report of a pass of the review of a pull request, written or rewritten. A
// marker recorded before it kept clean says nothing but its pass, unless the report of the pass tells.
function prReviewLine(marker: MarkerEntry, ctx: MarkerContext, entryId: string): MarkerView {
  const revised = marker.type === "pr_review_revised";
  const text = `Review ${marker.pass} ${revised ? "revised" : "written"}`;
  if (ctx.review !== null) {
    const verdict = marker.clean
      ? "clean"
      : marker.findings >= 0
        ? `changes · ${counted(marker.findings, "finding")}`
        : "changes";
    // Only the latest marker of a pass opens its report: the file is the one that stands.
    const body: MarkerBody =
      ctx.latestReport.get(marker.pass) === entryId
        ? { kind: "artifact", name: `review-${marker.pass}.md`, openIn: "reports" }
        : NONE;
    return line("file", text, verdict, body);
  }
  const report = (ctx.task?.pr?.reports ?? []).find((one) => one.pass === marker.pass);
  const verdict =
    marker.clean || report?.clean === true ? "clean" : report === undefined ? "" : "changes";
  const body: MarkerBody =
    report === undefined
      ? NONE
      : { kind: "artifact", name: `pr/${report.file}`, openIn: "details" };
  return line("file", text, verdict, body);
}

// checksLine is what the checks said before a pass of the review of a pull request. In a review it
// opens the checks the pass started from.
function checksLine(marker: MarkerEntry, ctx: MarkerContext): MarkerView {
  const failed = marker.failed ?? [];
  const pr = ctx.task?.pr ?? null;
  const base =
    ctx.review !== null ? baseName(ctx.review.baseBranch) : pr === null ? "" : prBaseName(pr);
  const conflict = base === "" ? "conflict" : `conflict with ${base}`;
  return line(
    "checks",
    `Checks read before pass ${marker.pass}`,
    parts(
      marker.total === 0 ? "no checks" : `${marker.passed} of ${marker.total} passed`,
      failed.length > 0 ? `${failed.join(", ")} failed` : "",
      marker.conflict ? conflict : "",
    ),
    checksBody(marker.pass, ctx.review, base),
  );
}

// checksBody is the checks a pass of a review started from, nothing for a pass that kept none.
function checksBody(pass: number, review: ReviewSummary | null, base: string): MarkerBody {
  const stored = (review?.passes ?? []).find((one) => one.pass === pass);
  if (stored === undefined || stored.checksReadAt === "") {
    return NONE;
  }
  const reading: ChecksReading = {
    checks: stored.checks,
    mergeable: stored.mergeable,
    checkedAt: stored.checksReadAt,
    base,
  };
  return { kind: "checks", reading, summary: checksSummary(reading) };
}

/** decidedLineOf is the line You decided of a pass: what the user approved and discarded, and the findings with where each went. */
export function decidedLineOf(
  review: ReviewSummary | null,
  pass: ReviewPass | undefined,
  counts: { approved: number; discarded: number },
  now: number,
): MarkerView {
  const said = parts(
    counts.approved > 0 ? `${counts.approved} approved` : "",
    counts.discarded > 0 ? `${counts.discarded} discarded` : "",
  );
  const findings =
    review === null || pass === undefined ? [] : findingViews(review, pass, now, true);
  return line(
    "check",
    "You decided",
    said === "" ? "nothing decided" : said,
    findings.length === 0 || pass === undefined
      ? NONE
      : { kind: "findings", pass: pass.pass, findings },
  );
}

/** derivedDecidedLineOf is the line You decided of a pass from before the marker existed, counted from its findings. */
export function derivedDecidedLineOf(
  review: ReviewSummary,
  pass: ReviewPass,
  now: number,
): MarkerView {
  const findings = pass.findings ?? [];
  return decidedLineOf(
    review,
    pass,
    {
      approved: findings.filter((one) => one.decision === "approved").length,
      discarded: findings.filter((one) => one.decision === "discarded").length,
    },
    now,
  );
}

// authorsOf are the authors of some commits, each once, in order: "rsouza and tchen", "a, b and c".
function authorsOf(commits: readonly { author: string }[]): string {
  const names = [...new Set(commits.map((commit) => commit.author).filter((name) => name !== ""))];
  const last = names.pop();
  if (last === undefined) {
    return "";
  }
  return names.length === 0 ? last : `${names.join(", ")} and ${last}`;
}

// NEW_COMMITS_SHOWN is how many commits the line of new commits lists.
const NEW_COMMITS_SHOWN = 20;

// newCommitsLine is the commits that reached a pull request after its review was published.
function newCommitsLine(marker: MarkerEntry): MarkerView {
  const commits = marker.commits ?? [];
  const shown = commits.slice(-NEW_COMMITS_SHOWN).map(({ sha, subject }) => ({ sha, subject }));
  const by = authorsOf(commits);
  return line(
    "commit",
    marker.count > 0 ? counted(marker.count, "new commit") : "New commits",
    by === "" ? "" : `by ${by}`,
    shown.length === 0
      ? NONE
      : { kind: "commits", commits: shown, more: Math.max(0, marker.count - NEW_COMMITS_SHOWN) },
  );
}

// reviewPublishedLine is a pass published on GitHub, with the way to the review there.
function reviewPublishedLine(marker: MarkerEntry): MarkerView {
  const view = line(
    "pullRequest",
    `Published pass ${marker.pass}`,
    parts(verdictName(marker.verdict), publishedGoes(marker)),
  );
  return marker.url === "" ? view : { ...view, link: { label: "GitHub", url: marker.url } };
}

// RETRY_REASONS are why the API call was retried, in the past (§4.2 A atividade).
const RETRY_REASONS: Record<string, string> = {
  overloaded: "the API was overloaded",
  rate_limit: "the rate limit was reached",
  server: "the API failed",
  connection: "the connection failed",
  other: "the API refused the request",
};

function retriedLine(marker: MarkerEntry): MarkerView {
  const complement = parts(
    RETRY_REASONS[asRetryReason(marker.reason)] ?? "",
    marker.attempts > 0 ? counted(marker.attempts, "attempt") : "",
  );
  return { ...line("retry", "Retried on its own", complement), timeHidden: true };
}

function planInvalidLine(marker: MarkerEntry): MarkerView {
  const problems = marker.problems ?? [];
  return problems.length === 0
    ? line("problem", "The plan is still invalid")
    : line("problem", "The plan is still invalid", counted(problems.length, "problem"), {
        kind: "problems",
        problems,
      });
}

/** markerOf is how a marker reads (table Marcos); null for a type the app does not know, which is not drawn. */
export function markerOf(
  marker: MarkerEntry,
  ctx: MarkerContext,
  entryId = "",
  now = Date.now(),
): MarkerView | null {
  const type = asMarkerType(marker.type);
  if (type !== marker.type) {
    return null;
  }
  switch (type) {
    case "prd_written":
    case "prd_updated":
      return documentLine(type === "prd_written", "PRD.md", ctx);
    case "tech_spec_written":
    case "tech_spec_updated":
      return documentLine(type === "tech_spec_written", "tech-spec.md", ctx);
    case "one_shot_written":
    case "one_shot_updated":
      return documentLine(type === "one_shot_written", "one-shot.md", ctx);
    case "plan_written": {
      const steps = (ctx.task?.steps ?? []).length;
      return line("file", "Written the plan", steps > 0 ? counted(steps, "step file") : "");
    }
    case "plan_updated":
      return line("file", "Updated the plan");
    case "step_review_written":
      return stepReviewLine(marker, ctx);
    case "pr_review_written":
    case "pr_review_revised":
      return prReviewLine(marker, ctx, entryId);
    case "findings_decided":
      return decidedLineOf(
        ctx.review,
        (ctx.review?.passes ?? []).find((one) => one.pass === marker.pass),
        marker,
        now,
      );
    case "review_published":
      return reviewPublishedLine(marker);
    case "new_commits":
      return newCommitsLine(marker);
    case "committed":
      return line(
        "commit",
        `Committed ${marker.sha}`,
        parts(
          marker.subject,
          marker.pushed && marker.number > 0 ? `pushed to #${marker.number}` : "",
        ),
      );
    case "pr_opened":
      return line(
        "pullRequest",
        `Opened #${marker.number}`,
        marker.base === "" ? "" : `into ${baseName(marker.base)}`,
      );
    case "checks_read":
      return checksLine(marker, ctx);
    case "compacted":
      return line(
        "compact",
        "Context compacted",
        marker.percent > 0 ? `at ${marker.percent}%` : "",
      );
    case "paused":
      return line("pause", "Paused by you");
    case "retried":
      return retriedLine(marker);
    case "draft_approved": {
      const draft = ctx.task?.pr?.draft ?? null;
      return line(
        "check",
        "You approved the draft",
        marker.title,
        draft === null ? NONE : artifactOf(ctx, `pr/${draft.file}`, "artifacts"),
      );
    }
    case "changes_approved":
      return line("check", "You approved the changes", `${counted(marker.files, "file")} staged`);
    case "plan_invalid":
      return planInvalidLine(marker);
    case "interrupted":
      return line(
        "ban",
        asInterruptedBy(marker.interruptedBy) === "user" ? "Interrupted by you" : "Interrupted",
      );
    // A start marker alone, without the prompt after it, reads as its start line.
    case "stage_started":
    case "step_started":
    case "step_review_started":
    case "review_started":
    case "discussion_started":
      return startView(marker, null, ctx);
  }
}

/** mergedLineOf is the line derived at the end of a pull request: Merged … or Closed …; null while it is open. */
export function mergedLineOf(pr: PullRequest): MarkerView | null {
  if (pr.prNumber === 0) {
    return null;
  }
  switch (asPRState(pr.prState)) {
    case "merged":
      return line(
        "merge",
        `Merged #${pr.prNumber} into ${prBaseName(pr)}`,
        pr.mergedBy === "" ? "" : `by ${pr.mergedBy}`,
      );
    case "closed":
      return line("merge", `Closed #${pr.prNumber} without a merge`);
    case "open":
    case "":
      return null;
  }
}
