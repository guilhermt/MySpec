import { type RenderResult, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import type { State } from "@/lib/wails";
import { type AppStore, useAppStore } from "@/store/app-store";

export interface StoreOptions {
  state?: State | null;
  ui?: Partial<
    Pick<
      AppStore,
      | "error"
      | "openTaskId"
      | "transcripts"
      | "drafts"
      | "openStepTab"
      | "prDrafts"
      | "newTaskOpen"
      | "lastRepositoryId"
      | "historyOpen"
      | "openArchivedId"
      | "historyQuery"
      | "archivedNotice"
      | "leftover"
      | "flashing"
      | "settingsOpen"
      | "settingsSection"
      | "promptEdit"
      | "pendingLeave"
    >
  >;
}

export interface RenderWithStoreResult extends RenderResult {
  user: UserEvent;
}

export function resetAppStore(options: StoreOptions = {}): void {
  useAppStore.setState({
    app: options.state ?? null,
    error: options.ui?.error ?? null,
    openTaskId: options.ui?.openTaskId ?? null,
    transcripts: options.ui?.transcripts ?? {},
    drafts: options.ui?.drafts ?? {},
    openStepTab: options.ui?.openStepTab ?? {},
    prDrafts: options.ui?.prDrafts ?? {},
    newTaskOpen: options.ui?.newTaskOpen ?? false,
    lastRepositoryId: options.ui?.lastRepositoryId ?? null,
    historyOpen: options.ui?.historyOpen ?? false,
    openArchivedId: options.ui?.openArchivedId ?? null,
    historyQuery: options.ui?.historyQuery ?? "",
    archivedNotice: options.ui?.archivedNotice ?? null,
    leftover: options.ui?.leftover ?? null,
    flashing: options.ui?.flashing ?? new Set<string>(),
    settingsOpen: options.ui?.settingsOpen ?? false,
    settingsSection: options.ui?.settingsSection ?? "defaults",
    promptEdit: options.ui?.promptEdit ?? null,
    pendingLeave: options.ui?.pendingLeave ?? null,
  });
}

export function renderWithStore(
  ui: ReactElement,
  options: StoreOptions = {},
): RenderWithStoreResult {
  resetAppStore(options);
  return { user: userEvent.setup(), ...render(ui) };
}
