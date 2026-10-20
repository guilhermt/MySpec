import { locationTitle } from "@/lib/locations";
import { availableText, failureReason, restartText, updatingText } from "@/lib/update";
import type {
  State,
  Update,
  UpdateInstallFailure,
  UpdateRelease,
  UpdateWorking,
} from "@/lib/wails";
import { asInstallPhase } from "@/lib/wails";
import { age, dayOf, readClock } from "@/lib/when";

/** versionTitle is the installed version as the page heads it: MySpec 0.4.0, MySpec dev. */
export function versionTitle(update: Update): string {
  return `MySpec ${update.version}`;
}

/** NO_CHECKS is what a local build says in place of Check for updates. */
export const NO_CHECKS = "Local builds don't check for updates.";

/** keepsRunningText says the installed version waits for a restart: "Restart to use it. Until then, MySpec 0.4.0 keeps running." */
export function keepsRunningText(running: string): string {
  return `Restart to use it. Until then, MySpec ${running} keeps running.`;
}

/** STOPS_AGENTS heads the conversations whose agent works, which a restart cuts. */
export const STOPS_AGENTS = "Restarting now stops the agents that are working:";

/** NO_AGENTS is what the page says when a restart cuts nothing. */
export const NO_AGENTS = "No agent is working. Restarting stops nothing.";

/** RESTART_FAILURE_TITLE heads a restart that couldn't start the installed version. */
export const RESTART_FAILURE_TITLE = "Couldn't restart";

/** RESTART_REMEDY is what to do when the restart failed. */
export const RESTART_REMEDY = "Close MySpec and open it again.";

/** ALTERNATIVE offers the install command after a failed installation. */
export const ALTERNATIVE = "Or run the install command in a terminal. Your data stays as it is.";

/** UPDATING_NOTE tells the user the app stays usable while it installs. */
export const UPDATING_NOTE = "You can keep working meanwhile.";

/** NO_NOTES is what a release without notes shows. */
export const NO_NOTES = "No notes for this release.";

/** UpdateBlock is what the block of the newer version shows. */
export type UpdateBlock =
  | { kind: "none" } // no newer version known and nothing installing
  | { kind: "available"; version: string } // Update to <version>
  | { kind: "updating"; version: string } // Updating…
  | { kind: "failed"; version: string; failure: UpdateInstallFailure } // Couldn't update, Try again
  | { kind: "installed"; version: string }; // installed, Restart now

/** updateBlockOf is the block of the newer version: the installation when one ran, else the newest version known. */
export function updateBlockOf(update: Update): UpdateBlock {
  if (!update.checks) {
    return { kind: "none" };
  }
  const { install } = update;
  switch (asInstallPhase(install.phase)) {
    case "installed":
      return { kind: "installed", version: install.version };
    case "installing":
      return { kind: "updating", version: install.target === "" ? update.latest : install.target };
    case "failed":
      if (install.failure !== null) {
        return {
          kind: "failed",
          version: update.latest === "" ? install.target : update.latest,
          failure: install.failure,
        };
      }
      break;
    case "idle":
      break;
  }
  return update.latest !== "" ? { kind: "available", version: update.latest } : { kind: "none" };
}

/** UpdateSign is the state of the sign and of the mark of About: null without one. */
export type UpdateSign =
  | { kind: "available"; version: string }
  | { kind: "updating"; version: string }
  | { kind: "installed"; version: string };

/** signOf is the sign of the newer version, from the block: failed counts as available. */
export function signOf(update: Update): UpdateSign | null {
  const block = updateBlockOf(update);
  switch (block.kind) {
    case "none":
      return null;
    case "failed":
      return { kind: "available", version: block.version };
    default:
      return block;
  }
}

/** signText is what the sign and the mark say: "MySpec 0.5.0 is available", "Updating to MySpec 0.5.0…", "MySpec 0.5.0 is installed. Restart to use it." */
export function signText(sign: UpdateSign): string {
  switch (sign.kind) {
    case "available":
      return availableText(sign.version);
    case "updating":
      return updatingText(sign.version);
    case "installed":
      return restartText(sign.version);
  }
}

/** sentenceOf ends a text as a sentence: a full stop unless it already ends in a stop or an ellipsis. */
function sentenceOf(text: string): string {
  return text.endsWith(".") || text.endsWith("…") ? text : `${text}.`;
}

/** signLabel is the name and the tooltip of the sign: "MySpec 0.5.0 is available. Open About." */
export function signLabel(sign: UpdateSign): string {
  return `${sentenceOf(signText(sign))} Open About.`;
}

/** workingPlace is where in an item an agent works, as the page lists it: "Step 3", "Reviewer of step 3", "PR review". */
function workingPlace(stage: string): string {
  switch (stage) {
    case "prd":
      return "PRD";
    case "tech_spec":
      return "Tech spec";
    case "plan":
      return "Plan";
    case "one_shot":
      return "Planning";
    case "pr":
      return "PR";
    case "pr_review":
      return "PR review";
    case "pr_fix":
      return "PR review · Implementer";
    case "review":
      return "Review";
    case "discussion":
      return "Discussion";
  }
  const step = /^step:(\d+)$/.exec(stage);
  if (step !== null) {
    return `Step ${step[1]}`;
  }
  const reviewer = /^step_review:(\d+)$/.exec(stage);
  if (reviewer !== null) {
    return `Reviewer of step ${reviewer[1]}`;
  }
  return stage;
}

/** workingLines are the conversations a restart cuts, as the page lists them: "Add login · Step 3", "acme/api#12 · Review". */
export function workingLines(app: State | null, working: readonly UpdateWorking[]): string[] {
  return working.map(({ itemId: id, stage }) => {
    const title =
      locationTitle(app, { kind: "task", id }) ||
      locationTitle(app, { kind: "review", id }) ||
      locationTitle(app, { kind: "discussion", id });
    const place = workingPlace(stage);
    return title === "" ? place : `${title} · ${place}`;
  });
}

/** releaseHeading is the heading of a release: "0.4.0 · Oct 16", "0.4.0 · Oct 16, 2025" before this year. */
export function releaseHeading(release: UpdateRelease, now: number): string {
  return `${release.version} · ${dayOf(release.publishedAt, now)}`;
}

/** checkedText is when the last successful check ended: "Checked 5m ago", "Checked just now". */
export function checkedText(checkedAt: string, now: number): string {
  return `Checked ${age(checkedAt, now)}`;
}

/** checkedTip is the tooltip of checkedText: "Last checked at 14:08", "Last checked yesterday at 17:40". */
export function checkedTip(checkedAt: string, now: number): string {
  return `Last checked ${readClock(checkedAt, now)}`;
}

/** UpdateResult is what the page says of the last check, below the version. */
export type UpdateResult =
  | { kind: "local" } // a build that never checks: NO_CHECKS
  | { kind: "failed"; reason: string } // FAILURE_TITLE and failureReason
  | { kind: "latest" } // UP_TO_DATE
  | { kind: "available" } // the block of the newer version says it
  | { kind: "none" }; // nothing checked yet, or the first check runs

/** resultOf is what the page says of the last check: local, then failed, then available, then latest after a success, else none. */
export function resultOf(update: Update): UpdateResult {
  if (!update.checks) {
    return { kind: "local" };
  }
  if (update.failure !== null) {
    return { kind: "failed", reason: failureReason(update.failure) };
  }
  if (update.latest !== "") {
    return { kind: "available" };
  }
  return update.checkedAt !== "" ? { kind: "latest" } : { kind: "none" };
}
