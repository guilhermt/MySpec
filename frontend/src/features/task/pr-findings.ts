import {
  approveRestButton,
  type Bar,
  statusOf,
  type TaskRequestAction,
  type TaskRequestButton,
} from "@/features/task/request";
import { decidedCounts } from "@/lib/findings";
import { counted } from "@/lib/situations";
import type {
  PRReport,
  PRStatus,
  PullRequest,
  ReviewFinding,
  SituationKind,
  TaskSummary,
} from "@/lib/wails";
import { asPRState, asPRStatus } from "@/lib/wails";
import { clockTime } from "@/lib/when";

/** DECIDING_STATUSES are the states of the pull request in which its current pass is decided. */
const DECIDING_STATUSES: readonly PRStatus[] = [
  "reviewing",
  "awaiting_decision",
  "done",
  "trouble",
  "in_review",
  "ready_to_approve",
];

/** ENDED_STATUSES are the states after the merge or the closing of the pull request. */
const ENDED_STATUSES: readonly PRStatus[] = ["merged", "pr_closed", "closed"];

/** NEXT_TO_DECIDE takes the focus to the next finding to decide, as Alt+↓. */
const NEXT_TO_DECIDE: TaskRequestButton = {
  action: "nextToDecide",
  label: "Next to decide",
  variant: "secondary",
  shortcut: "Alt ↓",
  tooltip: "The next finding to decide · Alt+↓",
  loadingLabel: "",
};

// applyFindingsButton sends the approved findings to the agent; dashed with what is left to decide.
function applyFindingsButton(disabledReason?: string): TaskRequestButton {
  return {
    action: "applyFindings",
    label: "Apply approved",
    variant: "primary",
    loadingLabel: "Sending…",
    ...(disabledReason === undefined ? {} : { disabledReason }),
  };
}

/** currentReport is the current structured pass of the pull request; null while the review runs a pass in text, or none. */
export function currentReport(pr: PullRequest): PRReport | null {
  if (pr.currentPass <= 0) {
    return null;
  }
  return (
    (pr.reports ?? []).find((report) => report.pass === pr.currentPass && report.structured) ?? null
  );
}

/** allDiscarded says the pass is recorded with changes, not sent, and every finding of it was discarded. */
export function allDiscarded(report: PRReport): boolean {
  const findings = report.findings ?? [];
  return (
    report.recorded &&
    !report.clean &&
    report.sentAt === "" &&
    findings.length > 0 &&
    findings.every((finding) => finding.decision === "discarded")
  );
}

/** discardedPass says the current pass had every finding discarded: the review waits for the merge with nothing sent. */
export function discardedPass(pr: PullRequest): boolean {
  const report = currentReport(pr);
  return report !== null && allDiscarded(report);
}

/**
 * cardOf is the card of findings the conversation of the review holds: the current pass, recorded
 * with findings and not sent, while it is decided (DECIDING_STATUSES, the pull request open), and,
 * disabled, the current pass with every finding discarded once the pull request was merged or closed,
 * and the same pass, unsent, while the stage is blocked (the decisions wait for it to resume);
 * null otherwise.
 */
export function cardOf(pr: PullRequest): { report: PRReport; disabled: boolean } | null {
  const report = currentReport(pr);
  if (report === null) {
    return null;
  }
  const status = asPRStatus(pr.status);
  if (ENDED_STATUSES.includes(status) && allDiscarded(report)) {
    return { report, disabled: true };
  }
  const state = asPRState(pr.prState);
  if (
    report.recorded &&
    !report.clean &&
    report.sentAt === "" &&
    (report.findings ?? []).length > 0 &&
    (DECIDING_STATUSES.includes(status) || status === "blocked") &&
    state !== "merged" &&
    state !== "closed"
  ) {
    return { report, disabled: status === "blocked" };
  }
  return null;
}

/** cardFindings are the findings of the card the conversation holds to be decided; null when it holds none or it is disabled. */
export function cardFindings(task: TaskSummary): readonly ReviewFinding[] | null {
  const card = task.pr === null ? null : cardOf(task.pr);
  return card === null || card.disabled ? null : card.report.findings;
}

/** FindingsForm is the shape of the bar of the findings: deciding, ready to apply, or a pass in text. */
export type FindingsForm = "decide" | "apply" | "text";

/** findingsFormOf is the shape the state of the pull request asks of the bar of the findings, for a paused task. */
export function findingsFormOf(pr: PullRequest): FindingsForm {
  const report = currentReport(pr);
  if (report === null || !report.recorded) {
    return "text";
  }
  const { decided, approved, total } = decidedCounts(report.findings ?? []);
  return decided === total && approved > 0 ? "apply" : "decide";
}

/** passPlace is the place of the bars of the findings: "PR review · pass 1". */
export function passPlace(pr: PullRequest): string {
  const last = (pr.reports ?? []).at(-1);
  const pass = pr.currentPass > 0 ? pr.currentPass : (last?.pass ?? 1);
  return `PR review · pass ${pass}`;
}

const WORKTREE_CHANGED = "the worktree has changes";
const WORKTREE_CHANGED_TOOLTIP = "They go to review with the changes of the approved findings.";
/** REWRITE_UNREADABLE is the note of the bar when the rewritten report of the pass can't be read. */
export const REWRITE_UNREADABLE = "the rewritten report can't be read";

/** findingsNotes are what the middle of the bar adds while the findings are decided: the changed worktree, the rewrite that can't be read. */
export function findingsNotes(pr: PullRequest): { notes: string[]; tooltip: string } {
  const notes: string[] = [];
  const tooltips: string[] = [];
  if (pr.review !== null && pr.review.error === "" && pr.review.total > 0) {
    notes.push(WORKTREE_CHANGED);
    tooltips.push(WORKTREE_CHANGED_TOOLTIP);
  }
  if (pr.unreadableReport !== "") {
    notes.push(REWRITE_UNREADABLE);
    tooltips.push(pr.unreadableReport);
  }
  return { notes, tooltip: tooltips.join(" ") };
}

/** noFileChanged says the agent applied the findings and changed nothing. */
export function noFileChanged(pr: PullRequest): boolean {
  const sent = currentReport(pr)?.sentAt ?? "";
  return (
    asPRStatus(pr.status) === "in_review" &&
    sent !== "" &&
    (pr.review === null || (pr.review.error === "" && pr.review.total === 0))
  );
}

/** findingsBar is the bar of the findings of the pull request in a form. */
export function findingsBar(pr: PullRequest, form: FindingsForm): Bar {
  const place = passPlace(pr);
  if (form === "text") {
    return {
      form: "tinted",
      label: "Decide findings",
      place,
      status: statusOf("Decide findings", place),
      actions: [],
      focus: "composer",
    };
  }
  const { notes, tooltip } = findingsNotes(pr);
  const { decided, approved, total } = decidedCounts(currentReport(pr)?.findings ?? []);
  if (form === "apply") {
    return {
      form: "decision",
      label: "Ready to apply",
      place,
      progress: [
        `${counted(approved, "approved finding")} ${approved === 1 ? "goes" : "go"} to the agent`,
        ...notes,
      ].join(" · "),
      progressTooltip: tooltip,
      status: statusOf("Ready to apply", place),
      actions: [applyFindingsButton()],
      focus: "primary",
    };
  }
  const left = total - decided;
  return {
    form: "decision",
    label: "Decide findings",
    place,
    progress: [`${decided} of ${total} decided`, ...notes].join(" · "),
    progressTooltip: tooltip,
    status: statusOf("Decide findings", place),
    actions: [
      NEXT_TO_DECIDE,
      // Approve the rest has nothing to approve once every finding is decided.
      ...(left > 0 ? [approveRestButton<TaskRequestAction>(left)] : []),
      applyFindingsButton(left > 0 ? `Decide ${left} more` : undefined),
    ],
    focus: "finding",
  };
}

/** disabledNote is where a finding went once its pass is behind: "Sent to the agent · 17:36" or "Not sent". */
export function disabledNote(report: PRReport, finding: ReviewFinding, now: number): string {
  if (finding.decision !== "approved") {
    return "Not sent";
  }
  const sent = clockTime(report.sentAt, now);
  return sent === "" ? "Sent to the agent" : `Sent to the agent · ${sent}`;
}

/** reviewAgainTooltip is what Review again tells about the decisions it leaves behind; null without any. */
export function reviewAgainTooltip(pr: PullRequest): string | null {
  const card = cardOf(pr);
  if (card === null || card.disabled || !card.report.edited) {
    return null;
  }
  const { pass } = card.report;
  return `Starts pass ${pass + 1}. The decisions of review ${pass} aren't applied.`;
}

/** prComposerContext is how the composer of the PR review reads the findings: in text, structured, or the changes. */
export function prComposerContext(
  task: TaskSummary,
  kind: SituationKind | null,
): { findings: boolean; reviseFindings: boolean; askForChange: boolean } {
  const structured = task.pr !== null && currentReport(task.pr) !== null;
  return {
    findings: kind === "findings" && !structured,
    reviseFindings:
      (kind === "findings" && structured) ||
      (kind === "merge" && task.pr !== null && discardedPass(task.pr)),
    askForChange: kind === "changes_review",
  };
}
