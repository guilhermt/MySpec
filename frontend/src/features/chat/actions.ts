import type { ActionEntry } from "@/lib/wails";
import { asActionStatus, asInterruptedBy } from "@/lib/wails";
import { duration } from "@/lib/when";

/** ActionCategory is the kind of work an action did, the words of the summary of a group. */
export type ActionCategory =
  | "Read"
  | "Searched"
  | "Wrote"
  | "Tests"
  | "Lint"
  | "Build"
  | "git"
  | "GitHub"
  | "Web"
  | "Delegated"
  | "Ran"
  | "Other";

/** CATEGORY_ORDER is the order of the table Categorias, the tie-break of the summary. */
export const CATEGORY_ORDER: readonly ActionCategory[] = [
  "Read",
  "Searched",
  "Wrote",
  "Tests",
  "Lint",
  "Build",
  "git",
  "GitHub",
  "Web",
  "Delegated",
  "Ran",
  "Other",
];

/** SUMMARY_CATEGORIES is the most categories a summary names; the others count only in "N actions". */
const SUMMARY_CATEGORIES = 5;

// The categories of the tools the agent calls by name; Bash goes by its command.
const TOOL_CATEGORIES: Record<string, ActionCategory> = {
  Read: "Read",
  Grep: "Searched",
  Glob: "Searched",
  Write: "Wrote",
  Edit: "Wrote",
  MultiEdit: "Wrote",
  NotebookEdit: "Wrote",
  WebFetch: "Web",
  WebSearch: "Web",
  Agent: "Delegated",
  Task: "Delegated",
};

// The commands of the table Categorias. A command of two words is matched
// before one of a word, so that "go test" is Tests and "sed -n" is Read.
const COMMAND_CATEGORIES: readonly (readonly [ActionCategory, readonly string[]])[] = [
  ["Read", ["sed -n", "cat", "head", "tail", "nl", "less", "wc", "ls", "tree", "stat", "jq"]],
  ["Searched", ["grep", "rg", "find", "fd", "ag"]],
  [
    "Wrote",
    [
      "cat >",
      "cat >>",
      "sed -i",
      "perl -pi",
      "python3 -",
      "python3 <<",
      "tee",
      "mv",
      "cp",
      "rm",
      "mkdir",
      "touch",
      "chmod",
      "patch",
    ],
  ],
  [
    "Tests",
    [
      "go test",
      "npm test",
      "npm run test",
      "pnpm test",
      "yarn test",
      "cargo test",
      "bun test",
      "task test",
      "make test",
      "vitest",
      "jest",
      "pytest",
    ],
  ],
  [
    "Lint",
    [
      "go vet",
      "npm run lint",
      "task lint",
      "golangci-lint",
      "eslint",
      "biome",
      "tsc",
      "gofmt",
      "prettier",
      "ruff",
      "mypy",
    ],
  ],
  ["Build", ["go build", "npm run build", "cargo build", "make", "task"]],
  ["git", ["git"]],
  ["GitHub", ["gh"]],
  ["Web", ["curl", "wget"]],
];

// The commands above, the longest first, so that the most specific one wins.
const COMMANDS: readonly { command: string; category: ActionCategory }[] =
  COMMAND_CATEGORIES.flatMap(([category, commands]) =>
    commands.map((command) => ({ command, category })),
  ).sort((a, b) => b.command.split(" ").length - a.command.split(" ").length);

// What a Bash line runs after, in a loop: cd … &&, VAR=…, sudo, time and timeout N.
const PREFIXES: readonly RegExp[] = [
  /^cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*&&\s*/,
  /^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/,
  /^sudo\s+/,
  /^time\s+/,
  /^timeout\s+\S+\s+/,
];

/** executableOf is the command a Bash line runs: past cd … &&, VAR=…, sudo, time, timeout N, before a |. */
export function executableOf(command: string): string {
  let line = (command.split("|")[0] ?? "").replace(/\s+/g, " ").trim();
  for (let stripped = true; stripped; ) {
    stripped = false;
    for (const prefix of PREFIXES) {
      const next = line.replace(prefix, "");
      if (next !== line) {
        line = next;
        stripped = true;
      }
    }
  }
  return line;
}

// runs reports whether a command line starts with a command of the table: the
// command whole, before a space, the end or the ":" of a target (task test:web),
// and a redirection (cat >, python3 <<) right before what it reads or writes.
function runs(line: string, command: string): boolean {
  if (!line.startsWith(command)) {
    return false;
  }
  const next = line.charAt(command.length);
  return next === "" || next === " " || next === ":" || /[<>]$/.test(command);
}

function commandCategory(command: string): ActionCategory {
  const line = executableOf(command);
  return COMMANDS.find((known) => runs(line, known.command))?.category ?? "Ran";
}

/** categoryOf is the category of an action in the summary of its group (table Categorias). */
export function categoryOf(action: ActionEntry): ActionCategory {
  if (action.tool === "Bash") {
    return commandCategory(action.target);
  }
  return TOOL_CATEGORIES[action.tool] ?? "Other";
}

/** ActionLabel is how a command reads in its row: the label, the command after it, and the tooltip of the command. */
export interface ActionLabel {
  label: string;
  /** command is the mono part after the label; "" when the label is the command itself. */
  command: string;
  /** mono says the label is the command, written in mono. */
  mono: boolean;
  /** tooltip is the whole first line of the command, with "· N lines" when it has more; "" without a target. */
  tooltip: string;
}

// The words of the tools that are not a command (§4.2 Comandos).
const TOOL_WORDS: Record<string, string> = {
  Read: "Read",
  Write: "Write",
  Edit: "Edit",
  MultiEdit: "Edit",
  NotebookEdit: "Edit",
  Grep: "Search",
  Glob: "Find files",
  WebFetch: "Fetch",
  WebSearch: "Search the web",
  Skill: "Use skill",
  TodoWrite: "Update the task list",
};

// toolWord is the word an action of a tool other than Bash and a subagent reads with.
function toolWord(tool: string): string {
  if (tool.startsWith("mcp__")) {
    return "Call";
  }
  // Task followed by a suffix (TaskCreate, TaskUpdate…) keeps the task list, Task alone delegates.
  if (tool.startsWith("Task")) {
    return "Update the task list";
  }
  return TOOL_WORDS[tool] ?? tool;
}

/** actionLabel: with a description, the description and the command after it; without, the command in the label (mono). */
export function actionLabel(action: ActionEntry): ActionLabel {
  if (action.tool === "Agent" || action.tool === "Task") {
    const what = action.description !== "" ? action.description : action.target;
    return {
      label: what !== "" ? `Delegated · ${what}` : "Delegated",
      command: "",
      mono: false,
      tooltip: "",
    };
  }
  if (action.tool === "Bash") {
    const lines = action.commandLines > 1 ? ` · ${action.commandLines} lines` : "";
    const tooltip = action.target !== "" ? `${action.target}${lines}` : "";
    return action.description !== ""
      ? { label: action.description, command: action.target, mono: false, tooltip }
      : { label: action.target, command: "", mono: true, tooltip };
  }
  return {
    label: toolWord(action.tool),
    command: action.target,
    mono: false,
    tooltip: action.target,
  };
}

/** summaryOf is "Read 8 · Searched 4 · git 2": up to five categories, most frequent first, ties by CATEGORY_ORDER. */
export function summaryOf(actions: readonly ActionEntry[]): string {
  const counts = new Map<ActionCategory, number>();
  for (const action of actions) {
    const category = categoryOf(action);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts]
    .sort(
      ([a, countA], [b, countB]) =>
        countB - countA || CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    )
    .slice(0, SUMMARY_CATEGORIES)
    .map(([category, count]) => `${category} ${count}`)
    .join(" · ");
}

/** FailureNote is a suffix of the summary of a group, in the error tone or the quiet one. */
export type FailureNote = { text: string; tone: "error" | "meta" } | null;

// recovered reports whether a failed action passed later: an action after it,
// in the same list, with the same target, ended done.
function recovered(actions: readonly ActionEntry[], index: number): boolean {
  const target = actions[index]?.target;
  return actions
    .slice(index + 1)
    .some((later) => later.target === target && asActionStatus(later.status) === "done");
}

/** failureNotes are the suffixes: "1 failed", "1 failed, then passed", "1 stopped", "1 waits for your permission". */
export function failureNotes(
  actions: readonly ActionEntry[],
  waitingToolUseId: string | null,
): FailureNote[] {
  let failed = 0;
  let passedLater = 0;
  let stopped = 0;
  let waiting = 0;
  for (const [index, action] of actions.entries()) {
    const status = asActionStatus(action.status);
    if (status === "error" && recovered(actions, index)) {
      passedLater += 1;
    } else if (status === "error") {
      failed += 1;
    } else if (status === "interrupted") {
      stopped += 1;
    }
    if (waitingToolUseId !== null && action.toolUseId === waitingToolUseId) {
      waiting += 1;
    }
  }
  const notes: FailureNote[] = [];
  if (failed > 0) {
    notes.push({ text: `${failed} failed`, tone: "error" });
  }
  if (passedLater > 0) {
    notes.push({ text: `${passedLater} failed, then passed`, tone: "meta" });
  }
  if (stopped > 0) {
    notes.push({ text: `${stopped} stopped`, tone: "meta" });
  }
  if (waiting > 0) {
    notes.push({ text: `${waiting} waits for your permission`, tone: "meta" });
  }
  return notes;
}

/** formatDuration: 8.2s under 10 s, 12s under a minute, duration() of lib/when.ts after. */
export function formatDuration(ms: number): string {
  if (ms < 10_000) {
    // Rounded to a tenth, never up to 10.0s: from ten seconds on the duration is whole.
    const tenths = Math.min(Math.max(Math.round(ms / 100), 0), 99);
    return `${(tenths / 10).toFixed(1)}s`;
  }
  if (ms < 60_000) {
    return `${Math.floor(ms / 1000)}s`;
  }
  return duration(ms);
}

/** ActionRight is the right column of a command: its text and the tone it takes. */
export type ActionRight = { text: string; tone: "meta" | "error" | "live" | "wait" };

// elapsed is the time between two instants of a transcript, null when either is unknown.
function elapsed(from: string, to: string): number | null {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return Number.isNaN(start) || Number.isNaN(end) ? null : end - start;
}

/** actionRight is the right column of a command (P6), running from now. */
export function actionRight(
  action: ActionEntry,
  waiting: boolean,
  now: number,
): ActionRight | null {
  const status = asActionStatus(action.status);
  if (waiting && status === "running") {
    return { text: "waits for your permission", tone: "wait" };
  }
  switch (status) {
    case "done": {
      const ms = elapsed(action.startedAt, action.finishedAt);
      return ms === null ? null : { text: formatDuration(ms), tone: "meta" };
    }
    case "error": {
      const code = action.exitCode >= 0 ? `exit ${action.exitCode}` : "failed";
      const ms = elapsed(action.startedAt, action.finishedAt);
      return { text: ms === null ? code : `${code} · ${formatDuration(ms)}`, tone: "error" };
    }
    case "running": {
      const started = Date.parse(action.startedAt);
      return Number.isNaN(started) ? null : { text: formatDuration(now - started), tone: "live" };
    }
    case "interrupted":
      return {
        text:
          asInterruptedBy(action.interruptedBy) === "crash"
            ? "stopped with the session"
            : "stopped",
        tone: "meta",
      };
  }
}
