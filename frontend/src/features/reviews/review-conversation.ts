import type { FindingView } from "@/components/system/Finding";
import { fileName, findingName, headingOf, locationText } from "@/lib/findings";
import { type ChecksReading, unfinishedChecks } from "@/lib/pull-requests";
import { shortName } from "@/lib/repositories";
import type { Entry, ReviewFinding, ReviewPass, ReviewSummary } from "@/lib/wails";
import { asMarkerType, asMergeable, asPullReviewStatus } from "@/lib/wails";
import { clockTime } from "@/lib/when";

// LEFT_BEHIND are the statuses that say a Review again left the last pass behind: the next one was asked for.
const LEFT_BEHIND = ["waiting_checks", "pass_blocked"];

/**
 * currentCardPass is the pass whose findings the card below the conversation holds: the last one, when
 * its report is recorded with findings, it wasn't published or sent, and no pass after it was asked
 * for; null otherwise.
 */
export function currentCardPass(review: ReviewSummary): ReviewPass | null {
  const last = (review.passes ?? []).at(-1);
  if (
    last === undefined ||
    !last.recorded ||
    last.clean ||
    (last.findings ?? []).length === 0 ||
    last.published ||
    last.sent ||
    LEFT_BEHIND.includes(review.status)
  ) {
    return null;
  }
  return last;
}

// FOOT_NAMES is how many checks the foot of the wait names before "and 2 more".
const FOOT_NAMES = 3;

// waitingPass is the pass that waits for the checks: the last one asked for and not recorded, else the
// one after the last report.
function waitingPass(review: ReviewSummary): number {
  const last = (review.passes ?? []).at(-1);
  if (last === undefined) {
    return 1;
  }
  return last.recorded ? last.pass + 1 : last.pass;
}

// listed is names joined as a sentence: "a", "a and b", "a, b and c", "a, b, c and 2 more".
function listed(names: readonly string[]): string {
  const shown = names.slice(0, FOOT_NAMES);
  const more = names.length - shown.length;
  const parts = more > 0 ? [...shown, `${more} more`] : shown;
  const last = parts.at(-1) ?? "";
  return parts.length === 1 ? last : `${parts.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * waitingChecksFoot is what the wait for the checks says under them: which checks the pass waits on
 * and whether GitHub still has to say the pull request merges clean, then that you can leave: "The
 * first pass starts when e2e / chromium and preview-deploy finish. MySpec reads web#2291 every minute;
 * you can leave meanwhile."
 */
export function waitingChecksFoot(review: ReviewSummary): string {
  const pass = waitingPass(review);
  const subject = pass === 1 ? "The first pass" : `Pass ${pass}`;
  const reference = `${shortName(review.repository)}#${review.number}`;
  const reading: ChecksReading = {
    checks: review.checks,
    mergeable: asMergeable(review.mergeable),
    checkedAt: review.checkedAt,
    base: review.baseBranch,
  };
  const names = unfinishedChecks(reading);
  const mergeUnknown = reading.mergeable === "unknown" || reading.mergeable === "";
  let starts: string;
  if (names.length === 0) {
    starts = mergeUnknown ? `GitHub says whether ${reference} merges clean` : "the checks finish";
  } else {
    const finish = names.length === 1 ? "finishes" : "finish";
    const merge = mergeUnknown ? " and GitHub says whether it merges clean" : "";
    starts = `${listed(names)} ${finish}${merge}`;
  }
  return `${subject} starts when ${starts}. MySpec reads ${reference} every minute; you can leave meanwhile.`;
}

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

/**
 * reviewFixedCard is the fixed card at the end of the conversation of the review: the live checks
 * while the pass waits for them, the changed files from the moment the agent rests with the changes it
 * made applying the findings until the commit that takes them is over; null otherwise.
 */
export function reviewFixedCard(review: ReviewSummary): "checks" | "files" | null {
  switch (asPullReviewStatus(review.status)) {
    case "waiting_checks":
      return "checks";
    case "in_review":
    case "ready_to_approve":
    case "committing":
      return "files";
    default:
      return null;
  }
}
