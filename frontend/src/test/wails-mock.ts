import { vi } from "vitest";
import type { State, ThemePreference } from "@/lib/wails";

export const api = {
  getState: vi.fn<() => Promise<State>>(() => Promise.resolve(makeState())),
  openPath: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  openFolderDialog: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  removeRecent: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  dismissNotice: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  setTheme: vi.fn<(preference: ThemePreference) => Promise<void>>(() => Promise.resolve()),
};

let handlers: ((state: State) => void)[] = [];

export const onStateChanged = vi.fn((handler: (state: State) => void): (() => void) => {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((registered) => registered !== handler);
  };
});

/** emitState delivers a state:changed event to everything currently subscribed. */
export function emitState(state: State): void {
  for (const handler of [...handlers]) {
    handler(state);
  }
}

export function subscriberCount(): number {
  return handlers.length;
}

export function makeState(overrides: Partial<State> = {}): State {
  return {
    workspace: {
      name: "projects",
      path: "/home/dev/projects",
      repos: [
        { name: "api", path: "/home/dev/projects/api" },
        { name: "web", path: "/home/dev/projects/web" },
      ],
    },
    recents: [
      { name: "projects", path: "/home/dev/projects" },
      { name: "labs", path: "/home/dev/labs" },
      { name: "scratch", path: "/home/dev/scratch" },
    ],
    theme: "system",
    systemDark: false,
    notice: null,
    tasks: [],
    ...overrides,
  };
}

export function resetWailsMock(): void {
  handlers = [];
  for (const fn of Object.values(api)) {
    fn.mockClear();
  }
  onStateChanged.mockClear();
  api.getState.mockImplementation(() => Promise.resolve(makeState()));
}
