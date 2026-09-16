// UI memory that outlives the app: what the user filtered, collapsed and
// expanded. It is presentation state, so it lives in localStorage and never in
// the Go state.

/** readStored reads a JSON value kept in localStorage, fallback when absent or unreadable. */
export function readStored<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** writeStored keeps a JSON value in localStorage. */
export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A storage that refuses the write only costs the memory of the next run.
  }
}

/** boardViewKey is where the filters and the collapsed sections of a board view are kept. */
export const boardViewKey = (boardId: string) => `myspec.board.${boardId}`;

/** SIDEBAR_COLLAPSED_KEY is where the sidebar nodes the user collapsed are kept. */
export const SIDEBAR_COLLAPSED_KEY = "myspec.sidebar.collapsed";
