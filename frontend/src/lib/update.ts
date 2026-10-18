import type { Update, UpdateFailure, UpdateInstallFailure } from "@/lib/wails";
import { asInstallFailureKind, asInstallPhase, asUpdateFailureKind } from "@/lib/wails";

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

/** updateLabel is the action of the block of the newer version: "Update to 0.5.0". */
export function updateLabel(version: string): string {
  return `Update to ${version}`;
}

/** UPDATING is the gerund of Update to while the installation runs. */
export const UPDATING = "Updating…";

/** updatingText is how the app says it is updating: "Updating to MySpec 0.5.0…"; "Updating MySpec…" without a version. */
export function updatingText(target: string): string {
  return target === "" ? "Updating MySpec…" : `Updating to MySpec ${target}…`;
}

/** installedText heads an installed version: "MySpec 0.5.0 is installed". */
export function installedText(version: string): string {
  return `MySpec ${version} is installed`;
}

/** restartText is how the app asks for a restart: "MySpec 0.5.0 is installed. Restart to use it." */
export function restartText(version: string): string {
  return `${installedText(version)}. Restart to use it.`;
}

/** INSTALL_FAILURE_TITLE heads a failed installation. */
export const INSTALL_FAILURE_TITLE = "Couldn't update";

/** installFailureReason is the short sentence of a failed installation. */
export function installFailureReason(failure: UpdateInstallFailure): string {
  switch (asInstallFailureKind(failure.kind)) {
    case "offline":
      return "No connection to GitHub.";
    case "rate_limited":
      return "GitHub's rate limit was reached.";
    case "timeout":
      return "GitHub didn't answer in time.";
    case "libraries":
    case "system":
      return failure.reason;
    case "replace":
      return "A file of MySpec couldn't be replaced.";
    case "failed":
      return failure.reason === "" ? "Something went wrong." : failure.reason;
  }
}

/** installFailureRemedy is what to do about a failed installation; "" when the reason says it. */
export function installFailureRemedy(failure: UpdateInstallFailure): string {
  switch (asInstallFailureKind(failure.kind)) {
    case "offline":
      return "Check the connection and try again.";
    case "rate_limited":
      return "Try again later.";
    case "timeout":
      return "Try again.";
    case "libraries":
      return "Install them, then try again.";
    case "system":
      return "";
    case "replace":
      return "Close MySpec and run the install command in a terminal.";
    case "failed":
      return "Try again, or run the install command in a terminal.";
  }
}

/** installAnnouncement is what the live region says when the installation changes phase between two states; null otherwise. */
export function installAnnouncement(
  previous: Update | undefined,
  next: Update | undefined,
): string | null {
  const before = asInstallPhase(previous?.install.phase ?? "idle");
  const after = asInstallPhase(next?.install.phase ?? "idle");
  if (next === undefined) {
    return null;
  }
  if (before !== "installing") {
    return after === "installing" ? updatingText(next.install.target) : null;
  }
  switch (after) {
    case "installed":
      return (next.install.working ?? []).length > 0
        ? restartText(next.install.version)
        : `${installedText(next.install.version)}. Restarting…`;
    case "failed":
      return next.install.failure === null
        ? null
        : `${INSTALL_FAILURE_TITLE}. ${installFailureReason(next.install.failure)}`;
    case "idle":
      return UP_TO_DATE;
    case "installing":
      return null;
  }
}
