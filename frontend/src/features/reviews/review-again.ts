import { lastRecordedPass } from "@/features/reviews/review-status";
import type { ReviewPass, ReviewSummary } from "@/lib/wails";

// lastWhere is the last pass of a review that satisfies a test; null without one.
function lastWhere(review: ReviewSummary, test: (pass: ReviewPass) => boolean): ReviewPass | null {
  return [...(review.passes ?? [])].reverse().find(test) ?? null;
}

// lastPublished is the last pass published on GitHub; null without one.
function lastPublished(review: ReviewSummary): ReviewPass | null {
  return lastWhere(review, (pass) => pass.published);
}

/**
 * discardsDecisions says whether a Review again throws away the work of the user: the last pass with a
 * report wasn't published or sent, and a finding of it was decided or something of it edited.
 */
export function discardsDecisions(review: ReviewSummary): boolean {
  const pass = lastRecordedPass(review);
  if (pass === null || pass.published || pass.sent) {
    return false;
  }
  return pass.edited || (pass.findings ?? []).some((finding) => finding.decision !== "");
}

/** againNote is the note of the Review again dialog when it discards the decisions; null otherwise. */
export function againNote(review: ReviewSummary): string | null {
  const pass = lastRecordedPass(review);
  if (pass === null || !discardsDecisions(review)) {
    return null;
  }
  return `The decisions and edits of review ${pass.pass} will be discarded.`;
}

/**
 * againText is what the next pass does, as the Review again dialog says it: "Pass 2 reads the 3 new
 * commits and the checks, and says which of the 2 published findings they fix."
 */
export function againText(review: ReviewSummary): string {
  const next = `Pass ${(lastRecordedPass(review)?.pass ?? 0) + 1}`;
  switch (review.status) {
    case "new_commits":
      return `${next} reads ${newCommitsText(review.newCommits)} and the checks, and ${newCommitsDo(review)}.`;
    case "trouble":
      return `${next} reads the checks and the conflict again, and turns what failed into findings.`;
    case "pass_blocked":
      return `${next} reads the pull request again, and starts when the checks finish.`;
    default:
      return `${next} reads the pull request and the checks again, and writes a new report.`;
  }
}

// newCommitsText names the commits since the publication: "the 3 new commits", "the new commit", or
// "the new commits" when how many is unknown.
function newCommitsText(count: number): string {
  return count === 1
    ? "the new commit"
    : count > 1
      ? `the ${count} new commits`
      : "the new commits";
}

// newCommitsDo is what the pass does with the commits: which published findings they fix, or a new
// report when nothing was published as a finding.
function newCommitsDo(review: ReviewSummary): string {
  const published = (lastPublished(review)?.findings ?? []).filter(
    (finding) => finding.placement !== "",
  ).length;
  if (published === 0) {
    return "writes a new report";
  }
  const [they, fix] = review.newCommits === 1 ? ["it", "fixes"] : ["they", "fix"];
  return published === 1
    ? `says whether ${they} ${fix} the published finding`
    : `says which of the ${published} published findings ${they} ${fix}`;
}
