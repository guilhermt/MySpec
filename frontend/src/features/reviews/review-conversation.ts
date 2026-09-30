import type { FindingView } from "@/components/system/Finding";
import { fileName, findingName, headingOf, locationText } from "@/lib/findings";
import type { Entry, ReviewFinding, ReviewPass, ReviewSummary } from "@/lib/wails";
import { asMarkerType } from "@/lib/wails";
import { clockTime } from "@/lib/when";

// reportMarkerTypes are the markers that say the report of a pass was written or rewritten.
const REPORT_MARKERS = ["pr_review_written", "pr_review_revised"];

/** reportMarkerIds is, for each pass, the id of its latest report marker: the one that opens the report. */
export function reportMarkerIds(entries: readonly Entry[]): Map<number, string> {
  const ids = new Map<number, string>();
  for (const entry of entries) {
    const marker = entry.marker;
    if (marker !== null && REPORT_MARKERS.includes(asMarkerType(marker.type))) {
      ids.set(marker.pass, entry.id);
    }
  }
  return ids;
}

/** decidedMarkerPasses are the passes whose decisions the conversation recorded with a findings_decided marker. */
export function decidedMarkerPasses(entries: readonly Entry[]): Set<number> {
  const passes = new Set<number>();
  for (const entry of entries) {
    if (entry.marker !== null && entry.marker.type === "findings_decided") {
      passes.add(entry.marker.pass);
    }
  }
  return passes;
}

/**
 * derivedDecidedPasses are the passes published or sent with findings that the conversation has no
 * findings_decided marker for: a review from before the marker existed. Their line is derived from the
 * data and drawn right after the marker of their report.
 */
export function derivedDecidedPasses(
  review: ReviewSummary,
  entries: readonly Entry[],
): ReviewPass[] {
  const recorded = decidedMarkerPasses(entries);
  return (review.passes ?? []).filter(
    (pass) =>
      (pass.published || pass.sent) && (pass.findings ?? []).length > 0 && !recorded.has(pass.pass),
  );
}

/**
 * disabledFindingNote is where a finding went once its pass was published or sent: "Inline comment ·
 * published 13:41", "In the review body · published 13:41", "Not published"; in apply mode "Sent to the
 * agent · 13:41" or "Not sent".
 */
export function disabledFindingNote(
  review: ReviewSummary,
  pass: ReviewPass,
  finding: ReviewFinding,
  now: number,
): string {
  if (review.mode === "apply") {
    if (finding.decision !== "approved") {
      return "Not sent";
    }
    const sent = clockTime(pass.sentAt, now);
    return sent === "" ? "Sent to the agent" : `Sent to the agent · ${sent}`;
  }
  const published = clockTime(pass.publishedAt, now);
  const when = published === "" ? "published" : `published ${published}`;
  switch (finding.placement) {
    case "inline":
      return `Inline comment · ${when}`;
    case "body":
      return `In the review body · ${when}`;
    default:
      return "Not published";
  }
}

/**
 * findingViews are the findings of a pass as the system draws them. With disabled they carry where
 * each went, for the list a finished pass leaves in the conversation.
 */
export function findingViews(
  review: ReviewSummary,
  pass: ReviewPass,
  now: number,
  disabled = false,
): FindingView[] {
  const findings = pass.findings ?? [];
  return findings.map((finding) => {
    const { title, locationAsTitle } = headingOf(finding);
    return {
      id: String(finding.number),
      number: finding.number,
      name: findingName(finding, findings.length),
      title,
      locationAsTitle,
      location:
        finding.path === ""
          ? { kind: "general", text: locationText(finding) }
          : {
              kind: "anchored",
              text: locationText(finding),
              url: finding.lineUrl,
              line: finding.line,
              fileName: fileName(finding.path),
            },
      text: finding.text,
      decision:
        finding.decision === "approved" || finding.decision === "discarded" ? finding.decision : "",
      disabled: disabled ? disabledFindingNote(review, pass, finding, now) : null,
    };
  });
}
