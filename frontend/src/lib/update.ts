import type { Update, UpdateFailure } from "@/lib/wails";
import { asUpdateFailureKind } from "@/lib/wails";

/** FAILURE_TITLE heads a failed check the user asked for. */
export const FAILURE_TITLE = "Couldn't check for updates";

/** UP_TO_DATE is what a successful check without a newer version says. */
export const UP_TO_DATE = "You're on the latest version.";

/** availableText is how the app says a newer version is known: "MySpec 0.5.0 is available". */
export function availableText(version: string): string {
  return `MySpec ${version} is available`;
}

/** availableAnnouncement is what the live region says when a newer version becomes known: "MySpec 0.5.0 is available." */
export function availableAnnouncement(version: string): string {
  return `${availableText(version)}.`;
}

/**
 * newlyAvailable is the version that became known between two states: the latest of next when it
 * is not "" and differs from the latest of previous (previous undefined counts as ""); null otherwise.
 */
export function newlyAvailable(
  previous: Update | undefined,
  next: Update | undefined,
): string | null {
  const latest = next?.latest ?? "";
  return latest !== "" && latest !== (previous?.latest ?? "") ? latest : null;
}

/**
 * failureReason is the short sentence of a failed check: No connection to GitHub.,
 * GitHub's rate limit was reached. Try again later., GitHub didn't answer in time., or the detail of
 * an unexpected failure.
 */
export function failureReason(failure: UpdateFailure): string {
  switch (asUpdateFailureKind(failure.kind)) {
    case "offline":
      return "No connection to GitHub.";
    case "rate_limited":
      return "GitHub's rate limit was reached. Try again later.";
    case "timeout":
      return "GitHub didn't answer in time.";
    case "failed":
      return failure.detail === "" ? "Something went wrong." : failure.detail;
  }
}
