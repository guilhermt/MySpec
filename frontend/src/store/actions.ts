import type { ThemePreference } from "@/lib/wails";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// No action touches `app`: the new state always arrives through state:changed.
async function run(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    useAppStore.getState().setError(messageOf(error));
  }
}

export function openPath(path: string): Promise<void> {
  return run(() => api.openPath(path));
}

export function openFolderDialog(): Promise<void> {
  return run(() => api.openFolderDialog());
}

export function removeRecent(path: string): Promise<void> {
  return run(() => api.removeRecent(path));
}

export function dismissNotice(): Promise<void> {
  return run(() => api.dismissNotice());
}

export function setTheme(preference: ThemePreference): Promise<void> {
  return run(() => api.setTheme(preference));
}
