import type { Notice, Recent, Repo, State, Workspace } from "@bindings/models";
import * as SettingsService from "@bindings/settingsservice";
import * as WorkspaceService from "@bindings/workspaceservice";
import { Events } from "@wailsio/runtime";

export type { Notice, Recent, Repo, State, Workspace };

export type ThemePreference = "system" | "light" | "dark";
export type NoticeReason = "not_found" | "not_directory" | "not_readable" | "last_recent_missing";

export function asThemePreference(value: string): ThemePreference {
  switch (value) {
    case "light":
    case "dark":
    case "system":
      return value;
    default:
      return "system";
  }
}

export function asNoticeReason(value: string): NoticeReason {
  switch (value) {
    case "not_found":
    case "not_directory":
    case "not_readable":
    case "last_recent_missing":
      return value;
    default:
      return "not_readable";
  }
}

export const api = {
  getState: (): Promise<State> => WorkspaceService.GetState(),
  openPath: (path: string): Promise<void> => WorkspaceService.OpenPath(path),
  openFolderDialog: (): Promise<void> => WorkspaceService.OpenFolderDialog(),
  removeRecent: (path: string): Promise<void> => WorkspaceService.RemoveRecent(path),
  dismissNotice: (): Promise<void> => WorkspaceService.DismissNotice(),
  setTheme: (preference: ThemePreference): Promise<void> => SettingsService.SetTheme(preference),
};

export function onStateChanged(handler: (state: State) => void): () => void {
  return Events.On("state:changed", (event) => handler(event.data));
}
