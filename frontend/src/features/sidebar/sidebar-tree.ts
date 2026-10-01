import { reviewChecks, reviewPass, VERDICT_WORDS } from "@/features/reviews/review-header";
import {
  discussionSessions,
  type ItemSession,
  reviewSessions,
  taskSessions,
  workingSession,
} from "@/features/sidebar/sessions";
import { boardOfRepository } from "@/lib/boards";
import { checkCounts, prChecks } from "@/lib/pull-requests";
import { ALL_REPOSITORIES, findRepository, shortName, tasksInFilter } from "@/lib/repositories";
import { compactWait, compareSituations, spokenWait } from "@/lib/situations";
import type {
  Board,
  DiscussionSummary,
  Repository,
  ReviewSummary,
  Situation,
  State,
  Step,
  TaskSummary,
} from "@/lib/wails";
import {
  asDiscussionStatus,
  asPlaceKind,
  asPRStatus,
  asPullReviewStatus,
  asSituationForm,
  asSituationGroup,
  asSituationKind,
  asStepStatus,
  asTaskMode,
  asTaskStage,
} from "@/lib/wails";

/** RowTone is what a row says about its item, from the most severe: the three situation groups, then the states without a situation. */
export type RowTone =
  | "error"
  | "wait"
  | "close"
  | "agent"
  | "app"
  | "github"
  | "paused"
  | "idle"
  | "archive";

/** ItemKind is the type glyph of a row. */
export type ItemKind = "task" | "one-shot" | "review" | "discussion";

/** RowClock is what the right edge of line 2 shows. */
export type RowClock =
  | { kind: "chip"; tone: "wait" | "error" | "close"; time: string; longTime: string }
  | { kind: "turn"; time: string; tooltip: string }
  | { kind: "word"; word: "GitHub" | "idle" };

/** RowText is a text of a row in its two forms: the long one, and the short one for when the long does not fit. */
export interface RowText {
  long: string;
  short: string;
}

/** ItemRow is one task, review or discussion of the tree, with everything its row reads. */
export interface ItemRow {
  kind: "item";
  id: string;
  itemKind: ItemKind;
  name: string;
  /** meta is repo#card, repo#PR or #cards, with · One-Shot; always in the accessible name. */
  meta: string;
  tone: RowTone;
  /** waiting is a situation waiting on the user, which makes the name bold. */
  waiting: boolean;
  line2: RowText;
  /** reading is line 2 telling a reading of GitHub that has no result yet, which shimmers. */
  reading: boolean;
  /** more is the other situations: +N and the tooltip listing them; null with one or none. */
  more: { count: number; tooltip: string } | null;
  clock: RowClock | null;
  /**
   * line3 is what the agent does now, with the context it used; null unless an agent works. verb is
   * what both forms start with: the action's verb, or the whole of what the conversation does.
   */
  line3: (RowText & { verb: string; contextPercent: number }) | null;
  situationIds: string[];
  /** repositoryId is the repository a task lives in, which the filter looks at; null for a review or a discussion. */
  repositoryId: string | null;
  /** label is the accessible name without the Ctrl+J sentence, which the row adds when it is the next. */
  label: string;
  /** item is the summary the row came from, for its situations and its card; the row does not draw it. */
  item: TaskSummary | ReviewSummary | DiscussionSummary;
}

/** NoticeRow is the notice of a repository whose clone is missing, at the top of the node its tasks live in. */
export interface NoticeRow {
  kind: "notice";
  /** id is `notice:<repository id>`. */
  id: string;
  repositoryId: string;
  /** text is `<name> · clone missing`. */
  text: string;
  /** label is `<owner/name>: the clone at <path> is missing. Enter to change the path.` */
  label: string;
  /** tooltip is `The clone at <path> is missing`. */
  tooltip: string;
}

/** EpicNode is the tasks of a board whose cards share an epic. */
export interface EpicNode {
  kind: "epic";
  id: string;
  title: string;
  rows: ItemRow[];
}

/** TreeNode is a top node of the tree: Reviews, a board, or the items of no board. */
export type TreeNode =
  | {
      kind: "reviews";
      id: "reviews";
      rows: ItemRow[];
      /** pending is how many pull requests wait for a review. */
      pending: number;
      reading: boolean;
      failures: string[];
    }
  | {
      kind: "board";
      id: string;
      board: Board;
      notices: NoticeRow[];
      epics: EpicNode[];
      rows: ItemRow[];
    }
  | { kind: "no-board"; id: "no-board"; notices: NoticeRow[]; rows: ItemRow[] };

/** TreeEntry is one focusable line of the tree, in order, as the keyboard walks it. */
export type TreeEntry =
  | {
      kind: "node";
      id: string;
      level: 1 | 2;
      parentId: string | null;
      node: TreeNode | EpicNode;
    }
  | { kind: "notice"; id: string; level: 2; parentId: string; notice: NoticeRow }
  | { kind: "item"; id: string; level: 2 | 3; parentId: string; row: ItemRow };

/** NodeSummary is what a collapsed node says: a count per state, the most severe first. */
export interface NodeSummary {
  parts: { tone: Exclude<RowTone, "idle" | "archive">; count: number }[];
  /** word names the first part: error or errors, waiting, to close, working, checks, paused. */
  word: string;
  /** label is every part in words: `1 error, 2 waiting, 1 ready to close, 1 working, 1 on GitHub, 1 paused`. */
  label: string;
  situationIds: string[];
}

/** TONE_RANK orders the tones from the most severe; the agent and the app weigh the same, and so do idle and archive. */
export const TONE_RANK: Record<RowTone, number> = {
  error: 0,
  wait: 1,
  close: 2,
  agent: 3,
  app: 3,
  github: 4,
  paused: 5,
  idle: 6,
  archive: 6,
};

const REVIEWS_ID = "reviews";
const NO_BOARD_ID = "no-board";

const boardNodeId = (boardId: string) => `board:${boardId}`;
const epicNodeId = (boardId: string, key: string) => `epic:${boardId}:${key}`;

// The item a situation belongs to, which the texts of the situation read.
type Owner =
  | { kind: "task"; task: TaskSummary }
  | { kind: "review"; review: ReviewSummary }
  | { kind: "discussion"; discussion: DiscussionSummary };

// forWait is spokenWait for the sentences that say `for <time>`.
function forWait(startedAt: string, now: number): string {
  const wait = spokenWait(startedAt, now);
  return wait === "just now" ? "less than a minute" : wait;
}

const same = (text: string): RowText => ({ long: text, short: text });

// A planning stage, as the stepper names it.
function stageLabel(stage: string): string {
  switch (asTaskStage(stage)) {
    case "prd":
      return "PRD";
    case "tech_spec":
      return "Tech spec";
    case "plan":
      return "Plan";
    case "one_shot":
      return "Planning";
    case "implementation":
      return "Implementation";
    case "pr":
      return "PR";
  }
}

const STEP_BLOCK_REASONS: Record<string, string> = {
  dirty_worktree: "worktree not clean",
  fetch_failed: "fetch failed",
  no_base_branch: "no base branch",
  path_exists: "path exists",
  branch_exists: "branch exists",
  git_failed: "git failed",
  clone_missing: "clone missing",
};

const PR_BLOCK_REASONS: Record<string, string> = {
  gh_missing: "gh not installed",
  gh_unauthenticated: "gh not signed in",
  gh_failed: "gh failed",
  git_failed: "git failed",
  no_worktree: "no worktree",
};

const withReason = (text: string, reason: string | undefined): RowText => ({
  long: reason === undefined ? text : `${text} · ${reason}`,
  short: text,
});

function stepOf(task: TaskSummary, number: number): Step | null {
  return (task.steps ?? []).find((step) => step.number === number) ?? null;
}

const stepCount = (task: TaskSummary, number: number) =>
  `Step ${number}/${(task.steps ?? []).length}`;

// The pass of the review of the pull request of a task: the one running, or the last one.
function prPass(task: TaskSummary): number {
  const reports = (task.pr?.reports ?? []).length;
  if (task.pr !== null && asPRStatus(task.pr.status) === "reviewing") {
    return reports + 1;
  }
  return Math.max(reports, 1);
}

function decided<T extends { decision: string }>(items: readonly T[]): { a: number; b: number } {
  return { a: items.filter((item) => item.decision !== "").length, b: items.length };
}

const prNumber = (task: TaskSummary) => task.pr?.prNumber ?? 0;

/** position is where an item stands, as the accessible name and the paused line say it. */
function position(owner: Owner): string {
  switch (owner.kind) {
    case "review":
      return `Pass ${reviewPass(owner.review)}`;
    case "discussion":
      return "Discussing";
    case "task":
      return taskPosition(owner.task);
  }
}

function taskPosition(task: TaskSummary): string {
  const stage = asTaskStage(task.stage);
  if (stage === "implementation") {
    const step = stepOf(task, task.currentStep);
    const count = stepCount(task, task.currentStep);
    switch (step === null ? null : asStepStatus(step.status)) {
      case "agent_review":
        return `${count} · Reviewer · pass ${step?.reviewPass}`;
      case "addressing_review":
        return `${count} · Addressing review · round ${step?.reviewRound}`;
      default:
        return count;
    }
  }
  if (stage === "pr") {
    if (task.pr !== null && asPRStatus(task.pr.status) === "closing") {
      return "Closing";
    }
    return prNumber(task) === 0 ? "PR" : "PR review";
  }
  return stageLabel(task.stage);
}

// Where a situation of a conversation is, long with the conversation and short without it.
function conversationPlace(owner: Owner, situation: Situation): RowText {
  const { place } = situation;
  switch (asPlaceKind(place.kind)) {
    case "stage":
      return same(stageLabel(place.stage));
    case "step":
    case "step_review": {
      const count = owner.kind === "task" ? stepCount(owner.task, place.step) : "";
      const who = asPlaceKind(place.kind) === "step" ? "Implementer" : "Reviewer";
      return { long: `${who} · ${count}`, short: count };
    }
    case "pr":
      if (owner.kind !== "task" || prNumber(owner.task) === 0) {
        return same("PR");
      }
      return same(`PR review · pass ${prPass(owner.task)}`);
    case "review":
      return same(owner.kind === "review" ? `pass ${reviewPass(owner.review)}` : "pass 1");
    case "discussion":
      return same("Discussing");
  }
}

const CONVERSATION_LABELS = {
  session_error: "Session error",
  permission: "Permission",
  question: "Question",
  reply: "Reply",
} as const;

// passText is `pass K` of the owner, for the situations of a review.
const passText = (owner: Owner) =>
  owner.kind === "review" ? `pass ${reviewPass(owner.review)}` : "pass 1";

/** situationText is line 2 for one situation of an item, in its long and short forms. */
function situationText(owner: Owner, situation: Situation): RowText {
  const task = owner.kind === "task" ? owner.task : null;
  const form = asSituationForm(situation.form);
  const count = task === null ? "" : stepCount(task, situation.place.step);
  const kind = asSituationKind(situation.kind);
  switch (kind) {
    case "session_error":
    case "permission":
    case "question":
    case "reply": {
      const place = conversationPlace(owner, situation);
      // A review waits on its reviewer for the report of a pass, as its bar says.
      const label =
        kind === "reply" && owner.kind === "review"
          ? "Waiting for the report"
          : CONVERSATION_LABELS[kind];
      return { long: `${label} · ${place.long}`, short: `${label} · ${place.short}` };
    }
    case "step_blocked": {
      const reason = task === null ? undefined : stepOf(task, situation.place.step)?.block?.reason;
      return withReason(
        `${count} blocked`,
        reason === undefined ? undefined : STEP_BLOCK_REASONS[reason],
      );
    }
    case "worktree_unreadable":
      return same(`Can't read worktree · ${count}`);
    case "plan_invalid": {
      const problems = (task?.planProblems ?? []).length;
      return withReason(
        "Plan still invalid",
        `${problems} ${problems === 1 ? "problem" : "problems"}`,
      );
    }
    case "ready_to_continue":
      return same(
        `Ready to continue · ${stageLabel(situation.place.stage || (task?.stage ?? ""))}`,
      );
    case "step_review":
      if (form === "approve") {
        return same(`Approve · ${count}`);
      }
      return form === "staged"
        ? { long: `Review · ${count} · ${situation.percent}% staged`, short: `Review · ${count}` }
        : same(`Review · ${count}`);
    case "step_empty":
      return same(`No changes · ${count}`);
    case "pr_blocked": {
      const reason = task?.pr?.block?.reason;
      return withReason("PR blocked", reason === undefined ? undefined : PR_BLOCK_REASONS[reason]);
    }
    case "draft":
      return { long: "Draft to approve · PR", short: "Draft · PR" };
    case "findings":
      return {
        long: `Decide findings · PR review · pass ${task === null ? 1 : prPass(task)}`,
        short: "Decide findings · PR review",
      };
    case "changes_review": {
      const place = task === null ? passText(owner) : "PR review";
      if (form === "approve") {
        return same(`Approve changes · ${place}`);
      }
      return form === "staged"
        ? {
            long: `Review changes · ${place} · ${situation.percent}% staged`,
            short: `Review changes · ${place}`,
          }
        : same(`Review changes · ${place}`);
    }
    case "pr_trouble": {
      const label = troubleLabel(form);
      if (task === null) {
        return same(`${label} · ${passText(owner)}`);
      }
      return { long: `${label} · PR #${prNumber(task)}`, short: `${label} · #${prNumber(task)}` };
    }
    case "pr_closed":
      return same(`PR closed unmerged · #${task === null ? 0 : prNumber(task)}`);
    case "merge":
      if (task === null) {
        return same(`Ready to merge · ${passText(owner)}`);
      }
      if (form === "close") {
        // Only a merge GitHub confirmed says merged; the closing offered after a failed reading doesn't.
        const merged = task.pr !== null && asPRStatus(task.pr.status) === "merged" ? " merged" : "";
        return {
          long: `Ready to close · PR #${prNumber(task)}${merged}`,
          short: `Ready to close · #${prNumber(task)}${merged}`,
        };
      }
      return {
        long: `Ready to merge · PR #${prNumber(task)}`,
        short: `Ready to merge · #${prNumber(task)}`,
      };
    case "review_report": {
      if (form === "publish") {
        return same(`Ready to publish · ${passText(owner)}`);
      }
      if (form === "apply") {
        return same(`Ready to apply · ${passText(owner)}`);
      }
      const findings =
        owner.kind === "review" ? ((owner.review.passes ?? []).at(-1)?.findings ?? []) : [];
      const { a, b } = decided(findings);
      return {
        long: `Decide findings · ${passText(owner)} · ${a} of ${b}`,
        short: `Decide findings · ${a}/${b}`,
      };
    }
    case "new_commits":
      return same(`New commits · ${passText(owner)}`);
    case "pass_blocked":
      return same(`Pass blocked · ${passText(owner)}`);
    case "publish_failed":
      return same(
        owner.kind === "review" ? `Publish failed · ${passText(owner)}` : "Publish failed",
      );
    case "drafts": {
      const drafts = owner.kind === "discussion" ? (owner.discussion.drafts ?? []) : [];
      const { a, b } = decided(drafts);
      return { long: `Decide drafts · ${a} of ${b}`, short: `Decide drafts · ${a}/${b}` };
    }
  }
}

function troubleLabel(form: string): string {
  if (form === "checks_conflict") {
    return "Checks failed · conflict";
  }
  return form === "conflict" ? "Conflict with base" : "Checks failed";
}

const GROUP_TONES = { error: "error", waiting: "wait", closing: "close" } as const;

const GROUP_WORDS = { error: "error", waiting: "waiting for you", closing: "ready to close" };

// The state of a row without a situation: its tone, line 2, and the session that works.
interface Standing {
  tone: RowTone;
  line2: RowText;
  clock: RowClock | null;
  /** reading is line 2 telling a reading of GitHub that has no result yet. */
  reading?: boolean;
}

const IDLE_CLOCK: RowClock = { kind: "word", word: "idle" };

// sessionStanding is how an item without a situation or a state of its own
// stands, by its sessions: an agent working with `working`, paused, stopped on
// an error, or idle.
function sessionStanding(
  sessions: readonly ItemSession[],
  place: string,
  working: RowText,
): Standing {
  if (sessions.some((session) => session.working)) {
    return { tone: "agent", line2: working, clock: null };
  }
  if (sessions.some((session) => session.status === "paused")) {
    return { tone: "paused", line2: same(`Paused · ${place}`), clock: null };
  }
  if (sessions.some((session) => session.status === "error")) {
    return { tone: "idle", line2: same(`Session stopped · ${place}`), clock: IDLE_CLOCK };
  }
  return { tone: "idle", line2: same(place), clock: IDLE_CLOCK };
}

const appWork = (text: RowText): Standing => ({ tone: "app", line2: text, clock: null });

function taskStanding(task: TaskSummary): Standing {
  const sessions = taskSessions(task);
  const place = taskPosition(task);
  const stage = asTaskStage(task.stage);
  if (stage === "implementation") {
    const step = stepOf(task, task.currentStep);
    const count = stepCount(task, task.currentStep);
    switch (step === null ? null : asStepStatus(step.status)) {
      case "not_started":
      case "preparing":
        return appWork({
          long: `${count} · preparing the worktree`,
          short: `${count} · preparing`,
        });
      case "committing":
        return appWork(same(`${count} · committing`));
      case "agent_review":
        return sessionStanding(sessions, place, {
          long: place,
          short: `${count} · pass ${step?.reviewPass}`,
        });
      case "addressing_review":
        return sessionStanding(sessions, place, {
          long: place,
          short: `${count} · round ${step?.reviewRound}`,
        });
      default:
        return sessionStanding(sessions, place, same(place));
    }
  }
  if (stage === "pr" && task.pr !== null) {
    switch (asPRStatus(task.pr.status)) {
      case "preparing":
        return appWork(same("PR · preparing"));
      case "opening":
        return appWork(same("PR · opening"));
      case "committing":
        return appWork(same("PR review · committing"));
      case "closing":
        return appWork(same("Closing"));
      case "waiting_checks": {
        // Until a reading of gh lists a check, the row says GitHub is being read.
        const { passed, total } = checkCounts(prChecks(task.pr));
        return task.pr.checkedAt === "" || total === 0
          ? {
              tone: "github",
              line2: same("PR review · checking GitHub"),
              clock: { kind: "word", word: "GitHub" },
              reading: true,
            }
          : {
              tone: "github",
              line2: same(`PR review · checks ${passed}/${total}`),
              clock: { kind: "word", word: "GitHub" },
            };
      }
      case "drafting":
        return sessionStanding(sessions, place, same("PR · drafting"));
      case "reviewing":
        return sessionStanding(sessions, place, same(`PR review · pass ${prPass(task)}`));
      default:
        return sessionStanding(sessions, place, same(place));
    }
  }
  return sessionStanding(sessions, place, same(place));
}

function reviewStanding(review: ReviewSummary): Standing {
  const sessions = reviewSessions(review);
  const pass = `Pass ${reviewPass(review)}`;
  switch (asPullReviewStatus(review.status)) {
    case "waiting_checks": {
      // Until a reading lists a check, the row says GitHub is being read.
      const { passed, total } = checkCounts(reviewChecks(review));
      return review.checkedAt === "" || total === 0
        ? {
            tone: "github",
            line2: same(`${pass} · checking GitHub`),
            clock: { kind: "word", word: "GitHub" },
            reading: true,
          }
        : {
            tone: "github",
            line2: {
              long: `${pass} · checks ${passed}/${total}`,
              short: `checks ${passed}/${total}`,
            },
            clock: { kind: "word", word: "GitHub" },
          };
    }
    case "applying": {
      const applying = same(`${pass} · applying`);
      return !sessions.some((session) => session.working)
        ? appWork(applying)
        : sessionStanding(sessions, pass, applying);
    }
    case "committing":
      return appWork(same(`${pass} · committing`));
    case "published": {
      const verdict = (review.passes ?? []).at(-1)?.verdict ?? "";
      return {
        tone: "idle",
        line2: same(`Published · ${VERDICT_WORDS[verdict] ?? "commented"}`),
        clock: IDLE_CLOCK,
      };
    }
    default:
      return sessionStanding(sessions, pass, same(pass));
  }
}

function discussionStanding(discussion: DiscussionSummary): Standing {
  switch (asDiscussionStatus(discussion.status)) {
    case "published":
      return { tone: "archive", line2: same("Ready to archive"), clock: null };
    case "publishing":
      return appWork(same("Publishing"));
    default:
      return sessionStanding(discussionSessions(discussion), "Discussing", same("Discussing"));
  }
}

/** shortAction is the target of an action cut to what tells it apart: the command and its subcommand, or the last segment of a path. */
export function shortAction(label: string, target: string): string {
  if (label === "Running") {
    const [command = "", ...rest] = target.split(" ").filter((term) => term !== "");
    const parts = [command];
    const [second] = rest;
    if (second !== undefined && !second.startsWith("-") && !second.includes("/")) {
      parts.push(second);
    }
    const path = rest.find((term) => term.includes("/") && !term.startsWith("-"));
    if (path !== undefined) {
      parts.push(cutPath(path));
    }
    return parts.join(" ");
  }
  return target.includes("/") ? cutPath(target) : target;
}

// cutPath is a path cut to its last segment that tells it apart, `…/ratelimit`: the empty ones, `.`
// and the `...` of a Go package pattern say nothing, and a path of nothing else stays whole.
function cutPath(path: string): string {
  const last = path
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "...")
    .at(-1);
  return last === undefined ? path : `…/${last}`;
}

// The words of line 3 and of the name without an action: what the conversation does.
function activity(session: ItemSession): { row: string; spoken: string } {
  if (session.retryAttempt > 0) {
    return {
      row: `Retrying · attempt ${session.retryAttempt}`,
      spoken: `retrying, attempt ${session.retryAttempt}`,
    };
  }
  if (!session.turnRunning) {
    return { row: "Starting session…", spoken: "starting session" };
  }
  return { row: "Thinking…", spoken: "thinking" };
}

const KIND_WORDS: Record<ItemKind, string> = {
  task: "task",
  "one-shot": "One-Shot task",
  review: "pull request review",
  discussion: "discussion",
};

const TONE_WORDS: Record<RowTone, string> = {
  error: "error",
  wait: "waiting for you",
  close: "ready to close",
  agent: "agent working",
  app: "working",
  github: "waiting on GitHub",
  paused: "paused",
  idle: "idle",
  archive: "ready to close",
};

interface RowParts {
  id: string;
  itemKind: ItemKind;
  name: string;
  meta: string;
  repositoryId: string | null;
  item: ItemRow["item"];
  standing: Standing;
  sessions: readonly ItemSession[];
}

// buildRow puts a row together: the most severe situation over the standing of
// the item, line 3 from the session in the oldest turn, and the accessible name.
function buildRow(owner: Owner, parts: RowParts, now: number): ItemRow {
  const situations = [...(situationsOf(owner) ?? [])].sort(compareSituations);
  const [main, ...others] = situations;
  let tone = parts.standing.tone;
  let line2 = parts.standing.line2;
  let clock = parts.standing.clock;
  if (main !== undefined) {
    const group = GROUP_TONES[asSituationGroup(main.group)];
    tone = group;
    line2 = situationText(owner, main);
    clock = {
      kind: "chip",
      tone: group,
      time: compactWait(main.startedAt, now),
      longTime: spokenWait(main.startedAt, now),
    };
  }
  const session = tone === "agent" ? workingSession(parts.sessions, now) : null;
  let line3: ItemRow["line3"] = null;
  if (session !== null) {
    clock = {
      kind: "turn",
      time: compactWait(session.turnStartedAt, now),
      tooltip: `Agent working on this turn for ${forWait(session.turnStartedAt, now)}`,
    };
    const words = activity(session);
    line3 =
      session.actionLabel === ""
        ? { ...same(words.row), verb: words.row, contextPercent: session.contextPercent }
        : {
            long: `${session.actionLabel} ${session.actionTarget}`,
            short: `${session.actionLabel} ${shortAction(session.actionLabel, session.actionTarget)}`,
            verb: session.actionLabel,
            contextPercent: session.contextPercent,
          };
  }

  const sentences = [`${KIND_WORDS[parts.itemKind]} ${parts.name}.`];
  if (main === undefined) {
    sentences.push(`${TONE_WORDS[tone]}, ${line2.long}.`);
  } else {
    const told = situations.map(
      (situation) =>
        `${GROUP_WORDS[asSituationGroup(situation.group)]}: ${situationText(owner, situation).long}, for ${forWait(situation.startedAt, now)}`,
    );
    sentences.push(`${told.join("; ")}.`, `${position(owner)}.`);
  }
  if (session !== null) {
    const does =
      session.actionLabel === ""
        ? activity(session).spoken
        : `${session.actionLabel} ${session.actionTarget}`;
    sentences.push(
      `${session.role} working for ${forWait(session.turnStartedAt, now)}: ${does}.`,
      `context ${session.contextPercent}% used.`,
    );
  }
  if (parts.meta !== "") {
    sentences.push(`${parts.meta}.`);
  }

  return {
    kind: "item",
    id: parts.id,
    itemKind: parts.itemKind,
    name: parts.name,
    meta: parts.meta,
    tone,
    waiting: main !== undefined,
    line2,
    more:
      others.length === 0
        ? null
        : {
            count: others.length,
            tooltip: others
              .map(
                (situation) =>
                  `${situationText(owner, situation).long} · ${compactWait(situation.startedAt, now)}`,
              )
              .join(", "),
          },
    clock,
    line3,
    reading: main === undefined && parts.standing.reading === true,
    situationIds: situations.map((situation) => situation.id),
    repositoryId: parts.repositoryId,
    label: sentences.join(" "),
    item: parts.item,
  };
}

function situationsOf(owner: Owner): Situation[] | null {
  switch (owner.kind) {
    case "task":
      return owner.task.situations;
    case "review":
      return owner.review.situations;
    case "discussion":
      return owner.discussion.situations;
  }
}

/** taskRow is the row of a task. */
export function taskRow(_app: State, task: TaskSummary, now: number): ItemRow {
  const oneShot = asTaskMode(task.mode) === "one_shot";
  const repository = shortName(task.repository);
  const card = task.card === null ? repository : `${repository}#${task.card.number}`;
  return buildRow(
    { kind: "task", task },
    {
      id: task.id,
      itemKind: oneShot ? "one-shot" : "task",
      name: task.name,
      meta: oneShot ? `${card} · One-Shot` : card,
      repositoryId: task.repositoryId,
      item: task,
      standing: taskStanding(task),
      sessions: taskSessions(task),
    },
    now,
  );
}

/** waitSuffix is ", waiting for you for 18 minutes" for a row that has a chip, "" for one that has none. */
export function waitSuffix(row: ItemRow): string {
  if (row.clock?.kind !== "chip") {
    return "";
  }
  const wait = row.clock.longTime === "just now" ? "less than a minute" : row.clock.longTime;
  return `, waiting for you for ${wait}`;
}

/** reviewRow is the row of a review of a pull request. */
export function reviewRow(review: ReviewSummary, now: number): ItemRow {
  return buildRow(
    { kind: "review", review },
    {
      id: review.id,
      itemKind: "review",
      name: review.title,
      meta: `${shortName(review.repository)}#${review.number}`,
      repositoryId: null,
      item: review,
      standing: reviewStanding(review),
      sessions: reviewSessions(review),
    },
    now,
  );
}

/** discussionRow is the row of a discussion. */
export function discussionRow(discussion: DiscussionSummary, now: number): ItemRow {
  const cards = (discussion.cards ?? []).map((card) => `#${card.number}`);
  return buildRow(
    { kind: "discussion", discussion },
    {
      id: discussion.id,
      itemKind: "discussion",
      name: discussion.title,
      meta: cards.join(" "),
      repositoryId: null,
      item: discussion,
      standing: discussionStanding(discussion),
      sessions: discussionSessions(discussion),
    },
    now,
  );
}

function noticeRow(repository: Repository): NoticeRow {
  return {
    kind: "notice",
    id: `notice:${repository.id}`,
    repositoryId: repository.id,
    text: `${repository.name} · clone missing`,
    label: `${repository.fullName}: the clone at ${repository.path} is missing. Enter to change the path.`,
    tooltip: `The clone at ${repository.path} is missing`,
  };
}

// The epics of the rows of a board, in the order of the first task of each.
function epicsOf(boardId: string, rows: readonly ItemRow[]): EpicNode[] {
  const epics: EpicNode[] = [];
  for (const row of rows) {
    const epic = (row.item as TaskSummary).card?.epic;
    if (epic === null || epic === undefined) {
      continue;
    }
    const id = epicNodeId(boardId, epic.key);
    const node = epics.find((candidate) => candidate.id === id);
    if (node === undefined) {
      epics.push({ kind: "epic", id, title: epic.title, rows: [row] });
    } else {
      node.rows.push(row);
    }
  }
  return epics;
}

/**
 * sidebarTree is the whole tree: Reviews first, then a node per board, then No
 * board when it holds anything. The filter keeps the tasks and the clone
 * notices of one repository, under its board; the reviews and the discussions
 * always show.
 */
export function sidebarTree(app: State, filter: string, now: number): TreeNode[] {
  const center = app.reviewCenter;
  const nodes: TreeNode[] = [
    {
      kind: "reviews",
      id: REVIEWS_ID,
      rows: (app.reviews ?? []).map((review) => reviewRow(review, now)),
      pending: center.pendingCount,
      reading: center.reading,
      failures: (center.failures ?? []).map((failure) => failure.message),
    },
  ];

  const tasks = tasksInFilter(app.tasks ?? [], filter).map((task) => taskRow(app, task, now));
  const discussions = (app.discussions ?? []).map((discussion) => ({
    boardId: discussion.boardId,
    row: discussionRow(discussion, now),
  }));
  const notices = (app.repositories ?? []).filter(
    (repository) => repository.missing && (filter === ALL_REPOSITORIES || repository.id === filter),
  );
  const boardOf = (repositoryId: string | null) =>
    boardOfRepository(app, repositoryId ?? "")?.id ?? null;

  let boards: readonly Board[] = app.boards ?? [];
  if (filter !== ALL_REPOSITORIES) {
    const board = boardOfRepository(app, filter);
    boards = board === null ? [] : [board];
  }
  for (const board of boards) {
    const own = tasks.filter((row) => boardOf(row.repositoryId) === board.id);
    nodes.push({
      kind: "board",
      id: boardNodeId(board.id),
      board,
      notices: notices.filter((repository) => boardOf(repository.id) === board.id).map(noticeRow),
      epics: epicsOf(board.id, own),
      rows: [
        ...own.filter((row) => !(row.item as TaskSummary).card?.epic),
        ...discussions.filter((entry) => entry.boardId === board.id).map((entry) => entry.row),
      ],
    });
  }

  // A discussion outlives the board it ran on: when the board goes, it goes to
  // no board, whatever the filter keeps.
  const known = new Set((app.boards ?? []).map((board) => board.id));
  const looseRows = [
    ...tasks.filter((row) => boardOf(row.repositoryId) === null),
    ...discussions.filter((entry) => !known.has(entry.boardId)).map((entry) => entry.row),
  ];
  const looseNotices = notices
    .filter((repository) => boardOf(repository.id) === null)
    .map(noticeRow);
  if (looseRows.length > 0 || looseNotices.length > 0) {
    nodes.push({ kind: "no-board", id: NO_BOARD_ID, notices: looseNotices, rows: looseRows });
  }
  return nodes;
}

/** nodeRows is the rows under a node; a board counts its epics' rows too. */
export function nodeRows(node: TreeNode | EpicNode): ItemRow[] {
  return node.kind === "board"
    ? [...node.epics.flatMap((epic) => epic.rows), ...node.rows]
    : node.rows;
}

/** visibleEntries is the lines of the tree on screen, in order, skipping what collapsed nodes hold. */
export function visibleEntries(
  nodes: readonly TreeNode[],
  collapsed: ReadonlySet<string>,
): TreeEntry[] {
  const entries: TreeEntry[] = [];
  const items = (rows: readonly ItemRow[], level: 2 | 3, parentId: string) => {
    for (const row of rows) {
      entries.push({ kind: "item", id: row.id, level, parentId, row });
    }
  };
  for (const node of nodes) {
    entries.push({ kind: "node", id: node.id, level: 1, parentId: null, node });
    if (collapsed.has(node.id)) {
      continue;
    }
    if (node.kind !== "reviews") {
      for (const notice of node.notices) {
        entries.push({ kind: "notice", id: notice.id, level: 2, parentId: node.id, notice });
      }
    }
    if (node.kind === "board") {
      for (const epic of node.epics) {
        entries.push({ kind: "node", id: epic.id, level: 2, parentId: node.id, node: epic });
        if (!collapsed.has(epic.id)) {
          items(epic.rows, 3, epic.id);
        }
      }
    }
    items(node.rows, 2, node.id);
  }
  return entries;
}

/** nodesOfItem is the ids of the nodes holding an item, outermost first; empty when none does. */
export function nodesOfItem(nodes: readonly TreeNode[], itemId: string): string[] {
  const holds = (rows: readonly ItemRow[]) => rows.some((row) => row.id === itemId);
  for (const node of nodes) {
    if (node.kind === "board") {
      const epic = node.epics.find((candidate) => holds(candidate.rows));
      if (epic !== undefined) {
        return [node.id, epic.id];
      }
    }
    if (holds(node.rows)) {
      return [node.id];
    }
  }
  return [];
}

type SummaryTone = Exclude<NodeSummary["parts"][number]["tone"], "app">;

const SUMMARY_ORDER: SummaryTone[] = ["error", "wait", "close", "agent", "github", "paused"];

const SUMMARY_WORDS: Record<SummaryTone, { word: string; label: string }> = {
  error: { word: "error", label: "error" },
  wait: { word: "waiting", label: "waiting" },
  close: { word: "to close", label: "ready to close" },
  agent: { word: "working", label: "working" },
  github: { word: "checks", label: "on GitHub" },
  paused: { word: "paused", label: "paused" },
};

/** nodeSummary is what a collapsed node says of its rows; null when nothing counts. */
export function nodeSummary(rows: readonly ItemRow[]): NodeSummary | null {
  const counts = new Map<SummaryTone, number>();
  for (const row of rows) {
    if (row.tone === "idle" || row.tone === "archive") {
      continue;
    }
    const tone = row.tone === "app" ? "agent" : row.tone;
    counts.set(tone, (counts.get(tone) ?? 0) + 1);
  }
  const parts = SUMMARY_ORDER.flatMap((tone) => {
    const count = counts.get(tone);
    return count === undefined ? [] : [{ tone, count }];
  });
  const [first] = parts;
  if (first === undefined) {
    return null;
  }
  const plural = (part: { tone: SummaryTone; count: number }, text: string) =>
    part.tone === "error" && part.count > 1 ? "errors" : text;
  return {
    parts,
    word: plural(first, SUMMARY_WORDS[first.tone].word),
    label: parts
      .map((part) => `${part.count} ${plural(part, SUMMARY_WORDS[part.tone].label)}`)
      .join(", "),
    situationIds: rows.flatMap((row) => row.situationIds),
  };
}

/**
 * nodeStatus is what an expanded node says at its right edge, in words for its accessible name:
 * `read failed: <what failed>`, `reading` or `4 pending`; null when it says nothing.
 */
export function nodeStatus(node: TreeNode | EpicNode): string | null {
  if (node.kind === "reviews") {
    if (node.failures.length > 0) {
      return `read failed: ${node.failures.join(", ")}`;
    }
    if (node.reading) {
      return "reading";
    }
    return node.pending > 0 ? `${node.pending} pending` : null;
  }
  if (node.kind === "board") {
    if (node.board.failure !== null) {
      return `read failed: ${node.board.failure.message}`;
    }
    return node.board.reading ? "reading" : null;
  }
  return null;
}

/** emptyTreeText is what the tree says when the filter's repository has no task: `No tasks in <name>.`; null otherwise. */
export function emptyTreeText(app: State, filter: string): string | null {
  if (filter === ALL_REPOSITORIES) {
    return null;
  }
  const repository = findRepository(app, filter);
  if (repository === null || tasksInFilter(app.tasks ?? [], filter).length > 0) {
    return null;
  }
  return `No tasks in ${shortName(repository.fullName)}.`;
}

/** RowFlash is the veil a row or a collapsed node blinks in when a situation of it just started. */
export type RowFlash = "error" | "wait";

/**
 * flashOf is how the rows blink for the situations in `flashing`: error when
 * one of them is an error, wait for the others (waiting and closing); null
 * when none of theirs blinks.
 */
export function flashOf(rows: readonly ItemRow[], flashing: ReadonlySet<string>): RowFlash | null {
  const started = rows
    .flatMap((row) => row.item.situations ?? [])
    .filter((candidate) => flashing.has(candidate.id));
  if (started.length === 0) {
    return null;
  }
  return started.some((candidate) => asSituationGroup(candidate.group) === "error")
    ? "error"
    : "wait";
}
