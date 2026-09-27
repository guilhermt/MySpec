import { type RenderResult, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { HOME } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { type AppStore, useAppStore } from "@/store/app-store";

export interface StoreOptions {
  state?: State | null;
  ui?: Partial<
    Pick<
      AppStore,
      | "error"
      | "location"
      | "back"
      | "forward"
      | "panel"
      | "pendingFocus"
      | "sidebarRail"
      | "toasts"
      | "announcement"
      | "expectGone"
      | "transcripts"
      | "drafts"
      | "openStepTab"
      | "prDrafts"
      | "newTaskOpen"
      | "newTaskCard"
      | "pendingStart"
      | "startReview"
      | "pendingReview"
      | "newDiscussion"
      | "textDrafts"
      | "sidebarCollapsed"
      | "lastRepositoryId"
      | "historyQuery"
      | "archivedNotice"
      | "leftover"
      | "flashing"
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
    location: options.ui?.location ?? HOME,
    back: options.ui?.back ?? [],
    forward: options.ui?.forward ?? [],
    panel: options.ui?.panel ?? null,
    pendingFocus: options.ui?.pendingFocus ?? null,
    sidebarRail: options.ui?.sidebarRail ?? false,
    toasts: options.ui?.toasts ?? [],
    announcement: options.ui?.announcement ?? null,
    expectGone: options.ui?.expectGone ?? null,
    transcripts: options.ui?.transcripts ?? {},
    drafts: options.ui?.drafts ?? {},
    openStepTab: options.ui?.openStepTab ?? {},
    prDrafts: options.ui?.prDrafts ?? {},
    newTaskOpen: options.ui?.newTaskOpen ?? false,
    newTaskCard: options.ui?.newTaskCard ?? null,
    pendingStart: options.ui?.pendingStart ?? null,
    startReview: options.ui?.startReview ?? null,
    pendingReview: options.ui?.pendingReview ?? null,
    newDiscussion: options.ui?.newDiscussion ?? null,
    textDrafts: options.ui?.textDrafts ?? {},
    sidebarCollapsed: options.ui?.sidebarCollapsed ?? new Set<string>(),
    lastRepositoryId: options.ui?.lastRepositoryId ?? null,
    historyQuery: options.ui?.historyQuery ?? "",
    archivedNotice: options.ui?.archivedNotice ?? null,
    leftover: options.ui?.leftover ?? null,
    flashing: options.ui?.flashing ?? new Set<string>(),
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
