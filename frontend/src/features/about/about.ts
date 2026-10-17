import { availableAnnouncement, failureReason } from "@/lib/update";
import type { Update, UpdateRelease } from "@/lib/wails";
import { age, dayOf, readClock } from "@/lib/when";

/** versionTitle is the installed version as the page heads it: MySpec 0.4.0, MySpec dev. */
export function versionTitle(update: Update): string {
  return `MySpec ${update.version}`;
}

/** NO_CHECKS is what a local build says in place of Check for updates. */
export const NO_CHECKS = "Local builds don't check for updates.";

/** HOW_TO_UPDATE says how to update until the app does it itself. */
export const HOW_TO_UPDATE =
  "To update, run the install command again in a terminal. Your data stays as it is.";

/** NO_NOTES is what a release without notes shows. */
export const NO_NOTES = "No notes for this release.";

/** signLabel is the name and the tooltip of the sign: "MySpec 0.5.0 is available. Open About." */
export function signLabel(latest: string): string {
  return `${availableAnnouncement(latest)} Open About.`;
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
