import { formatDuration } from "@/features/chat/actions";
import type { MarkerBody, MarkerView } from "@/features/chat/markers";
import { asActionStatus, asInterruptedBy, type Entry } from "@/lib/wails";

/** SubagentStatus is how the work of a subagent stands, from its Agent/Task action. */
export type SubagentStatus =
  | "running"
  | "finished"
  | "failed"
  | "stopped"
  | "stoppedByAgent"
  | "lost";

/** SubagentModel is the conversation of a subagent. */
export interface SubagentModel {
  /** root is the Agent/Task action that started it; null when the transcript has none. */
  root: Entry | null;
  /** name is its description, or the subagent type. */
  name: string;
  /** prompt is the task it received; "" in old transcripts. */
  prompt: string;
  /** entries are its speeches and actions, as main-thread entries of one turn, by seq. */
  entries: Entry[];
  status: SubagentStatus;
}

// statusOf is how the root action stands: an interrupted one says by whom.
function statusOf(root: Entry | null): SubagentStatus {
  const action = root?.action;
  if (action === null || action === undefined) {
    return "finished";
  }
  switch (asActionStatus(action.status)) {
    case "running":
      return "running";
    case "error":
      return "failed";
    case "interrupted":
      switch (asInterruptedBy(action.interruptedBy)) {
        case "agent":
          return "stoppedByAgent";
        case "crash":
          return "lost";
        default:
          return "stopped";
      }
    case "done":
      return "finished";
  }
}

// asMainThread is an entry of the subagent as the main thread of the turn of its root draws it: an
// action that hangs straight from the root is a top-level one, one inside it keeps its parent.
function asMainThread(entry: Entry, root: Entry): Entry {
  const toolUseId = root.action?.toolUseId ?? "";
  if (entry.assistant !== null && entry.assistant !== undefined) {
    return {
      ...entry,
      turnId: root.turnId,
      assistant: { ...entry.assistant, parentToolUseId: "" },
    };
  }
  const action = entry.action;
  if (action === null || action === undefined) {
    return entry;
  }
  return {
    ...entry,
    turnId: root.turnId,
    action: {
      ...action,
      parentToolUseId: action.parentToolUseId === toolUseId ? "" : action.parentToolUseId,
    },
  };
}

/**
 * subagentConversationOf is the conversation of the subagent that the Agent/Task call started: its
 * speeches and its actions, by seq, wherever in the transcript they arrived, and how it stands.
 */
export function subagentConversationOf(
  entries: readonly Entry[],
  toolUseId: string,
): SubagentModel {
  const root =
    entries.find(
      (entry) => entry.action?.toolUseId === toolUseId && entry.action.parentToolUseId === "",
    ) ?? null;
  // The call each action belongs to, for a subagent that started another.
  const owned = new Set<string>([toolUseId]);
  const own: Entry[] = [];
  for (const entry of entries) {
    const parent =
      entry.kind === "action"
        ? (entry.action?.parentToolUseId ?? "")
        : entry.kind === "assistant"
          ? (entry.assistant?.parentToolUseId ?? "")
          : "";
    if (parent === "" || !owned.has(parent)) {
      continue;
    }
    if (entry.kind === "action" && entry.action !== null) {
      owned.add(entry.action.toolUseId);
    }
    own.push(entry);
  }
  const action = root?.action;
  const name = action === null || action === undefined ? "" : action.description || action.target;
  return {
    root,
    name: name === "" ? "Subagent" : name,
    prompt: action?.prompt ?? "",
    entries:
      root === null
        ? []
        : own.map((entry) => asMainThread(entry, root)).sort((a, b) => a.seq - b.seq),
    status: statusOf(root),
  };
}

// STATUS_TEXT is how a subagent that is not running stands.
const STATUS_TEXT: Record<Exclude<SubagentStatus, "running">, string> = {
  finished: "finished",
  failed: "failed",
  stopped: "stopped by you",
  stoppedByAgent: "stopped by the agent",
  lost: "lost",
};

/** subagentStatusText is "running · 3m 12s", "finished", "stopped by you"... */
export function subagentStatusText(status: SubagentStatus, startedAt: string, now: number): string {
  if (status !== "running") {
    return STATUS_TEXT[status];
  }
  const started = Date.parse(startedAt);
  return Number.isNaN(started)
    ? "running"
    : `running · ${formatDuration(Math.max(now - started, 0))}`;
}

// endLine is the closing line of a subagent.
function endLine(icon: MarkerView["icon"], text: string, body: MarkerBody): MarkerView {
  return { icon, text, complement: "", body, timeHidden: false };
}

/**
 * subagentEndView is the last line of the conversation of a subagent: how it ended, with its report
 * when it finished or its output when it failed, once read. A subagent that runs has none.
 */
export function subagentEndView(status: SubagentStatus, output: string | null): MarkerView | null {
  const body = (text: string | null, fenced: boolean): MarkerBody =>
    text === null || text.trim() === ""
      ? { kind: "none" }
      : { kind: "markdown", text: fenced ? `\`\`\`text\n${text}\n\`\`\`` : text };
  switch (status) {
    case "running":
      return null;
    case "finished":
      return endLine("check", "Finished", body(output, false));
    case "failed":
      return endLine("problem", "Failed", body(output, true));
    case "stopped":
      return endLine("ban", "Stopped by you", { kind: "none" });
    case "stoppedByAgent":
      return endLine("ban", "Stopped by the agent", { kind: "none" });
    case "lost":
      return endLine("lost", "Lost when the session stopped", { kind: "none" });
  }
}
