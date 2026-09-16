/**
 * messageOf is the message of a failure a binding rejected with, for the user
 * to read. Anything that is not an Error is shown as it prints.
 */
export function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}
