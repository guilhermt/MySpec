import type {
  MarkerEntry,
  ReviewFinding,
  ReviewPass,
  ReviewSummary,
  ReviewVerdict,
} from "@/lib/wails";

/** counted is a count with its noun: "1 finding", "3 findings". */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** verdictName is the verdict of a published review as GitHub calls it: Request changes, Approve, Comment. */
export function verdictName(verdict: string): string {
  switch (verdict) {
    case "request_changes":
      return "Request changes";
    case "approve":
      return "Approve";
    case "comment":
      return "Comment";
    default:
      return "";
  }
}

/** VERDICTS are the verdicts the publish dialog offers, in its order, with the key that picks each. */
export const VERDICTS: readonly {
  verdict: ReviewVerdict;
  key: "1" | "2" | "3";
  name: string;
  description: string;
}[] = [
  {
    verdict: "request_changes",
    key: "1",
    name: verdictName("request_changes"),
    description: "The author addresses the findings before the merge.",
  },
  {
    verdict: "approve",
    key: "2",
    name: verdictName("approve"),
    description: "It can be merged as it is.",
  },
  {
    verdict: "comment",
    key: "3",
    name: verdictName("comment"),
    description: "Feedback without a verdict.",
  },
];

/**
 * PublishAttemptLike is what the publish dialog held when a publication failed: the pass, the verdict
 * and the summary box. The store keeps it by review; this is its shape, so the rules don't read the store.
 */
export interface PublishAttemptLike {
  pass: number;
  verdict: ReviewVerdict | null;
  withSummary: boolean;
}

// approvedOf are the findings of a pass the user approved.
function approvedOf(pass: ReviewPass): ReviewFinding[] {
  return (pass.findings ?? []).filter((finding) => finding.decision === "approved");
}

// hasSummary says whether the summary goes with the review: the box is checked and the summary says something.
function hasSummary(pass: ReviewPass, withSummary: boolean): boolean {
  return withSummary && pass.summary.trim() !== "";
}

/**
 * suggestedVerdict is the verdict the decisions of a pass suggest, with why: an approved finding
 * suggests Request changes; nothing approved, or a clean pass, Approve. Your own pull request has none.
 */
export function suggestedVerdict(
  review: ReviewSummary,
  pass: ReviewPass,
): { verdict: ReviewVerdict; why: string } | null {
  if (review.own) {
    return null;
  }
  if (pass.clean) {
    return { verdict: "approve", why: "Suggested by your decisions: a clean pass" };
  }
  const approved = approvedOf(pass).length;
  if (approved > 0) {
    return {
      verdict: "request_changes",
      why: `Suggested by your decisions: ${counted(approved, "finding")} approved`,
    };
  }
  return { verdict: "approve", why: "Suggested by your decisions: nothing approved" };
}

/**
 * allowedVerdicts are the verdicts GitHub takes for what the review carries, with why the others are
 * out: your own pull request takes only Comment, and a review without a summary and an approved
 * finding only Approve.
 */
export function allowedVerdicts(
  review: ReviewSummary,
  pass: ReviewPass,
  withSummary: boolean,
): { allowed: ReviewVerdict[]; reason: string | null } {
  const bare = !hasSummary(pass, withSummary) && approvedOf(pass).length === 0;
  if (review.own && bare) {
    return {
      allowed: [],
      reason:
        "Your own pull request takes only Comment, and a comment needs the summary or an approved finding.",
    };
  }
  if (review.own) {
    return { allowed: ["comment"], reason: "Your own pull request: GitHub takes only Comment." };
  }
  if (bare) {
    return {
      allowed: ["approve"],
      reason: "Without a summary and an approved finding, GitHub takes only Approve.",
    };
  }
  return { allowed: VERDICTS.map((option) => option.verdict), reason: null };
}

/**
 * goesLine is what a publication of the pass sends to GitHub, as the dialog says it: "2 inline comments ·
 * the summary in the body · 1 finding discarded, not published". Request changes and Comment without a
 * body carry the minimal one, and the line says so. An anchored finding counts as inline: whether its
 * line is still in the diff is only known when publishing.
 */
export function goesLine(
  pass: ReviewPass,
  withSummary: boolean,
  verdict: ReviewVerdict | null,
): string {
  const summary = hasSummary(pass, withSummary);
  const then = summary ? "the summary and the verdict" : "the verdict only";
  if (pass.clean) {
    return `A clean pass · ${then}`;
  }
  const findings = pass.findings ?? [];
  const discarded = findings.filter((finding) => finding.decision === "discarded").length;
  const tail = discarded > 0 ? ` · ${counted(discarded, "finding")} discarded, not published` : "";
  const approved = approvedOf(pass);
  if (approved.length === 0) {
    return `No finding approved · ${then}${tail}`;
  }
  const inline = approved.filter((finding) => finding.path !== "").length;
  const body = approved.length - inline;
  const minimal =
    inline > 0 &&
    body === 0 &&
    !summary &&
    (verdict === "request_changes" || verdict === "comment");
  return `${publishedGoes({ inline, body, summary, minimal })}${tail}`;
}

// SUMMARY_START_MAX is how many characters of the summary the publish dialog shows under its box.
const SUMMARY_START_MAX = 150;

/**
 * summaryStart is the start of the summary the publish dialog shows: up to 150 characters, cut at the
 * last whole word with "…", the Markdown as text and its line breaks as spaces; "" when it is empty.
 */
export function summaryStart(summary: string): string {
  const text = summary.trim().replace(/\s+/g, " ");
  if (text.length <= SUMMARY_START_MAX) {
    return text;
  }
  const cut = text.slice(0, SUMMARY_START_MAX + 1);
  const space = cut.lastIndexOf(" ");
  const start = space > 0 ? cut.slice(0, space) : text.slice(0, SUMMARY_START_MAX);
  return `${start.trimEnd()}…`;
}

/** publishLabel is the primary button of the publish dialog: Publish, or Publish · Request changes once a verdict is chosen. */
export function publishLabel(verdict: ReviewVerdict | null): string {
  return verdict === null ? "Publish" : `Publish · ${verdictName(verdict)}`;
}

/** publishReason is why Publish is disabled, at the left of the footer; null once a verdict is chosen. */
export function publishReason(
  allowed: readonly ReviewVerdict[],
  verdict: ReviewVerdict | null,
): string | null {
  if (allowed.length === 0) {
    return "Nothing GitHub takes yet";
  }
  return verdict === null ? "Choose a verdict" : null;
}

/**
 * initialVerdict is the verdict the dialog opens with: the only one GitHub takes, or the one of a
 * failed attempt on the same pass while it is still allowed; else none.
 */
export function initialVerdict(
  allowed: readonly ReviewVerdict[],
  attempt: PublishAttemptLike | null,
  pass: number,
): ReviewVerdict | null {
  const [only] = allowed;
  if (allowed.length === 1 && only !== undefined) {
    return only;
  }
  if (attempt !== null && attempt.pass === pass && attempt.verdict !== null) {
    return allowed.includes(attempt.verdict) ? attempt.verdict : null;
  }
  return null;
}

/**
 * publishedGoes is where a published review went, from the fields of its marker: "2 inline comments ·
 * the summary in the body". A body that was only the minimal one says so, and a review with nothing
 * to say but its verdict says that.
 */
export function publishedGoes(
  marker: Pick<MarkerEntry, "inline" | "body" | "summary" | "minimal">,
): string {
  const inline = marker.inline > 0 ? counted(marker.inline, "inline comment") : "";
  const goes = [inline, bodyGoes(marker)].filter((part) => part !== "");
  return goes.length === 0 ? "the verdict only" : goes.join(" · ");
}

// bodyGoes is what went in the body of the review, "" when it had none.
function bodyGoes(marker: Pick<MarkerEntry, "inline" | "body" | "summary" | "minimal">): string {
  if (marker.minimal) {
    return `"Review with ${counted(marker.inline, "inline comment")}." in the body`;
  }
  if (marker.body > 0) {
    const findings = counted(marker.body, "finding");
    return marker.summary ? `${findings} and the summary in the body` : `${findings} in the body`;
  }
  if (marker.summary) {
    return "the summary in the body";
  }
  return marker.inline > 0 ? "nothing in the body" : "";
}
