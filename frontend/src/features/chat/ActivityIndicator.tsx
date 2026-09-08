import type { SessionState } from "@/features/chat/session";
import { cn } from "@/lib/utils";
import { asActionStatus, type Entry } from "@/lib/wails";

const DOTS = ["[animation-delay:0ms]", "[animation-delay:150ms]", "[animation-delay:300ms]"];

function activityText(session: SessionState): string {
  if (session.retryAttempt > 0) {
    return `Retrying (attempt ${session.retryAttempt})…`;
  }
  // A turn with no process behind it is a session on its way up.
  if (!session.processRunning) {
    return "Starting session…";
  }
  return "Thinking…";
}

// While text streams or a tool runs, the conversation already says what is
// going on; the indicator is for the silence between the two.
function isSilent(last: Entry | undefined): boolean {
  if (last === undefined) {
    return true;
  }
  if (last.action !== null) {
    return asActionStatus(last.action.status) !== "running";
  }
  if (last.assistant !== null) {
    return last.assistant.complete;
  }
  return true;
}

export interface ActivityIndicatorProps {
  session: SessionState;
  /** entries are the conversation so far, to tell work from silence. */
  entries: readonly Entry[];
}

/** ActivityIndicator is the quiet sign that the agent is busy thinking. */
export function ActivityIndicator({ session, entries }: ActivityIndicatorProps) {
  if (!session.turnRunning || !isSilent(entries.at(-1))) {
    return null;
  }
  const text = activityText(session);

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.replace("…", "")}</span>
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {DOTS.map((delay) => (
          <span
            key={delay}
            className={cn("size-1 animate-bounce rounded-full bg-current", delay)}
          />
        ))}
      </span>
    </p>
  );
}
