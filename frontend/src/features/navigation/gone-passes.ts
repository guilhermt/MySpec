import { counted, verdictName } from "@/features/reviews/publish";
import type { ArchivedReview, ReviewPass } from "@/lib/wails";
import { clockTime } from "@/lib/when";

// GONE_TAIL is what every text of a review that left says after what became of its pull request.
const GONE_TAIL =
  "MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.";

/**
 * goneReviewText is the text of the page of a review whose pull request left: who merged it, into what
 * and when, or when it closed, then what MySpec did and where the reports are.
 */
export function goneReviewText(archived: ArchivedReview, now: number): string {
  if (archived.outcome === "merged") {
    const at = timeOf(archived.mergedAt, now);
    const merged =
      archived.mergedBy === ""
        ? `It was merged into ${archived.baseBranch}${at}.`
        : `${archived.mergedBy} merged it into ${archived.baseBranch}${at}.`;
    return `${merged} ${GONE_TAIL}`;
  }
  return `It was closed${timeOf(archived.closedAt, now)}. ${GONE_TAIL}`;
}

// timeOf is " at 16:20", or "" when the moment wasn't kept.
function timeOf(iso: string, now: number): string {
  const time = clockTime(iso, now);
  return time === "" ? "" : ` at ${time}`;
}

/**
 * gonePassLines are the outcome of each pass with a report, for the page of a review that left: what
 * went to GitHub or to the agent, and when, "" when that wasn't kept.
 */
export function gonePassLines(
  archived: ArchivedReview,
  now: number,
): { text: string; time: string }[] {
  return (archived.passes ?? [])
    .filter((pass) => pass.recorded)
    .map((pass) => (archived.mode === "apply" ? appliedLine(pass, now) : publishedLine(pass, now)));
}

// publishedLine is a pass of publish mode: "Pass 1 · Request changes · 2 inline comments", or not published.
function publishedLine(pass: ReviewPass, now: number): { text: string; time: string } {
  if (!pass.published) {
    return { text: `Pass ${pass.pass} · not published`, time: "" };
  }
  const parts = [`Pass ${pass.pass}`, verdictName(pass.verdict), publishedWhat(pass)];
  return {
    text: parts.filter((part) => part !== "").join(" · "),
    time: clockTime(pass.publishedAt, now),
  };
}

// publishedWhat is what a published pass carried: "2 inline comments, 1 in the body", "2 findings in the
// body", "the summary", "the verdict only", or "a clean pass".
function publishedWhat(pass: ReviewPass): string {
  if (pass.clean) {
    return "a clean pass";
  }
  const findings = pass.findings ?? [];
  const inline = findings.filter((finding) => finding.placement === "inline").length;
  const body = findings.filter((finding) => finding.placement === "body").length;
  if (inline > 0) {
    const comments = counted(inline, "inline comment");
    return body > 0 ? `${comments}, ${body} in the body` : comments;
  }
  if (body > 0) {
    return `${counted(body, "finding")} in the body`;
  }
  return pass.summaryPublished ? "the summary" : "the verdict only";
}

// appliedLine is a pass of apply mode: "Pass 1 · 2 findings sent to the agent", "nothing approved", "a
// clean pass", or "not sent" for approved findings that never went.
function appliedLine(pass: ReviewPass, now: number): { text: string; time: string } {
  const approved = (pass.findings ?? []).filter(
    (finding) => finding.decision === "approved",
  ).length;
  if (pass.clean) {
    return { text: `Pass ${pass.pass} · a clean pass`, time: "" };
  }
  if (pass.sent && approved > 0) {
    return {
      text: `Pass ${pass.pass} · ${counted(approved, "finding")} sent to the agent`,
      time: clockTime(pass.sentAt, now),
    };
  }
  if (approved === 0) {
    return { text: `Pass ${pass.pass} · nothing approved`, time: "" };
  }
  return { text: `Pass ${pass.pass} · not sent`, time: "" };
}
