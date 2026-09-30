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

/**
 * lastRecordedPass is the pass the screen is about: the last one whose report
 * the app could read. null before any report came in.
 */
export function lastRecordedPass(review: ReviewSummary): ReviewPass | null {
  const recorded = (review.passes ?? []).filter((pass) => pass.recorded);
  return recorded[recorded.length - 1] ?? null;
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
