/** TASK_NAME_MAX is the longest a task name can be. */
export const TASK_NAME_MAX = 64;

/** TASK_NAME_PATTERN is the name the folder on disk and the branch can share. */
export const TASK_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** isValidTaskName reports whether a name can be used as it is. */
export function isValidTaskName(name: string): boolean {
  return name.length <= TASK_NAME_MAX && TASK_NAME_PATTERN.test(name);
}

/** suggestTaskName turns anything the user typed into a name that is valid. */
export function suggestTaskName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TASK_NAME_MAX)
    .replace(/-+$/, "");
}

/** NameProblem is why a name cannot be used. */
export type NameProblem = "empty" | "invalid" | "too_long" | "taken";

/** taskNameProblem finds the first problem of a name, or null when it is fine. */
export function taskNameProblem(name: string, taken: readonly string[]): NameProblem | null {
  if (name === "") {
    return "empty";
  }
  if (!TASK_NAME_PATTERN.test(name)) {
    return "invalid";
  }
  if (name.length > TASK_NAME_MAX) {
    return "too_long";
  }
  if (taken.includes(name)) {
    return "taken";
  }
  return null;
}
