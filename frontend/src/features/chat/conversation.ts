import { type FailureNote, failureNotes, summaryOf } from "@/features/chat/actions";
import { pendingOf } from "@/features/chat/composer";
import { type MarkerContext, productMessageOf, startLineOf } from "@/features/chat/markers";
import type { ActionEntry, AppKind, Entry, MarkerType } from "@/lib/wails";
import { asActionStatus, asAppKind, asMarkerType } from "@/lib/wails";
import { clockTime } from "@/lib/when";

/** ActionNode is an action of a group; children are the actions of the subagent it started. */
export interface ActionNode {
  entry: Entry;
  action: ActionEntry;
  children: ActionNode[];
}

/** GroupModel is a run of actions of one turn, drawn folded as one line. */
export interface GroupModel {
  /** key is the id of the first action, stable while the group grows. */
  key: string;
  nodes: ActionNode[];
  /** count is the top-level nodes: a subagent is one. */
  count: number;
  /** summary is "Read 8 · Searched 4 · git 2" over the top-level nodes. */
  summary: string;
  notes: FailureNote[];
  /** retried is the attempts of the retried markers folded into the group. */
  retried: number;
  /** startedAt is when the first action started, or was recorded in an old transcript. */
  startedAt: string;
  /** durationMs is from the start of the first action to the end of the last; null while one runs or without the times. */
  durationMs: number | null;
  /** running is the action in progress, a subagent's when it works; null when none runs. */
  running: ActionNode | null;
}

/** Row is one entry of the conversation as it is drawn. */
export type Row =
  /** voice is the word of who talks, only where the voice changes. */
  | { kind: "speech"; key: string; entry: Entry; voice: string | null }
  | { kind: "user"; key: string; entry: Entry }
  | { kind: "start"; key: string; marker: Entry | null; prompt: Entry | null }
  | { kind: "product"; key: string; entry: Entry; firstReviewerPass: boolean }
  | { kind: "marker"; key: string; entry: Entry }
  | { kind: "group"; key: string; group: GroupModel }
  | { kind: "question" | "permission" | "error"; key: string; entry: Entry };

/** Stretch is a part of the conversation between two messages of the product that open a round. */
export interface Stretch {
  key: string;
  rows: Row[];
  /** speeches counts the messages of the agent, by messageId. */
  speeches: number;
  /** actions counts the top-level actions, a subagent as one. */
  actions: number;
  /**
   * from is the complement of the message of the product that opens the stretch: "Review 1 · 3
   * findings · round 1 of 3"; "" for the first, which opens at its start row.
   */
  from: string;
  /** startedAt and endedAt are the times of its first and its last entry. */
  startedAt: string;
  endedAt: string;
}

/** ConversationModel is the conversation as it is drawn: its stretches, in order. */
export interface ConversationModel {
  stretches: Stretch[];
}

const NO_REPORTS: ReadonlyMap<number, string> = new Map();

// The markers that open a conversation, joined with the prompt after them.
const START_MARKERS: readonly MarkerType[] = [
  "stage_started",
  "step_started",
  "review_started",
  "discussion_started",
];

// The messages of the product that open a round, and so a stretch.
const STRETCH_KINDS: readonly AppKind[] = ["report", "pass", "pr_pass", "apply", "correction"];

/** FOLD_MIN_ROWS is the fewest rows of a stretch that folds, a group counting as one. */
const FOLD_MIN_ROWS = 12;

function markerTypeOf(entry: Entry | undefined): MarkerType | null {
  const marker = entry?.kind === "marker" ? entry.marker : null;
  if (marker === null || marker === undefined) {
    return null;
  }
  const type = asMarkerType(marker.type);
  return type === marker.type ? type : null;
}

function isPrompt(entry: Entry | undefined): boolean {
  return entry?.kind === "user" && entry.user?.prompt === true;
}

// keptEntries drops what the conversation never draws: the speech of a
// subagent, and the empty prompt of a stage that has no marker before it.
function keptEntries(entries: readonly Entry[]): Entry[] {
  const kept: Entry[] = [];
  for (const entry of entries) {
    if (entry.kind === "assistant" && (entry.assistant?.parentToolUseId ?? "") !== "") {
      continue;
    }
    const user = entry.kind === "user" ? entry.user : null;
    const type = markerTypeOf(kept.at(-1));
    const afterStart =
      type !== null && (START_MARKERS.includes(type) || type === "step_review_started");
    if (user?.prompt && user.text === "" && user.sent === "" && !afterStart) {
      continue;
    }
    kept.push(entry);
  }
  return kept;
}

// lastOf is the last item that passes the test, undefined when none does.
function lastOf<T>(items: readonly T[], test: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && test(item)) {
      return item;
    }
  }
  return undefined;
}

/** waitingToolUseId is the action the pending permission of the conversation holds, null without one. */
export function waitingToolUseId(entries: readonly Entry[]): string | null {
  return pendingOf(entries).permission?.toolUseId ?? null;
}

// time is the instant of a time of the transcript, NaN when it is empty.
function time(iso: string): number {
  return iso === "" ? Number.NaN : Date.parse(iso);
}

// runningOf is the action in progress in a group: the last top-level one that
// runs, or the last action of its subagent that runs.
function runningOf(nodes: readonly ActionNode[]): ActionNode | null {
  const running = (node: ActionNode) => asActionStatus(node.action.status) === "running";
  const top = lastOf(nodes, running);
  if (top === undefined) {
    return null;
  }
  return lastOf(top.children, running) ?? top;
}

// spanOf is from the first start to the last end of the actions, null without both.
function spanOf(nodes: readonly ActionNode[]): number | null {
  const all = nodes.flatMap((node) => [node, ...node.children]);
  const starts = all.map((node) => time(node.action.startedAt)).filter((t) => !Number.isNaN(t));
  const ends = all.map((node) => time(node.action.finishedAt)).filter((t) => !Number.isNaN(t));
  if (starts.length === 0 || ends.length === 0) {
    return null;
  }
  return Math.max(Math.max(...ends) - Math.min(...starts), 0);
}

// Building is a group while its actions arrive: the nodes, and the node each
// action belongs to, so that a subagent's action finds the top-level node of its subagent.
interface Building {
  turnId: string;
  nodes: ActionNode[];
  roots: Map<string, ActionNode>;
  retried: number;
}

function addAction(group: Building, entry: Entry, action: ActionEntry): void {
  const node: ActionNode = { entry, action, children: [] };
  const root = action.parentToolUseId === "" ? undefined : group.roots.get(action.parentToolUseId);
  if (root === undefined) {
    group.nodes.push(node);
    group.roots.set(action.toolUseId, node);
    return;
  }
  // A subagent inside a subagent joins the first one: every action of it goes to the top-level node.
  root.children.push(node);
  group.roots.set(action.toolUseId, root);
}

function groupModel(group: Building, waiting: string | null): GroupModel {
  const top = group.nodes.map((node) => node.action);
  const first = group.nodes[0];
  const running = runningOf(group.nodes);
  return {
    key: first?.entry.id ?? "",
    nodes: group.nodes,
    count: group.nodes.length,
    summary: summaryOf(top),
    notes: failureNotes(top, waiting),
    retried: group.retried,
    startedAt: first === undefined ? "" : first.action.startedAt || first.entry.createdAt,
    durationMs: running === null ? spanOf(group.nodes) : null,
    running,
  };
}

// attemptsBeforeAction is the attempts of the retried markers from index on,
// when an action of the turn follows them; null when anything else does.
function attemptsBeforeAction(
  list: readonly Entry[],
  index: number,
  turnId: string,
): { attempts: number; next: number } | null {
  let attempts = 0;
  let next = index;
  while (markerTypeOf(list[next]) === "retried") {
    attempts += list[next]?.marker?.attempts ?? 0;
    next += 1;
  }
  const after = list[next];
  return after?.kind === "action" && after.turnId === turnId ? { attempts, next } : null;
}

// userRow is the row of a user entry: a start line of a prompt without its
// marker, a message of the product, or a message of the user.
function userRow(entry: Entry): Row {
  const user = entry.user;
  if (user?.prompt && user.app) {
    return { kind: "product", key: entry.id, entry, firstReviewerPass: true };
  }
  if (user?.prompt) {
    return { kind: "start", key: entry.id, marker: null, prompt: entry };
  }
  if (user?.app) {
    return { kind: "product", key: entry.id, entry, firstReviewerPass: false };
  }
  return { kind: "user", key: entry.id, entry };
}

// markerRows are the rows of a marker and how many entries they take: a start
// marker takes the prompt after it; the one of a reviewer disappears into it.
// The start of a review is its line alone, and what the user wrote for the
// first pass is the row of their own message after it.
function markerRows(list: readonly Entry[], index: number): { rows: Row[]; taken: number } | null {
  const entry = list[index];
  const next = list[index + 1];
  const type = markerTypeOf(entry);
  if (entry === undefined || type === null) {
    return null;
  }
  if (type === "step_review_started") {
    return next !== undefined && isPrompt(next)
      ? {
          rows: [{ kind: "product", key: next.id, entry: next, firstReviewerPass: true }],
          taken: 2,
        }
      : { rows: [{ kind: "start", key: entry.id, marker: entry, prompt: null }], taken: 1 };
  }
  if (type === "review_started") {
    const start: Row = { kind: "start", key: entry.id, marker: entry, prompt: null };
    if (next === undefined || !isPrompt(next)) {
      return { rows: [start], taken: 1 };
    }
    const written = (next.user?.text ?? "").trim() !== "";
    return {
      rows: written ? [start, { kind: "user", key: next.id, entry: next }] : [start],
      taken: 2,
    };
  }
  if (START_MARKERS.includes(type)) {
    const prompt = next !== undefined && isPrompt(next) ? next : null;
    return {
      rows: [{ kind: "start", key: entry.id, marker: entry, prompt }],
      taken: prompt === null ? 1 : 2,
    };
  }
  return { rows: [{ kind: "marker", key: entry.id, entry }], taken: 1 };
}

// rowsOf turns the entries into rows: the actions of a turn grouped, the start
// marker joined with its prompt, and the voice written where it changes.
function rowsOf(list: readonly Entry[], voice: string, waiting: string | null): Row[] {
  const rows: Row[] = [];
  let group: Building | null = null;
  let newVoice = true;
  const close = () => {
    if (group !== null) {
      const model = groupModel(group, waiting);
      rows.push({ kind: "group", key: model.key, group: model });
      group = null;
    }
  };
  const push = (row: Row) => {
    close();
    rows.push(row);
    // The voice changes after you, the product and the start of the conversation.
    if (row.kind === "user" || row.kind === "product" || row.kind === "start") {
      newVoice = true;
    }
  };

  for (let index = 0; index < list.length; ) {
    const entry = list[index];
    if (entry === undefined) {
      break;
    }
    const current: Building | null = group;
    if (entry.kind === "action" && entry.action !== null) {
      let target: Building | null = current;
      if (target === null || target.turnId !== entry.turnId) {
        close();
        target = { turnId: entry.turnId, nodes: [], roots: new Map(), retried: 0 };
        group = target;
      }
      addAction(target, entry, entry.action);
      index += 1;
      continue;
    }
    // A retry between two actions of a group is part of the group.
    const folded =
      current !== null && markerTypeOf(entry) === "retried"
        ? attemptsBeforeAction(list, index, current.turnId)
        : null;
    if (current !== null && folded !== null) {
      current.retried += folded.attempts;
      index = folded.next;
      continue;
    }
    switch (entry.kind) {
      case "assistant":
        push({ kind: "speech", key: entry.id, entry, voice: newVoice ? voice : null });
        newVoice = false;
        break;
      case "user":
        push(userRow(entry));
        break;
      case "marker": {
        // A marker of a type the app does not know is not drawn, and breaks nothing.
        const marker = markerRows(list, index);
        if (marker !== null) {
          for (const row of marker.rows) {
            push(row);
          }
          index += marker.taken;
          continue;
        }
        break;
      }
      case "question":
      case "permission":
      case "error":
        push({ kind: entry.kind, key: entry.id, entry });
        break;
    }
    index += 1;
  }
  close();
  return rows;
}

// opensStretch reports whether a row is a message of the product that opens a round.
function opensStretch(row: Row): boolean {
  return (
    row.kind === "product" &&
    !row.firstReviewerPass &&
    STRETCH_KINDS.includes(asAppKind(row.entry.user?.appKind ?? ""))
  );
}

// The entries a row stands for, to date it.
function entriesOf(row: Row): Entry[] {
  switch (row.kind) {
    case "group":
      return row.group.nodes.flatMap((node) => [node.entry, ...node.children.map((c) => c.entry)]);
    case "start":
      return [row.marker, row.prompt].filter((entry) => entry !== null);
    default:
      return [row.entry];
  }
}

// lastTime is the latest time a row carries: an action's end, or an entry's creation.
function lastTime(row: Row): string {
  let latest = "";
  for (const entry of entriesOf(row)) {
    const at = entry.action?.finishedAt || entry.createdAt;
    if (latest === "" || time(at) > time(latest)) {
      latest = at;
    }
  }
  return latest;
}

function stretchOf(rows: Row[], voice: string): Stretch {
  const first = rows[0];
  const last = rows.at(-1);
  const messages = new Set<string>();
  let actions = 0;
  for (const row of rows) {
    if (row.kind === "speech") {
      messages.add(row.entry.assistant?.messageId ?? row.key);
    } else if (row.kind === "group") {
      actions += row.group.count;
    }
  }
  const user = first?.kind === "product" && opensStretch(first) ? first.entry.user : null;
  return {
    key: first?.key ?? "",
    rows,
    speeches: messages.size,
    actions,
    // The complement of a message that opens a round depends on its numbers alone.
    from:
      user === null || user === undefined
        ? ""
        : productMessageOf(user, voice, {
            stage: "",
            task: null,
            review: null,
            latestReport: NO_REPORTS,
            oneShot: false,
          }).complement,
    startedAt: first === undefined ? "" : (entriesOf(first)[0]?.createdAt ?? ""),
    endedAt: last === undefined ? "" : lastTime(last),
  };
}

/**
 * buildConversation is the conversation as it is drawn: the entries it shows
 * as rows, in stretches that start at the messages of the product opening a
 * round. voice is the word of who talks, voiceOf the stage.
 */
export function buildConversation(entries: readonly Entry[], voice: string): ConversationModel {
  const rows = rowsOf(keptEntries(entries), voice, waitingToolUseId(entries));
  const stretches: Row[][] = [];
  for (const row of rows) {
    const open = stretches.at(-1);
    if (open === undefined || opensStretch(row)) {
      stretches.push([row]);
    } else {
      open.push(row);
    }
  }
  return { stretches: stretches.map((stretch) => stretchOf(stretch, voice)) };
}

/** foldableStretches are the stretches that fold: not the last, and with at least FOLD_MIN_ROWS rows. */
export function foldableStretches(model: ConversationModel): Set<string> {
  return new Set(
    model.stretches
      .slice(0, -1)
      .filter((stretch) => stretch.rows.length >= FOLD_MIN_ROWS)
      .map((stretch) => stretch.key),
  );
}

/** MarkerAt is where a marker is drawn: the key of its stretch and the key of its row. */
export interface MarkerAt {
  stretch: string;
  row: string;
}

/** lastMarkerOf is where the last marker of a type is drawn, null when the conversation has none. */
export function lastMarkerOf(model: ConversationModel, type: MarkerType): MarkerAt | null {
  for (const stretch of [...model.stretches].reverse()) {
    const row = lastOf(
      stretch.rows,
      (one) => one.kind === "marker" && one.entry.marker?.type === type,
    );
    if (row !== undefined) {
      return { stretch: stretch.key, row: row.key };
    }
  }
  return null;
}

/** StretchFoldView is the line a folded stretch is drawn as. */
export interface StretchFoldView {
  /** text is "5 speeches · 71 actions". */
  text: string;
  /**
   * from is where the stretch began: "from the start · steps/06-throttle-metrics.md", or "from
   * Review 1 · 3 findings · round 1 of 3".
   */
  from: string;
  /** interval is "16:12–16:48", shown on hover and focus; "" without the times. */
  interval: string;
  /** name is "Earlier: 5 speeches and 71 actions, from the start, 16:12 to 16:48". */
  name: string;
}

// counted is a count with its noun: "1 speech", "5 speeches".
function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// START is where the first stretch began, in its line and in its name.
const START = "from the start";

// fromOf is where a stretch began: the message of the product that opens it, or the start of the
// conversation with the complement of its start line.
function fromOf(stretch: Stretch, ctx: MarkerContext): string {
  if (stretch.from !== "") {
    return `from ${stretch.from}`;
  }
  const first = stretch.rows[0];
  const start = first?.kind === "start" ? startLineOf(first.marker, first.prompt, ctx) : null;
  return start === null || start.complement === "" ? START : `${START} · ${start.complement}`;
}

/** stretchFoldOf is the line of a folded stretch: its size, where it began and when it ran. */
export function stretchFoldOf(stretch: Stretch, ctx: MarkerContext, now: number): StretchFoldView {
  const speeches = counted(stretch.speeches, "speech", "speeches");
  const actions = counted(stretch.actions, "action", "actions");
  const from = fromOf(stretch, ctx);
  const started = clockTime(stretch.startedAt, now);
  const ended = clockTime(stretch.endedAt, now);
  const timed = started !== "" && ended !== "";
  return {
    text: `${speeches} · ${actions}`,
    from,
    interval: timed ? `${started}–${ended}` : "",
    // The name says where the stretch began without the start line's complement.
    name: [
      `Earlier: ${speeches} and ${actions}`,
      stretch.from === "" ? START : from,
      timed ? `${started} to ${ended}` : "",
    ]
      .filter((part) => part !== "")
      .join(", "),
  };
}
