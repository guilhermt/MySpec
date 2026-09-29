import { type KeyboardEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Tag } from "@/components/system/Tag";
import { Textarea } from "@/components/system/Textarea";
import { Tooltip } from "@/components/system/Tooltip";
import { ANSWERED_CARD, ENTRY, REQUEST_CARD } from "@/features/chat/entries/QuestionCard";
import { cn } from "@/lib/utils";
import {
  asPermissionStatus,
  type PermissionDecision,
  type PermissionEntry,
  type PermissionStatus,
} from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { answerPermissionInPlace } from "@/store/actions";

const ANSWER_TEXT: Record<Exclude<PermissionStatus, "pending">, string> = {
  allowed: "Allowed",
  allowed_session: "Allowed for this session",
  denied: "Denied",
  cancelled: "Cancelled before an answer",
};

const GERUNDS: Record<PermissionDecision, string> = {
  allow: "Allowing…",
  allow_session: "Allowing for this session…",
  deny: "Denying…",
};

const DENY_PLACEHOLDER = "Tell the agent what to do instead (optional)";

// The tools whose whole input is one path worth reading on its own.
const PATH_TOOLS = ["Write", "Edit", "Read"];

const NOTE = "text-(length:--text-meta) leading-(--leading-meta) text-ink-3 select-text";

const CODE =
  "m-0 rounded-md bg-surface-0 px-(--space-3) py-(--space-2) font-mono text-(length:--text-code) leading-(--leading-code) text-ink-1 shadow-[inset_0_0_0_var(--border)_var(--line-1)] select-text";

function parseInput(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// An empty suggestion list means the CLI offered no rule to remember, so there
// is nothing "for this session" could save.
function hasSuggestions(raw: string): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.length > 0;
  } catch {
    return false;
  }
}

function stringField(input: Record<string, unknown>, name: string): string | null {
  const value = input[name];
  return typeof value === "string" ? value : null;
}

// Detail is what the tool would do, written once: the command, the path or the input.
function Detail({ tool, input }: { tool: string; input: string }) {
  const parsed = parseInput(input);
  const command = stringField(parsed, "command");
  if (tool === "Bash" && command !== null) {
    return <pre className={cn(CODE, "break-all whitespace-pre-wrap")}>{command}</pre>;
  }
  const path = stringField(parsed, "file_path");
  if (PATH_TOOLS.includes(tool) && path !== null) {
    return (
      <p className="font-mono text-(length:--text-code) break-all text-ink-1 select-text">{path}</p>
    );
  }
  return (
    <pre className={cn(CODE, "max-h-48 overflow-auto")}>{JSON.stringify(parsed, null, 2)}</pre>
  );
}

function answerText(status: Exclude<PermissionStatus, "pending">, message: string): string {
  return status === "denied" && message !== ""
    ? `${ANSWER_TEXT.denied} · ${message}`
    : ANSWER_TEXT[status];
}

function toolName(permission: PermissionEntry): string {
  return permission.displayName === "" ? permission.tool : permission.displayName;
}

export interface PermissionCardProps {
  taskId: string;
  stage: string;
  permission: PermissionEntry;
  /** createdAt is when the agent asked. */
  createdAt: string;
  /** readOnly is the card of an earlier conversation: flat, with the decision when there was one. */
  readOnly?: boolean;
  /** flash blinks the pending card that was born with the screen open. */
  flash?: boolean;
}

/**
 * PermissionCard is the agent asking to use a tool. Nothing runs until the user answers: pending,
 * Allow, Allow for this session and Deny…; answered or cancelled, a flat block with the decision.
 */
export function PermissionCard({
  taskId,
  stage,
  permission,
  createdAt,
  readOnly = false,
  flash = false,
}: PermissionCardProps) {
  const status = asPermissionStatus(permission.status);
  if (status === "pending" && !readOnly) {
    return (
      <PendingPermission taskId={taskId} stage={stage} permission={permission} flash={flash} />
    );
  }
  const cancelled = status === "cancelled";
  const answer = status === "pending" ? "" : answerText(status, permission.denyMessage);
  const tip =
    permission.answeredAt === ""
      ? answer
      : `${answer} at ${clockTime(permission.answeredAt, Date.now())}`;
  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={`Permission, ${clockTime(createdAt, Date.now())}`}
      className={cn(ENTRY, ANSWERED_CARD)}
    >
      <div className="grid grid-cols-[var(--icon-sm)_minmax(0,1fr)] items-baseline gap-(--space-2) select-text">
        {cancelled || answer === "" ? (
          <span />
        ) : (
          <Icon icon={ICONS.done} size="sm" className="self-center text-ink-3" />
        )}
        <span className="flex min-w-0 items-baseline gap-(--space-2)">
          <Tag>{toolName(permission)}</Tag>
          <span className="min-w-0 truncate font-medium text-ink-1">
            {permission.description === "" ? toolName(permission) : permission.description}
          </span>
        </span>
      </div>
      {answer !== "" && (
        <p
          className={cn(
            "ml-[calc(var(--icon-sm)+var(--space-2))]",
            cancelled ? "text-ink-3" : "text-ink-2",
          )}
        >
          {cancelled ? (
            answer
          ) : (
            <Tooltip content={tip}>
              <span>{answer}</span>
            </Tooltip>
          )}
        </p>
      )}
    </article>
  );
}

interface PendingPermissionProps {
  taskId: string;
  stage: string;
  permission: PermissionEntry;
  flash: boolean;
}

function PendingPermission({ taskId, stage, permission, flash }: PendingPermissionProps) {
  const titleId = useId();
  const denyRef = useRef<HTMLTextAreaElement>(null);
  const [denying, setDenying] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState<PermissionDecision | null>(null);
  const [failure, setFailure] = useState("");
  const forSession = !permission.suppressAlwaysAllow && hasSuggestions(permission.suggestions);

  const answer = async (decision: PermissionDecision, text: string) => {
    if (sending !== null) {
      return;
    }
    setSending(decision);
    setFailure("");
    const reason = await answerPermissionInPlace(
      taskId,
      stage,
      permission.requestId,
      decision,
      text,
    );
    // Sent, the card turns into its answer when the conversation says so.
    if (reason !== "") {
      setSending(null);
      setFailure(reason);
    }
  };

  const deny = () => {
    setDenying(true);
    requestAnimationFrame(() => denyRef.current?.focus());
  };

  // 1 to 3 are the buttons, in order, with the focus on the card or on one of its buttons.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      denying ||
      !/^[1-3]$/.test(event.key) ||
      (event.target as HTMLElement).matches("textarea, input")
    ) {
      return;
    }
    const actions = [
      () => void answer("allow", ""),
      ...(forSession ? [() => void answer("allow_session", "")] : []),
      deny,
    ];
    const action = actions[Number(event.key) - 1];
    if (action !== undefined) {
      event.preventDefault();
      action();
    }
  };

  const busy = (decision: PermissionDecision) =>
    ({ loading: sending === decision, loadingLabel: GERUNDS[decision] }) as const;
  const others = (decision: PermissionDecision) => sending !== null && sending !== decision;

  return (
    <article
      data-feed-item
      data-pending-card="permission"
      tabIndex={-1}
      aria-label={`Permission, answer with 1 to ${forSession ? 3 : 2}`}
      aria-busy={sending !== null}
      {...(flash ? { "data-flash": "wait" } : {})}
      className={cn(ENTRY, "situation-flash")}
      onKeyDown={onKeyDown}
    >
      <fieldset aria-labelledby={titleId} className={REQUEST_CARD}>
        <div id={titleId} className="flex items-baseline gap-(--space-2) text-ink-1 select-text">
          <Tag>{toolName(permission)}</Tag>
          {permission.description !== "" && <span>{permission.description}</span>}
        </div>
        <Detail tool={permission.tool} input={permission.input} />
        {permission.decisionReason !== "" && <p className={NOTE}>{permission.decisionReason}</p>}
        {permission.blockedPath !== "" && (
          <p className={NOTE}>{`Outside the working directory: ${permission.blockedPath}`}</p>
        )}

        {denying ? (
          <div className="flex flex-col gap-(--space-2)">
            <Textarea
              ref={denyRef}
              rows={2}
              value={message}
              aria-label={DENY_PLACEHOLDER}
              placeholder={DENY_PLACEHOLDER}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-(--space-2)">
              <Button
                variant="danger"
                {...busy("deny")}
                onClick={() => void answer("deny", message.trim())}
              >
                Deny
              </Button>
              <Button
                variant="ghost"
                {...(sending !== null ? { disabled: true } : {})}
                onClick={() => setDenying(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <Button
              variant="primary"
              shortcut="1"
              {...(permission.defaultToNo ? {} : { "data-default-focus": true })}
              {...busy("allow")}
              {...(others("allow") ? { disabled: true } : {})}
              onClick={() => void answer("allow", "")}
            >
              Allow
            </Button>
            {forSession && (
              <Button
                shortcut="2"
                {...busy("allow_session")}
                {...(others("allow_session") ? { disabled: true } : {})}
                onClick={() => void answer("allow_session", "")}
              >
                Allow for this session
              </Button>
            )}
            <Button
              variant="ghost"
              shortcut={forSession ? "3" : "2"}
              {...(permission.defaultToNo ? { "data-default-focus": true } : {})}
              {...(sending !== null ? { disabled: true } : {})}
              onClick={deny}
            >
              Deny…
            </Button>
          </div>
        )}
        {failure !== "" && (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-state-error">
            {`Not sent · ${failure}`}
          </p>
        )}
      </fieldset>
    </article>
  );
}
