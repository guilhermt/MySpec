import {
  asMigrationCaseKind,
  type Migration,
  type MigrationCase,
  type MigrationCaseKind,
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
