import type { MarkerEntry } from "@/lib/wails";

// counted is a count with its noun: "1 finding", "3 findings".
function counted(count: number, noun: string): string {
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
