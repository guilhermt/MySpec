/**
 * messageOf is the message of a failure a binding rejected with, for the user
 * to read. Anything that is not an Error is shown as it prints.
 */
export function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

/** Remedy is what the user can do about a failed action, when the action has a known way out. */
export type Remedy =
  | "Try again."
  | "Check that gh is signed in."
  | "Change the path of the clone in Settings.";

/**
 * noticeDetail is the detail of the app notice: the message and, when there is one, what to do
 * (`<message>. <remedy>`). A message that already ends its sentence keeps its own stop.
 */
export function noticeDetail(message: string, remedy: Remedy | null): string {
  const said = message.trim();
  if (remedy === null) {
    return said;
  }
  if (said === "") {
    return remedy;
  }
  return /[.!?]$/.test(said) ? `${said} ${remedy}` : `${said}. ${remedy}`;
}

/**
 * isMissingFile says whether a failure to read a file is the file not being there, which Go words
 * as "no such file or directory" (os.ErrNotExist), rather than a read that failed.
 */
export function isMissingFile(message: string): boolean {
  return message.includes("no such file or directory");
}
