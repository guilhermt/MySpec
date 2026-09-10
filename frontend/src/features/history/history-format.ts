/** formatDate reads one timestamp of the history the way the user writes dates. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** formatDates is the life of an archived task: the day it began and the day it ended. */
export function formatDates(created: string, archived: string): string {
  return `${formatDate(created)} → ${formatDate(archived)}`;
}

/** stepCount reads the size of a plan, in English. */
export function stepCount(steps: number): string {
  return `${steps} ${steps === 1 ? "step" : "steps"}`;
}
