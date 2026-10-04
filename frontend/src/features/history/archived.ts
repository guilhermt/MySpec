import type { FindingView } from "@/components/system/Finding";
import type { MarkerView } from "@/features/chat/markers";
import { epicGroups, kindLabel, looseDrafts } from "@/features/discussion/discussion-status";
import { passFindingViews } from "@/features/reviews/review-conversation";
import { verdictLabel } from "@/features/reviews/review-status";
import { draftTitle, publishedOutcome } from "@/lib/drafts";
import { shortRef } from "@/lib/repositories";
import { counted, listed } from "@/lib/situations";
import { isOneShot } from "@/lib/task-modes";
import type {
  ArchivedDiscussion,
  ArchivedPRReport,
  ArchivedReview,
  ArchivedStep,
  ArchivedTask,
  Draft,
  ReviewPass,
  StepReport,
} from "@/lib/wails";
import { asDraftKind, asDraftOutcome } from "@/lib/wails";
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

/** recordedPasses are the passes of an archived review that have a report; the Go sends none as null. */
export function recordedPasses(review: ArchivedReview): ReviewPass[] {
  return (review.passes ?? []).filter((pass) => pass.file !== "");
}

// ofAll is how a count of the passes reads: "published" for the only one, "both published" for two,
// "all published" for more, "2 published" for a part.
function ofAll(count: number, total: number, said: string): string {
  if (count < total) {
    return `${count} ${said}`;
  }
  return total === 1 ? said : `${total === 2 ? "both" : "all"} ${said}`;
}

/**
 * reviewedSentence is what became of the passes of a review that wrote a report: "2 passes, both
 * published", "3 passes, 2 published", "2 passes, none published", and, for the passes sent to the agent in
 * Apply mode, "1 pass, sent to the agent". "" when no pass wrote a report.
 */
export function reviewedSentence(passes: readonly ReviewPass[]): string {
  const written = passes.filter((pass) => pass.file !== "");
  if (written.length === 0) {
    return "";
  }
  const published = written.filter((pass) => pass.published).length;
  const sent = written.filter((pass) => pass.sent).length;
  const total = written.length === 1 ? "1 pass" : `${written.length} passes`;
  if (published === 0 && sent === 0) {
    return `${total}, none published`;
  }
  const parts = [
    ...(published === 0 ? [] : [ofAll(published, written.length, "published")]),
    ...(sent === 0 ? [] : [ofAll(sent, written.length, "sent to the agent")]),
  ];
  return `${total}, ${parts.join(" and ")}`;
}

// reviewPullRequestValue is what the Pull request fact says of the pull request of a review.
function reviewPullRequestValue(review: ArchivedReview, ref: string, now: number): string {
  const author = review.author === "" ? "" : ` by ${review.author}`;
  if (review.outcome === "merged") {
    const into = review.baseBranch === "" ? "" : ` into ${review.baseBranch}`;
    const by = review.mergedBy === "" ? "" : ` by ${review.mergedBy}`;
    const at = archivedDate(review.mergedAt, now);
    return `${ref}${author} · merged${into}${by}${at === "" ? "" : ` · ${at}`}`;
  }
  const at = archivedDate(review.closedAt, now);
  return `${ref}${author} · closed${at === "" ? "" : ` · ${at}`}`;
}

/**
 * archivedReviewFacts are the facts of an archived review: its pull request with what became of it, its
 * card, when it started, what became of its passes and, when the pull request has no hour to carry it,
 * when it was archived.
 */
export function archivedReviewFacts(review: ArchivedReview, now: number): ArchivedFact[] {
  const ref = shortRef(`${review.repository}#${review.number}`);
  const facts: ArchivedFact[] = [
    {
      label: "Pull request",
      value: reviewPullRequestValue(review, ref, now),
      link: { text: ref, href: review.url, tooltip: `Open ${ref} on GitHub` },
    },
  ];
  const { card } = review;
  if (card !== null) {
    const cardRef = shortRef(`${review.repository}#${card.number}`);
    facts.push({
      label: "Card",
      value: `${cardRef} · ${card.title}`,
      link: { text: cardRef, href: card.url, tooltip: `Open ${cardRef} on GitHub` },
    });
  }
  facts.push({ label: "Started", value: archivedDate(review.createdAt, now) });
  const reviewed = reviewedSentence(review.passes ?? []);
  if (reviewed !== "") {
    facts.push({ label: "Reviewed", value: reviewed });
  }
  const hour = review.outcome === "merged" ? review.mergedAt : review.closedAt;
  if (hour === "") {
    facts.push({ label: "Archived", value: archivedDate(review.archivedAt, now) });
  }
  return facts;
}

/** PassHeading is the line of a pass of an archived review: its title, what became of it and when. */
export interface PassHeading {
  title: string;
  outcome: string;
  time: string;
}

/**
 * passHeading is the line of a pass: "Pass 1" with its verdict (or, in Apply mode, the findings sent to
 * the agent; "not published" when nothing left) and the moment it left, "" when that wasn't kept.
 */
export function passHeading(pass: ReviewPass, now: number): PassHeading {
  const title = `Pass ${pass.pass}`;
  if (pass.published) {
    const at = archivedDate(pass.publishedAt, now);
    return { title, outcome: verdictLabel(pass.verdict), time: at === "" ? "" : `published ${at}` };
  }
  if (pass.sent) {
    const approved = (pass.findings ?? []).filter((finding) => finding.decision === "approved");
    const at = archivedDate(pass.sentAt, now);
    return {
      title,
      outcome: `${counted(approved.length, "finding")} sent to the agent`,
      time: at === "" ? "" : `sent ${at}`,
    };
  }
  return { title, outcome: "not published", time: "" };
}

/** outFindingViews are the findings of a pass that left it, published or sent, as the system draws them. */
export function outFindingViews(pass: ReviewPass, mode: string, now: number): FindingView[] {
  return passFindingViews(pass, mode, now).filter((view) => view.decision === "approved");
}

/**
 * publishedSentence is what became of the drafts of a discussion: "4 of 5 drafts: 3 created, 1
 * updated" (only the parts that exist), "None of 5 drafts"; "" when it had no draft.
 */
export function publishedSentence(drafts: readonly Draft[]): string {
  if (drafts.length === 0) {
    return "";
  }
  const total = drafts.length === 1 ? "1 draft" : `${drafts.length} drafts`;
  const published = drafts.filter((draft) => draft.published).length;
  if (published === 0) {
    return `None of ${total}`;
  }
  const outcome = publishedOutcome(drafts);
  return `${published} of ${total}${outcome === "" ? "" : `: ${outcome}`}`;
}

// roundsSentence is how many rounds published, "1 round"; "" when none did.
function roundsSentence(drafts: readonly Draft[]): string {
  const rounds = new Set(drafts.filter((draft) => draft.published).map((draft) => draft.round));
  return rounds.size === 0 ? "" : counted(rounds.size, "round");
}

/**
 * archivedDiscussionFacts are the facts of an archived discussion: its board with the cards it started
 * from, when it started, when it was archived with the rounds it took, and what it published.
 */
export function archivedDiscussionFacts(
  discussion: ArchivedDiscussion,
  now: number,
): ArchivedFact[] {
  const drafts = discussion.drafts ?? [];
  const cards = (discussion.cards ?? []).map((card) =>
    shortRef(`${card.repository}#${card.number}`),
  );
  const facts: ArchivedFact[] = [
    {
      label: "Board",
      value: cards.length === 0 ? discussion.board : `${discussion.board} · from ${listed(cards)}`,
    },
    { label: "Started", value: archivedDate(discussion.createdAt, now) },
  ];
  const archived = archivedDate(discussion.archivedAt, now);
  const rounds = roundsSentence(drafts);
  facts.push({ label: "Archived", value: rounds === "" ? archived : `${archived} · ${rounds}` });
  const published = publishedSentence(drafts);
  if (published !== "") {
    facts.push({ label: "Published", value: published });
  }
  return facts;
}

/** PublishedRow is a draft of an archived discussion as What it published lists it. */
export interface PublishedRow {
  /** id is the id of the draft. */
  id: string;
  kind: "epic" | "card" | "update";
  /** label is the tag of the kind: Epic, New card or Update. */
  label: string;
  title: string;
  indented: boolean;
  outcome:
    | { kind: "link"; text: string; href: string; tooltip: string }
    | { kind: "text"; text: string };
}

// outcomeOf is what became of a draft: the issue it made or changed, or why nothing went.
function outcomeOf(draft: Draft): PublishedRow["outcome"] {
  if (draft.published) {
    const ref = shortRef(`${draft.repository}#${draft.number}`);
    const done = asDraftOutcome(draft.outcome) === "updated" ? "Updated" : "Created";
    return {
      kind: "link",
      text: `${done} ${ref}`,
      href: draft.url,
      tooltip: `Open ${ref} on GitHub`,
    };
  }
  if (draft.decision === "discarded") {
    return { kind: "text", text: "Not published · discarded" };
  }
  if (draft.publishError !== "") {
    return { kind: "text", text: "Not published · failed" };
  }
  return {
    kind: "text",
    text: draft.decision === "" ? "Not published · not decided" : "Not published",
  };
}

/**
 * publishedRows are the drafts of an archived discussion in the order of their position, the cards of
 * an epic right after it, indented.
 */
export function publishedRows(discussion: ArchivedDiscussion): PublishedRow[] {
  const drafts = discussion.drafts ?? [];
  const row = (draft: Draft, indented: boolean): PublishedRow => {
    const kind = asDraftKind(draft.kind);
    return {
      id: draft.id,
      kind: kind === "new" ? "card" : kind,
      label: kindLabel(draft),
      title: draftTitle(draft),
      indented,
      outcome: outcomeOf(draft),
    };
  };
  const groups = epicGroups(drafts).map((group) => ({
    position: group.epic.position,
    rows: [row(group.epic, false), ...group.members.map((member) => row(member, true))],
  }));
  const loose = looseDrafts(drafts).map((draft) => ({
    position: draft.position,
    rows: [row(draft, false)],
  }));
  return [...groups, ...loose].sort((a, b) => a.position - b.position).flatMap((part) => part.rows);
}
