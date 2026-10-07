import { CopyButton } from "@/components/system/CopyButton";
import { Tag } from "@/components/system/Tag";
import { versionHint } from "@/features/machine/machine";
import { asErrorKind, type ErrorEntry, type ErrorKind } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { useMachine } from "@/store/app-store";

const EXPLANATIONS: Record<ErrorKind, string> = {
  process_exit: "Claude Code stopped unexpectedly.",
  start_failed: "Claude Code couldn't start.",
  not_found:
    "Claude Code wasn't found on this machine. Install it, or check that claude is on the PATH.",
  not_logged_in: "Claude Code isn't logged in. Run claude in a terminal and log in.",
  turn_error: "The agent couldn't finish the turn.",
};

export type ErrorBlockProps =
  | {
      /** error is a failure of the session, an entry of the conversation. */
      error: ErrorEntry;
      createdAt: string;
      explanation?: undefined;
      detail?: undefined;
    }
  | {
      /** explanation is why a place could not go on: a step or the pull request blocked. */
      explanation: string;
      /** detail is what git or gh said, as they said it. */
      detail: string;
      error?: undefined;
      createdAt?: undefined;
    };

/**
 * ErrorBlock is a failure told in the conversation column: of the session, an entry of the feed, or
 * of a place that could not go on, named by its explanation; retrying is on the request bar.
 */
export function ErrorBlock(props: ErrorBlockProps) {
  const machine = useMachine();
  const entry = props.error !== undefined;
  const explanation = entry ? EXPLANATIONS[asErrorKind(props.error.kind)] : props.explanation;
  const detail = entry ? props.error.message : props.detail;
  // The cause of these failures is not known, and a Claude Code too old is the likely one.
  const kind = entry ? asErrorKind(props.error.kind) : null;
  const hint =
    kind === "start_failed" || kind === "process_exit" || kind === "turn_error"
      ? versionHint(machine)
      : null;
  return (
    <article
      {...(entry ? { "data-feed-item": true, tabIndex: -1 } : {})}
      aria-label={
        entry ? `Session error, ${clockTime(props.createdAt, Date.now())}` : props.explanation
      }
      className="flex flex-col gap-(--space-1) rounded-md bg-surface-0 px-(--space-4) py-(--space-3) shadow-[inset_var(--error-rail)_0_0_var(--state-error)] outline-none focus-visible:focus-ring"
    >
      <p className="text-(length:--text-body) leading-(--leading-body) text-ink-1">{explanation}</p>
      {hint !== null && (
        <>
          <p className="text-(length:--text-body) leading-(--leading-body) text-ink-1">
            {hint.text}
          </p>
          <div className="flex items-center gap-(--space-1)">
            <Tag>{hint.command}</Tag>
            <CopyButton variant="icon" label={`Copy ${hint.command}`} text={hint.command} />
          </div>
        </>
      )}
      {detail !== "" && (
        <pre className="overflow-x-auto font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2 select-text">
          {detail}
        </pre>
      )}
    </article>
  );
}
