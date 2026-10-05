import { LiveRegion } from "@/components/system/LiveRegion";
import { Spinner } from "@/components/system/Spinner";
import { useNow } from "@/features/attention/useNow";
import type { SessionState } from "@/features/chat/session";
import { asActionStatus, asRetryReason, type Entry, type RetryReason } from "@/lib/wails";
import { duration } from "@/lib/when";

// REASONS are why the API call is being retried (§4.2 A atividade).
const REASONS: Record<RetryReason, string> = {
  "": "",
  overloaded: "the API is overloaded",
  rate_limit: "the rate limit was reached",
  server: "the API failed",
  connection: "the connection failed",
  other: "the API refused the request",
};

// nextTry is the countdown to the next attempt: "next try in 8s", "retrying now" at zero.
function nextTry(retryAt: string, now: number): string {
  const at = Date.parse(retryAt);
  if (Number.isNaN(at)) {
    return "";
  }
  const seconds = Math.ceil((at - now) / 1000);
  return seconds > 0 ? `next try in ${duration(seconds * 1000)}` : "retrying now";
}

// retryText is "Retrying · attempt 3 of 10 · the API is overloaded", what the retry says without
// the countdown.
function retryText(session: SessionState): string {
  const attempt =
    session.retryMax > 0
      ? `attempt ${session.retryAttempt} of ${session.retryMax}`
      : `attempt ${session.retryAttempt}`;
  return ["Retrying", attempt, REASONS[asRetryReason(session.retryReason)]]
    .filter((part) => part !== "")
    .join(" · ");
}

// While text streams or a tool runs, the conversation already says what is going on; the activity
// is for the silence between the two.
function isSilent(last: Entry | undefined): boolean {
  if (last?.action) {
    return asActionStatus(last.action.status) !== "running";
  }
  if (last?.assistant) {
    return last.assistant.complete;
  }
  return true;
}

export type ActivityProps =
  | {
      /** session is the one whose work shows, with the conversation so far to tell work from silence. */
      session: SessionState;
      entries: readonly Entry[];
      text?: undefined;
    }
  | {
      /** text is a fixed activity of the place: "Starting step 5…". */
      text: string;
      session?: undefined;
      entries?: undefined;
    };

/** Activity is the quiet sign that the agent, or the place, is busy. */
export function Activity(props: ActivityProps) {
  const retrying = props.session !== undefined && props.session.retryAttempt > 0;
  const now = useNow(1000, retrying);
  const { session } = props;
  if (session !== undefined && (!session.turnRunning || !isSilent(props.entries.at(-1)))) {
    return <LiveRegion kind="status" as="div" className="empty:absolute" />;
  }
  const text =
    session === undefined
      ? props.text
      : retrying
        ? retryText(session)
        : // A turn with no process behind it is a session on its way up.
          session.processRunning
          ? "Thinking…"
          : "Starting session…";

  const countdown = retrying && session !== undefined ? nextTry(session.retryAt, now) : "";

  // The countdown changes every second: it stays out of what the status says, which speaks only
  // when the attempt or the reason changes.
  return (
    <LiveRegion kind="status" as="div" className="empty:absolute">
      <p className="flex items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        <Spinner />
        <span>
          {text}
          {countdown !== "" && <span aria-hidden="true"> · {countdown}</span>}
        </span>
      </p>
    </LiveRegion>
  );
}
