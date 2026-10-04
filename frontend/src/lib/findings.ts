import type { FindingView } from "@/components/system/Finding";
import { spokenTitle } from "@/lib/inline-code";

/** FindingLike is what the rules of the findings read of a finding: its number, its decision, its location. */
export interface FindingLike {
  number: number;
  /** decision is "", approved or discarded. */
  decision: string;
  /** path is the file of the finding; "" for a general one. */
  path: string;
  line: number;
  title: string;
}

/** isDecided reports whether the user decided on a finding. */
export function isDecided(finding: FindingLike): boolean {
  return finding.decision !== "";
}

// toDecide are the findings still to decide, in the order given.
function toDecide(findings: readonly FindingLike[]): FindingLike[] {
  return findings.filter((finding) => !isDecided(finding));
}

/** nextToDecide is the first finding to decide after the one numbered after, or from the start when none is left: the wrap. null without any. */
export function nextToDecide(
  findings: readonly FindingLike[],
  after: number | null,
): number | null {
  const open = toDecide(findings);
  const next = open.find((finding) => after === null || finding.number > after) ?? open[0];
  return next?.number ?? null;
}

/** previousToDecide is the mirror of nextToDecide: the finding to decide before the one numbered before, wrapping from the end. */
export function previousToDecide(
  findings: readonly FindingLike[],
  before: number | null,
): number | null {
  const open = toDecide(findings).reverse();
  const previous = open.find((finding) => before === null || finding.number < before) ?? open[0];
  return previous?.number ?? null;
}

/** locationText is where a finding sits: "web/src/settings/GeneralForm.tsx:84", or "General · not on a line of the diff". */
export function locationText(finding: FindingLike): string {
  return finding.path === ""
    ? "General · not on a line of the diff"
    : `${finding.path}:${finding.line}`;
}

/** fileName is the file of a path: "GeneralForm.tsx". */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** headingOf is the title a finding opens with; without one, its location takes the place. */
export function headingOf(finding: FindingLike): { title: string; locationAsTitle: boolean } {
  return finding.title === ""
    ? { title: locationText(finding), locationAsTitle: true }
    : { title: finding.title, locationAsTitle: false };
}

/** decidedCounts is how many findings were decided, approved, discarded, and how many there are. */
export function decidedCounts(findings: readonly FindingLike[]): {
  decided: number;
  approved: number;
  discarded: number;
  total: number;
} {
  const approved = findings.filter((finding) => finding.decision === "approved").length;
  const discarded = findings.filter((finding) => finding.decision === "discarded").length;
  return { decided: approved + discarded, approved, discarded, total: findings.length };
}

const STATES: Record<string, string> = {
  "": "Not decided",
  approved: "Approved",
  discarded: "Discarded",
};

/** findingName is the accessible name of a finding: "Finding 2 of 3: <title>. <file>, line 31. Not decided." */
export function findingName(finding: FindingLike, total: number): string {
  const where = finding.path === "" ? "General" : `${finding.path}, line ${finding.line}`;
  const said = finding.title === "" ? [where] : [spokenTitle(finding.title), where];
  const state = STATES[finding.decision] ?? STATES[""];
  return `Finding ${finding.number} of ${total}: ${said.join(". ")}. ${state}.`;
}

/** FindingRow is a finding as the views read it: the rules' fields, its line on GitHub and its text. */
export interface FindingRow extends FindingLike {
  lineUrl: string;
  text: string;
}

/** findingViewsOf are findings as the system draws them; with disabledNote, each one disabled, with where it went. */
export function findingViewsOf<T extends FindingRow>(
  findings: readonly T[],
  disabledNote: ((finding: T) => string) | null,
): FindingView[] {
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
      disabled: disabledNote === null ? null : disabledNote(finding),
    };
  });
}
