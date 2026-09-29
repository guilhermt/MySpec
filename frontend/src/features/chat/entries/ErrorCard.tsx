import { asErrorKind, type ErrorEntry, type ErrorKind } from "@/lib/wails";

const TITLES: Record<ErrorKind, string> = {
  process_exit: "The session stopped unexpectedly",
  start_failed: "Couldn't start Claude Code",
  not_found: "Claude Code not found",
  not_logged_in: "Claude Code isn't logged in",
  turn_error: "The agent couldn't finish",
};

export interface ErrorCardProps {
  taskId: string;
  stage: string;
  error: ErrorEntry;
  /** readOnly is the card of an earlier conversation, which is never retried. */
  readOnly?: boolean;
}

/** ErrorCard is a failure the user has to see; retrying is on the request bar. */
export function ErrorCard({ error }: ErrorCardProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
    >
      <p className="font-medium">{TITLES[asErrorKind(error.kind)]}</p>
      {error.message !== "" && <p className="break-words select-text">{error.message}</p>}
    </div>
  );
}
