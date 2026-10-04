import type { MarkerView } from "@/features/chat/markers";
import { shortRef } from "@/lib/repositories";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedPRReport, ArchivedStep, ArchivedTask, StepReport } from "@/lib/wails";
import { dateAt } from "@/lib/when";

/** stepsOf are the steps of an archived task; the Go sends none as null. */
export function stepsOf(task: ArchivedTask): readonly ArchivedStep[] {
  return task.steps ?? [];
}

/** stepReportsOf are the reports of the agent review of a step; the Go sends none as null. */
export function stepReportsOf(step: ArchivedStep): readonly StepReport[] {
  return step.reports ?? [];
}

/** prReportsOf are the reports of the review of the pull request of an archived task; the Go sends none as null. */
export function prReportsOf(task: ArchivedTask): readonly ArchivedPRReport[] {
  return task.prReports ?? [];
}

/** SHORT_SHA is how many characters of a commit the History writes. */
const SHORT_SHA = 7;

/**
 * archivedDate is a moment of an archived item as the History writes it: "Sep 24 at 14:51", with
 * the year of another one, "Sep 24, 2025 at 14:51". "" for a moment the item doesn't have.
 */
export function archivedDate(iso: string, now: number): string {
  return dateAt(iso, now);
}

/** ArchivedFact is one term of the facts of an archived item, with the reference inside its value that opens on GitHub. */
export interface ArchivedFact {
  label: string;
  value: string;
  /** link is the part of the value that is a link: its text, where it goes and what the tooltip says. */
  link?: { text: string; href: string; tooltip: string };
}

// pullRequestValue is what the Pull request fact says of the pull request of a task.
function pullRequestValue(pr: NonNullable<ArchivedTask["pr"]>, now: number): string {
  const into = pr.base === "" ? "" : ` into ${pr.base}`;
  if (pr.state !== "merged") {
    return `#${pr.number}${into} · the merge wasn't confirmed`;
  }
  const by = pr.mergedBy === "" ? "" : ` by ${pr.mergedBy}`;
  const at = archivedDate(pr.mergedAt, now);
  return `#${pr.number} merged${into}${by}${at === "" ? "" : ` · ${at}`}`;
}

/**
 * archivedTaskFacts are the facts of an archived task: its repository and card, its pull request,
 * when it started and, when the closing left no record to carry the hour, when it was archived.
 */
export function archivedTaskFacts(task: ArchivedTask, now: number): ArchivedFact[] {
  const facts: ArchivedFact[] = [];
  const { card, pr } = task;
  if (card === null) {
    facts.push({ label: "Repository", value: task.repository });
  } else {
    const ref = shortRef(`${card.repository}#${card.number}`);
    const status = card.status === "" ? "" : ` · ${card.status}`;
    facts.push({
      label: "Repository",
      value: `${task.repository} · card ${ref}${status}`,
      link: { text: ref, href: card.url, tooltip: `Open ${ref} on GitHub` },
    });
  }
  if (pr !== null) {
    facts.push({
      label: "Pull request",
      value: pullRequestValue(pr, now),
      link: { text: `#${pr.number}`, href: pr.url, tooltip: `Open #${pr.number} on GitHub` },
    });
  }
  facts.push({ label: "Started", value: archivedDate(task.createdAt, now) });
  if (task.close === null) {
    facts.push({ label: "Archived", value: archivedDate(task.archivedAt, now) });
  }
  return facts;
}

/** ArchivedTaskTab is a tab of the documents of an archived task. */
export type ArchivedTaskTab = "prd" | "tech_spec" | "steps" | "one_shot" | "pr";

/** archivedTaskTabs are the tabs of an archived task: the documents of its kind, then the pull request. */
export function archivedTaskTabs(task: ArchivedTask): { id: ArchivedTaskTab; label: string }[] {
  const pr = { id: "pr", label: "Pull request" } as const;
  if (isOneShot(task)) {
    return [{ id: "one_shot", label: "One-Shot document" }, pr];
  }
  const steps = stepsOf(task).length;
  return [
    { id: "prd", label: "PRD" },
    { id: "tech_spec", label: "Tech spec" },
    { id: "steps", label: steps === 0 ? "Steps" : `Steps · ${steps}` },
    pr,
  ];
}

/** stepMarker is the line of a step of an archived task: its number, its title and its commit, opening the step file. */
function stepMarker(step: ArchivedStep, numbered: boolean): MarkerView {
  return {
    icon: "file",
    text: step.title,
    complement: "",
    body: { kind: "artifact", name: `steps/${step.file}`, openIn: "artifacts" },
    ...(numbered ? { lead: String(step.number) } : {}),
    ...(step.commitSha === "" ? {} : { aside: step.commitSha.slice(0, SHORT_SHA) }),
    timeHidden: true,
  };
}

/** stepMarkers are the lines of the steps of an archived task, in the order of task.steps. */
export function stepMarkers(task: ArchivedTask): MarkerView[] {
  const numbered = !isOneShot(task);
  return stepsOf(task).map((step) => stepMarker(step, numbered));
}

// reportComplement is what a report says after its name: changes with their count, or clean.
function reportComplement(report: StepReport | ArchivedPRReport): string {
  if (report.clean) {
    return "clean";
  }
  return report.findings > 0
    ? `changes · ${report.findings} ${report.findings === 1 ? "finding" : "findings"}`
    : "changes";
}

/**
 * reportMarker is the line of a report of the agent review, opening the document `name`, which is
 * "step-reviews/<file>" for a step and "pr/<file>" for the pull request.
 */
export function reportMarker(report: StepReport | ArchivedPRReport, name: string): MarkerView {
  return {
    icon: "file",
    text: `Review ${report.pass}`,
    complement: reportComplement(report),
    body: { kind: "artifact", name, openIn: "artifacts" },
    timeHidden: true,
  };
}

/**
 * deleteTaskStays is what the deletion of an archived task leaves on GitHub: the pull request and the
 * card, whichever the task has.
 */
export function deleteTaskStays(task: ArchivedTask): string {
  const card = task.card === null ? null : shortRef(`${task.card.repository}#${task.card.number}`);
  const pr = task.pr === null ? null : `PR #${task.pr.number}`;
  if (pr !== null && card !== null) {
    return `Nothing changes on GitHub: ${pr} and the card ${card} stay.`;
  }
  if (pr !== null) {
    return `Nothing changes on GitHub: ${pr} stays.`;
  }
  if (card !== null) {
    return `Nothing changes on GitHub: the card ${card} stays.`;
  }
  return "Nothing changes on GitHub.";
}
