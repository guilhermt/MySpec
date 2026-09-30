import type { ReviewFinding, ReviewPass, ReviewSummary } from "@/lib/wails";
import { asFindingPlacement, asPullRequestOutcome, asReviewVerdict } from "@/lib/wails";

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
