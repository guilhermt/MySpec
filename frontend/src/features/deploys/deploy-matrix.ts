import {
  asDeployAvailable,
  asDeployProblem,
  type DeployBoard,
  type DeployEnvironment,
  type DeployRepository,
  type DeployRun,
  type Deploys,
} from "@/lib/wails";
import { age, ageLong, duration, readMoment } from "@/lib/when";

/** CellGlyph is what a cell draws before its word: a state glyph, an icon, a spinner or nothing under the shimmer. */
export type CellGlyph =
  | "done"
  | "idle"
  | "promote"
  | "pullRequest"
  | "github"
  | "work"
  | "error"
  | "blocked"
  | "shimmer";

/** CellTone is the color of the word of a cell. */
export type CellTone = "quiet" | "strong" | "github" | "error" | "neutral";

export interface CellModel {
  /** key is the slot of the cell in the grid. */
  key: string;
  glyph: CellGlyph;
  word: string;
  /** meta is the second line; it wraps and is never cut. */
  meta: string;
  tone: CellTone;
  /** failedMark is the small diamond of a last deploy that failed next to changes that wait. */
  failedMark: boolean;
  /** stale is a row whose reading failed, which shows the reading before. */
  stale: boolean;
  /** label is the accessible name: everything the cell says. */
  label: string;
}

export interface PassageModel {
  key: string;
  /** lit is a passage with something to promote: changes that wait or a pull request ready to merge. */
  lit: boolean;
  /** dashed is a deploy running or waiting for its run. */
  dashed: boolean;
  /** busy is the app creating the pull request or merging it. */
  busy: boolean;
  /** text is what the passage says: 3 commits, #88, Merging…, or nothing. */
  text: string;
  /** short is text in the narrow layout: the number alone. */
  short: string;
  label: string;
}

export interface ColumnHeader {
  position: number;
  /** name is the environment every repository with this position calls it; null when they differ. */
  name: string | null;
}

export type SlotKind = "cell" | "passage";

export interface Slot {
  key: string;
  repositoryId: string;
  position: number;
  kind: SlotKind;
  column: number;
}

export interface Change {
  key: string;
  text: string;
}

const NO_ENVIRONMENTS: DeployEnvironment[] = [];

/** environmentsOf is the environments of a repository, never null. */
export function environmentsOf(repo: DeployRepository): readonly DeployEnvironment[] {
  return repo.environments ?? NO_ENVIRONMENTS;
}

/** cellKey and passageKey are the slots of an environment. */
export function cellKey(repositoryId: string, position: number): string {
  return `${repositoryId}:${position}:cell`;
}

export function passageKey(repositoryId: string, position: number): string {
  return `${repositoryId}:${position}:passage`;
}

/** envKey is the environment a flash and a change are about, whichever slot shows it. */
function envKey(repositoryId: string, position: number): string {
  return `${repositoryId}:${position}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** span is a short age without its "ago": 2d, 5m, now. */
function span(iso: string, now: number): string {
  const ago = age(iso, now);
  return ago === "just now" ? "now" : ago.replace(/ ago$/, "");
}

/** spanLong is a long age as a length: 2 days, 1 minute; "under a minute" for a recent one. */
function spanLong(iso: string, now: number): string {
  const ago = ageLong(iso, now);
  return ago === "just now" ? "under a minute" : ago.replace(/ ago$/, "");
}

/** since is how long a run has been going: 1m 20s. */
function since(run: DeployRun | null, now: number): string {
  if (run === null || run.startedAt === "") {
    return "";
  }
  const started = Date.parse(run.startedAt);
  return Number.isNaN(started) ? "" : duration(now - started);
}

function runActive(run: DeployRun | null): boolean {
  return run !== null && (run.status === "running" || run.status === "queued");
}

/** failedRunOf is the run that failed, whether it is the last one or the last completed one. */
function failedRunOf(env: DeployEnvironment): DeployRun | null {
  return env.failedRun ?? (env.lastRun?.status === "failed" ? env.lastRun : null);
}

/**
 * statusOf is the state a cell shows. A failed last deploy with changes that wait shows the changes
 * with the failure as a small mark: what there is to do is what the cell says first.
 */
function statusOf(env: DeployEnvironment): { state: string; failedMark: boolean } {
  if (env.state === "failed" && env.prReady) {
    return { state: "pr_ready", failedMark: true };
  }
  if (env.state === "failed" && env.pending) {
    return { state: "pending", failedMark: true };
  }
  return { state: env.state, failedMark: false };
}

interface Face {
  glyph: CellGlyph;
  word: string;
  meta: string;
  tone: CellTone;
  said: string;
}

function actionFace(env: DeployEnvironment, now: number): Face | null {
  const action = env.action;
  if (action === null) {
    return null;
  }
  switch (action.phase) {
    case "creating":
      return {
        glyph: "work",
        word: "Creating the pull request…",
        meta: "",
        tone: "neutral",
        said: "creating the pull request",
      };
    case "merging":
      return { glyph: "work", word: "Merging…", meta: "", tone: "neutral", said: "merging" };
    case "waiting_run":
      return {
        glyph: "github",
        word: "Waiting for the run…",
        meta: `#${action.pr} merged`,
        tone: "github",
        said: "waiting for the run",
      };
    case "running": {
      const length = since(env.lastRun, now);
      return {
        glyph: "github",
        word: "Deploying",
        meta: length,
        tone: "github",
        said:
          length === ""
            ? "deploying"
            : `deploying for ${spanLong(env.lastRun?.startedAt ?? "", now)}`,
      };
    }
    case "failed": {
      const word = action.kind === "merge" ? "Couldn't merge" : "Couldn't create the pull request";
      return {
        glyph: "error",
        word,
        meta: "See the panel",
        tone: "error",
        said: word.toLowerCase(),
      };
    }
    default:
      return null;
  }
}

function stateFace(env: DeployEnvironment, state: string, now: number): Face {
  switch (state) {
    case "problem": {
      const workflow = env.problem === "workflow_missing";
      return {
        glyph: "blocked",
        word: workflow ? "Workflow missing" : "Branch missing",
        meta: workflow ? env.workflowName : env.branch,
        tone: "neutral",
        said: workflow
          ? `workflow ${env.workflowName} is missing`
          : `branch ${env.branch} is missing`,
      };
    }
    case "unread":
      return { glyph: "shimmer", word: "Reading…", meta: "", tone: "quiet", said: "not read yet" };
    case "running": {
      const run = runActive(env.lastRun) ? env.lastRun : null;
      const queued = run?.status === "queued" || run === null;
      const length = queued ? "" : since(run, now);
      return {
        glyph: "github",
        word: "Deploying",
        meta: queued ? "Queued" : length,
        tone: "github",
        said: queued ? "queued to deploy" : `deploying for ${spanLong(run?.startedAt ?? "", now)}`,
      };
    }
    case "failed": {
      const run = failedRunOf(env);
      const when = run?.endedAt ?? "";
      return {
        glyph: "error",
        word: "Failed",
        meta: age(when, now),
        tone: "error",
        said: when === "" ? "failed" : `failed ${ageLong(when, now)}`,
      };
    }
    case "pr_ready": {
      const draft = env.promotion?.deployPr?.draft === true;
      const number = env.promotion?.deployPr?.number ?? 0;
      return {
        glyph: "pullRequest",
        word: "Ready to merge",
        meta: draft ? `#${number} · draft` : `#${number}`,
        tone: "strong",
        said: `ready to merge: pull request #${number}`,
      };
    }
    case "pending": {
      const commits = env.promotion?.commits ?? 0;
      const waiting = env.promotion?.pendingSince ?? "";
      const text = plural(commits, "commit");
      return {
        glyph: "promote",
        word: "Pending",
        meta: waiting === "" ? text : `${text} · ${span(waiting, now)}`,
        tone: "strong",
        said:
          waiting === ""
            ? `pending: ${text}`
            : `pending: ${text}, changes for ${spanLong(waiting, now)}`,
      };
    }
    case "up_to_date": {
      const ended = env.lastRun?.endedAt ?? "";
      return {
        glyph: "done",
        word: "Deployed",
        meta: ended === "" ? "" : age(ended, now),
        tone: "quiet",
        said: ended === "" ? "deployed" : `deployed ${ageLong(ended, now)}`,
      };
    }
    default:
      return {
        glyph: "idle",
        word: "No deploy yet",
        meta: "",
        tone: "quiet",
        said: "no deploy yet",
      };
  }
}

/**
 * cellModel is what a cell of the matrix says of an environment. An action in flight wins over the
 * state; a failed action wins the word but keeps the mark of a deploy that failed.
 */
export function cellModel(repo: DeployRepository, env: DeployEnvironment, now: number): CellModel {
  const { state, failedMark } = statusOf(env);
  const face = actionFace(env, now) ?? stateFace(env, state, now);
  const stale = repo.failure !== null;
  let label = `${repo.name} · ${env.name} · ${face.said}`;
  if (failedMark) {
    label += ", last deploy failed";
  }
  if (stale) {
    label += `, from the reading of ${readMoment(repo.readAt, now)}`;
  }
  return {
    key: cellKey(repo.id, env.position),
    glyph: face.glyph,
    word: face.word,
    meta: face.meta,
    tone: face.tone,
    failedMark,
    stale,
    label,
  };
}

/**
 * passageModel is the passage that leads into an environment, from the one before; null for the
 * first environment, which no passage leads into.
 */
export function passageModel(repo: DeployRepository, env: DeployEnvironment): PassageModel | null {
  if (env.position === 0) {
    return null;
  }
  const lit = env.pending || env.prReady;
  const phase = env.action?.phase ?? "";
  const busy = phase === "creating" || phase === "merging";
  const dashed = phase === "waiting_run" || phase === "running";
  const number = env.promotion?.deployPr?.number ?? 0;
  const commits = env.promotion?.commits ?? 0;

  let text = "";
  let short = "";
  let said = "nothing to deploy";
  if (phase === "creating") {
    text = "Creating…";
    said = "creating the pull request";
  } else if (phase === "merging") {
    text = "Merging…";
    said = "merging";
  } else if (dashed) {
    said = "deploying";
  } else if (env.prReady) {
    text = `#${number}`;
    short = text;
    said = `pull request #${number} ready to merge`;
  } else if (env.pending) {
    text = plural(commits, "commit");
    short = String(commits);
    said = `${text} to deploy`;
  }
  return {
    key: passageKey(repo.id, env.position),
    lit,
    dashed,
    busy,
    text,
    short,
    label: `${repo.name} · ${env.previousName} to ${env.name} · ${said}`,
  };
}

/** boardColumns names each column of a board when every repository that has it calls it the same. */
export function boardColumns(board: DeployBoard): ColumnHeader[] {
  const repositories = board.repositories ?? [];
  const count = Math.max(0, ...repositories.map((repo) => environmentsOf(repo).length));
  return Array.from({ length: count }, (_, position) => {
    const names = new Set(
      repositories.flatMap((repo) => {
        const env = environmentsOf(repo)[position];
        return env === undefined ? [] : [env.name];
      }),
    );
    return { position, name: names.size === 1 ? ([...names][0] ?? null) : null };
  });
}

/**
 * gridSlots are the focusable rows of every board shown, in order. A row whose reading failed with
 * nothing read before has no slot: its Try again sits outside the grid.
 */
export function gridSlots(boards: readonly DeployBoard[]): Slot[][] {
  return boards
    .filter((board) => board.shown)
    .flatMap((board) =>
      (board.repositories ?? []).flatMap((repo) => {
        const slots = environmentsOf(repo).flatMap((env): Slot[] => {
          const cell: Slot = {
            key: cellKey(repo.id, env.position),
            repositoryId: repo.id,
            position: env.position,
            kind: "cell",
            column: 2 * env.position,
          };
          return env.position === 0
            ? [cell]
            : [
                {
                  key: passageKey(repo.id, env.position),
                  repositoryId: repo.id,
                  position: env.position,
                  kind: "passage",
                  column: 2 * env.position - 1,
                },
                cell,
              ];
        });
        return slots.length === 0 ? [] : [slots];
      }),
    );
}

/** moveFocus is the slot an arrow, Home or End moves the focus to from a slot; null when it stays. */
export function moveFocus(
  rows: readonly (readonly Slot[])[],
  from: string,
  key: string,
  ctrl = false,
): string | null {
  const rowIndex = rows.findIndex((row) => row.some((slot) => slot.key === from));
  const row = rows[rowIndex];
  const slot = row?.find((candidate) => candidate.key === from);
  if (row === undefined || slot === undefined) {
    return null;
  }
  const index = row.indexOf(slot);
  const inRow = (target: Slot | undefined) => target?.key ?? null;
  const inLine = (line: readonly Slot[] | undefined) => {
    // The slot in the same column, or in the greatest column below it.
    const fits = (line ?? []).filter((candidate) => candidate.column <= slot.column);
    return fits.at(-1)?.key ?? line?.[0]?.key ?? null;
  };
  switch (key) {
    case "ArrowLeft":
      return inRow(row[index - 1]);
    case "ArrowRight":
      return inRow(row[index + 1]);
    case "ArrowUp":
      return inLine(rows[rowIndex - 1]);
    case "ArrowDown":
      return inLine(rows[rowIndex + 1]);
    case "Home":
      return ctrl ? (rows[0]?.[0]?.key ?? null) : inRow(row[0]);
    case "End":
      return ctrl ? (rows.at(-1)?.at(-1)?.key ?? null) : inRow(row.at(-1));
    default:
      return null;
  }
}

/** NO_RUN_NOTICE is why O does nothing on a cell whose environment has never deployed. */
export const NO_RUN_NOTICE = "No deploy run yet.";

/** keyNotice is why D does nothing on an environment, null when it acts: the text of the KeyNotice. */
export function keyNotice(env: DeployEnvironment): string | null {
  if (env.position === 0) {
    return "The first environment receives the pull requests of the tasks.";
  }
  if (asDeployProblem(env.problem) !== "") {
    return "Fix the configuration in Settings › Boards first.";
  }
  if (env.state === "unread") {
    return `${env.name} hasn't been read yet.`;
  }
  if (env.busy) {
    return `A deploy action is running on ${env.name}.`;
  }
  if (asDeployAvailable(env.available) === "") {
    return `Nothing to deploy to ${env.name}.`;
  }
  return null;
}

/**
 * openUrl is where O goes from a slot: from a cell the last run, else the failed one; from a
 * passage the deploy pull request, else the comparison. null when there is nowhere to go.
 */
export function openUrl(env: DeployEnvironment, kind: SlotKind): string | null {
  const url =
    kind === "cell"
      ? (env.lastRun?.url ?? env.failedRun?.url ?? "")
      : (env.promotion?.deployPr?.url ?? env.compareUrl);
  return url === "" ? null : url;
}

/** phaseOf is the state of an environment for the comparison between two readings: the main state, or the phase of the action. */
function phaseOf(env: DeployEnvironment): string {
  const action = env.action;
  if (action === null) {
    return env.state;
  }
  switch (action.phase) {
    case "failed":
      return `action_failed:${action.kind}`;
    case "waiting_run":
    case "running":
      return "running";
    default:
      return `acting:${action.phase}`;
  }
}

function environmentsByKey(
  deploys: Deploys,
): Map<string, { label: string; env: DeployEnvironment }> {
  const all = new Map<string, { label: string; env: DeployEnvironment }>();
  for (const board of deploys.boards ?? []) {
    for (const repo of board.repositories ?? []) {
      for (const env of environmentsOf(repo)) {
        all.set(envKey(repo.id, env.position), { label: `${repo.name} · ${env.name}`, env });
      }
    }
  }
  return all;
}

/**
 * changes are the environments whose state moved between two readings, each with what a reader
 * announces. A repository or an environment that appears for the first time is not a change.
 */
export function changes(previous: Deploys | null, next: Deploys): Change[] {
  if (previous === null) {
    return [];
  }
  const before = environmentsByKey(previous);
  const found: Change[] = [];
  for (const [key, { label, env }] of environmentsByKey(next)) {
    const was = before.get(key)?.env;
    if (was === undefined) {
      continue;
    }
    const from = phaseOf(was);
    const to = phaseOf(env);
    if (from === to) {
      continue;
    }
    const text = announcementOf(label, from, to);
    if (text !== null) {
      found.push({ key, text });
    }
  }
  return found;
}

function announcementOf(label: string, from: string, to: string): string | null {
  switch (to) {
    case "running":
      return `${label} is deploying`;
    case "failed":
      return `${label} failed`;
    case "pr_ready":
      return `${label} is ready to merge`;
    case "pending":
      return `${label} has changes to deploy`;
    case "up_to_date":
      return from === "running" ? `${label} deployed` : `${label} is up to date`;
    case "action_failed:merge":
      return `Couldn't merge ${label}`;
    case "action_failed:deploy":
      return `Couldn't create the deploy pull request of ${label}`;
    default:
      return null;
  }
}
