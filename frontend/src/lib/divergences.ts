import type { Divergence } from "@/lib/wails";
import { asDivergenceKind } from "@/lib/wails";

/** DivergenceText is what the app expected and what it found, as two sentences with no final full stop. */
export interface DivergenceText {
  expected: string;
  found: string;
}

/** DivergenceAction is one way out of a divergence, in the order the buttons show. */
export type DivergenceAction =
  | { kind: "checkAgain"; label: string }
  | { kind: "askAgain"; label: string }
  | { kind: "adopt"; choice: string; label: string }
  | { kind: "openPR"; label: string };

const REPORT_PREFIX = /^The report can't be read:\s*/;

/** Plain trims the reason of a divergence down to a phrase: no prefix of the app, no final full stop. */
function plain(reason: string): string {
  return reason.replace(REPORT_PREFIX, "").replace(/\.+$/, "").trim();
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function list(items: string[]): string {
  if (items.length < 2) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function prNumbers(d: Divergence): string[] {
  return (d.prs ?? []).map((pr) => `#${pr.number}`);
}

/** divergenceText says what the app expected and what it found, for the bar, the marker and the sidebar. */
export function divergenceText(d: Divergence): DivergenceText {
  const report = `the report of pass ${d.pass} at ${d.path}`;
  const first = (d.prs ?? [])[0];
  const candidates = d.candidates ?? [];
  switch (asDivergenceKind(d.kind)) {
    case "commit_missing": {
      const found =
        d.files === 0
          ? "no commit, and the worktree has no changes"
          : `no commit, and ${d.files} ${plural(d.files, "file", "files")} changed in the worktree`;
      return { expected: `a commit on ${d.branch} after ${d.commit}`, found };
    }
    case "report_missing":
      return { expected: report, found: "no report" };
    case "report_unreadable":
      return { expected: report, found: `a report that can't be read: ${plain(d.reason)}` };
    case "reports_ambiguous":
      return {
        expected: report,
        found: `${candidates.length} files that could be it: ${candidates.join(", ")}`,
      };
    case "draft_missing":
      return { expected: `the draft of the pull request at ${d.path}`, found: "no draft" };
    case "draft_unreadable":
      return {
        expected: `the draft of the pull request at ${d.path}`,
        found: `a draft that can't be read: ${plain(d.reason)}`,
      };
    case "no_changes": {
      const findings =
        d.approved === 1 ? "the approved finding" : `the ${d.approved} approved findings`;
      return { expected: `changes for ${findings} of pass ${d.pass}`, found: "no file changed" };
    }
    case "pr_wrong_base":
      return {
        expected: `a pull request into ${d.base}`,
        found: `#${first?.number} into ${first?.base}`,
      };
    case "pr_other_branch":
      return {
        expected: `a pull request from ${d.branch}`,
        found: `#${first?.number} from ${first?.head}, with the head of the task`,
      };
    case "prs_ambiguous":
      return { expected: `one pull request from ${d.branch}`, found: list(prNumbers(d)) };
    case "pr_not_opened":
      return {
        expected: `the pull request into ${d.base}, approved in the draft`,
        found: "none on GitHub",
      };
    case "push_rejected":
      return {
        expected: `${d.branch} on origin with ${d.commit}`,
        found: `origin has commits ${d.branch} doesn't`,
      };
    case "drafts_unreadable":
      return { expected: "drafts.md in the format of the discussion", found: plain(d.reason) };
  }
}

/** askLabel names who the divergence asks again: the reviewer for a report, the implementer for the commit of a pull request. */
function askLabel(d: Divergence): string {
  const kind = asDivergenceKind(d.kind);
  if (kind.startsWith("report")) {
    return "Ask the reviewer again";
  }
  const ofPullRequest = d.stage === "pr_fix" || d.stage === "pr_review" || d.stage === "review";
  if ((kind === "commit_missing" || kind === "no_changes") && ofPullRequest) {
    return "Ask the implementer again";
  }
  return "Ask the agent again";
}

/** divergenceActions lists the ways out of a divergence; the first is the primary one. */
export function divergenceActions(d: Divergence): DivergenceAction[] {
  const kind = asDivergenceKind(d.kind);
  const checkAgain: DivergenceAction = {
    kind: "checkAgain",
    label: kind === "push_rejected" ? "Try the push again" : "Check again",
  };
  const askAgain: DivergenceAction = { kind: "askAgain", label: askLabel(d) };
  switch (kind) {
    case "pr_not_opened":
      return [{ kind: "openPR", label: "Open the pull request" }, checkAgain];
    case "pr_wrong_base":
    case "pr_other_branch":
    case "prs_ambiguous":
      return [
        ...(d.prs ?? []).map(
          (pr): DivergenceAction => ({
            kind: "adopt",
            choice: String(pr.number),
            label: `Adopt #${pr.number}`,
          }),
        ),
        checkAgain,
      ];
    case "reports_ambiguous":
      return [
        ...(d.candidates ?? []).map(
          (path): DivergenceAction => ({
            kind: "adopt",
            choice: path,
            label: `Adopt ${baseName(path)}`,
          }),
        ),
        checkAgain,
      ];
    case "no_changes":
      return [
        { kind: "adopt", choice: "", label: "Continue without changes" },
        askAgain,
        checkAgain,
      ];
    case "push_rejected":
      return [checkAgain];
    default:
      return [askAgain, checkAgain];
  }
}
