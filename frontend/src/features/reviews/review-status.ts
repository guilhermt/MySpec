import type { StatusTone } from "@/features/task/status";
import { cloneMissingText, findRepository } from "@/lib/repositories";
import { summaryLabel } from "@/lib/situations";
import type { PullRequestRow, ReviewFinding, ReviewPass, ReviewSummary, State } from "@/lib/wails";
import {
  asFindingPlacement,
  asPullRequestAction,
  asPullRequestOutcome,
  asPullReviewStatus,
  asReviewVerdict,
} from "@/lib/wails";

/** reviewStatusLabel is where a review of a pull request stands, in the words of the product. */
export function reviewStatusLabel(review: ReviewSummary): string {
  switch (asPullReviewStatus(review.status)) {
    case "reviewing":
      return "Reviewing";
    case "awaiting_reply":
      return "Waiting for the report";
    case "awaiting_decision":
      return "Decide findings";
    case "ready_to_publish":
      return "Ready to publish";
    case "publish_failed":
      return "Publish failed";
    case "published":
      return "Published";
    case "new_commits":
      return "New commits";
    case "ready_to_apply":
      return "Ready to apply";
    case "applying":
      return "Applying";
    case "in_review":
      return "In review";
    case "ready_to_approve":
      return "Ready to approve";
    case "committing":
      return "Committing";
    case "ready_to_merge":
      return "Ready to merge";
  }
}

/**
 * reviewStatusTone maps the state of a review to the colour that carries it. It
 * never calls for the user: that colour comes from the situations alone.
 */
export function reviewStatusTone(review: ReviewSummary): StatusTone {
  switch (asPullReviewStatus(review.status)) {
    case "reviewing":
    case "applying":
    case "committing":
      return "working";
    case "published":
      return "done";
    case "awaiting_reply":
    case "awaiting_decision":
    case "ready_to_publish":
    case "publish_failed":
    case "new_commits":
    case "ready_to_apply":
    case "in_review":
    case "ready_to_approve":
    case "ready_to_merge":
      return "idle";
  }
}

/**
 * reviewRowLabel is what a row of a review reads: what it waits on the user
 * for, and, when it waits for nothing, what it is doing.
 */
export function reviewRowLabel(review: ReviewSummary): string {
  return summaryLabel(review.situations ?? []) ?? reviewStatusLabel(review);
}

/** reportLabel names one pass of a review, and says when it was published. */
export function reportLabel(pass: ReviewPass): string {
  const label = `Review ${pass.pass} · ${pass.clean ? "clean" : "changes"}`;
  return pass.published ? `${label} · published` : label;
}

/** verdictLabel is what a published review says of the pull request. */
export function verdictLabel(verdict: string): string {
  switch (asReviewVerdict(verdict)) {
    case "approve":
      return "Approve";
    case "request_changes":
      return "Request changes";
    case "comment":
      return "Comment";
  }
}

/** decidedCount is how many findings of a pass the user has already approved or discarded. */
export function decidedCount(pass: ReviewPass): number {
  return (pass.findings ?? []).filter((finding) => finding.decision !== "").length;
}

/**
 * lastRecordedPass is the pass the screen is about: the last one whose report
 * the app could read. null before any report came in.
 */
export function lastRecordedPass(review: ReviewSummary): ReviewPass | null {
  const recorded = (review.passes ?? []).filter((pass) => pass.recorded);
  return recorded[recorded.length - 1] ?? null;
}

/** anyDecided reports whether the user has already decided on a finding of a pass. */
export function anyDecided(pass: ReviewPass): boolean {
  return decidedCount(pass) > 0;
}

/**
 * publishCounts is what publishing a pass would send: the approved findings
 * split between the lines of the diff and the body of the review.
 */
export function publishCounts(pass: ReviewPass): string {
  const approved = (pass.findings ?? []).filter((finding) => finding.decision === "approved");
  const inline = approved.filter((finding) => finding.path !== "").length;
  const body = approved.length - inline;
  const parts: string[] = [];
  if (inline > 0) {
    parts.push(inline === 1 ? "1 inline comment" : `${inline} inline comments`);
  }
  if (body > 0) {
    parts.push(body === 1 ? "1 in the body" : `${body} in the body`);
  }
  return parts.length === 0 ? "The summary and the verdict only" : parts.join(" · ");
}

/** findingLocation is where a finding points: a file and a line, or nowhere in the diff. */
export function findingLocation(finding: ReviewFinding): string {
  return finding.path === "" ? "General" : `${finding.path}:${finding.line}`;
}

/** placementLabel says where a finding of a published pass went. */
export function placementLabel(placement: string): string {
  switch (asFindingPlacement(placement)) {
    case "inline":
      return "Inline comment";
    case "body":
      return "In the review body";
    case "":
      return "Not published";
  }
}

/** outcomeLabel is what became of the pull request of an archived review. */
export function outcomeLabel(outcome: string): string {
  return asPullRequestOutcome(outcome) === "merged" ? "Merged" : "Closed";
}

/** actionLabel is what the button of a pull request row offers. */
export function actionLabel(row: PullRequestRow): string {
  switch (asPullRequestAction(row.action)) {
    case "open_review":
      return "Open review";
    case "open_task":
      return "Open task";
    // A pull request whose repository has no clone yet is still reviewed from
    // this button: the dialog offers the clone.
    case "review":
    case "clone":
    case "clone_missing":
    case "fork":
      return "Review";
  }
}

/** actionHint is what keeps a pull request from being reviewed, null when nothing does. */
export function actionHint(row: PullRequestRow, app: State | null): string | null {
  switch (asPullRequestAction(row.action)) {
    case "fork":
      return "Pull requests from forks can't be reviewed yet.";
    case "clone_missing": {
      const repository = findRepository(app, row.repositoryId);
      return repository === null ? null : cloneMissingText(repository);
    }
    default:
      return null;
  }
}
