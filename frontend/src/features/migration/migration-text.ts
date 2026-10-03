import { displayPath, displayPaths } from "@/lib/paths";
import {
  asMigrationCaseKind,
  type Migration,
  type MigrationCase,
  type MigrationCaseKind,
  type MigrationTask,
} from "@/lib/wails";

// The order the screen lists the kinds in: the tasks that belong nowhere first,
// then the clones that cannot be identified, then the names that collide.
const KINDS: readonly MigrationCaseKind[] = ["root_task", "no_origin", "name_conflict"];

const TITLES: Record<MigrationCaseKind, string> = {
  root_task: "Tasks at the root of a workspace",
  no_origin: "Repositories without an origin on GitHub",
  name_conflict: "Tasks with the same name in the same repository",
};

const HINTS: Record<MigrationCaseKind, string> = {
  root_task: "Close or delete these tasks in the previous version of MySpec.",
  no_origin:
    "Add a GitHub origin to the repository, or delete its tasks, in the previous version of MySpec.",
  name_conflict: "Delete one of the tasks in the previous version of MySpec.",
};

/** caseTitle names a kind of case as the screen groups them. */
export function caseTitle(kind: MigrationCaseKind): string {
  return TITLES[kind];
}

/** caseHint says what to do about a kind of case, in the previous version. */
export function caseHint(kind: MigrationCaseKind): string {
  return HINTS[kind];
}

/** casesByKind groups the cases in the order the screen lists them. */
export function casesByKind(
  migration: Migration,
): { kind: MigrationCaseKind; cases: MigrationCase[] }[] {
  const all = migration.cases ?? [];
  return KINDS.map((kind) => ({
    kind,
    cases: all.filter((item) => asMigrationCaseKind(item.kind) === kind),
  })).filter((group) => group.cases.length > 0);
}

/** caseWhere is where a case happened: the clone or the owner/name, or the workspace of a task at the root of one. */
export function caseWhere(item: MigrationCase): string {
  return displayPath(item.repository !== "" ? item.repository : (item.tasks?.[0]?.workspace ?? ""));
}

/** taskWhere is where a task lives: its workspace, and its path when it has one. */
export function taskWhere(task: MigrationTask): string {
  return task.path === ""
    ? displayPath(task.workspace)
    : `${displayPath(task.workspace)} · ${displayPath(task.path)}`;
}

/** copyText is the list of cases as plain text, for the user to take to the previous version. */
export function copyText(migration: Migration): string {
  const lines = ["MySpec couldn't be updated"];
  for (const group of casesByKind(migration)) {
    lines.push("", caseTitle(group.kind), caseHint(group.kind));
    for (const item of group.cases) {
      lines.push(`- ${caseWhere(item)}`);
      if (item.detail !== "") {
        lines.push(`  ${displayPaths(item.detail)}`);
      }
      for (const task of item.tasks ?? []) {
        lines.push(`  - ${task.name} · ${taskWhere(task)}`);
      }
    }
  }
  return lines.join("\n");
}
