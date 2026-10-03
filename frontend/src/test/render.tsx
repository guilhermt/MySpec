import { type RenderResult, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { HOME } from "@/lib/locations";
import type { Startup, State } from "@/lib/wails";
import { type AppStore, useAppStore } from "@/store/app-store";

export interface StoreOptions {
  state?: State | null;
  startup?: Startup | null;
  ui?: Partial<
    Pick<
      AppStore,
      | "error"
      | "location"
      | "back"
      | "forward"
      | "panel"
      | "panelDocument"
      | "earlierConversation"
      | "pendingFocus"
      | "sidebarRail"
      | "toasts"
      | "announcement"
      | "expectGone"
      | "transcripts"
      | "drafts"
      | "markerRequest"
      | "draftRequest"
      | "boardCardRequest"
      | "openStepTab"
      | "prDrafts"
      | "questionChoices"
      | "questionSending"
      | "newTaskOpen"
      | "newTaskCard"
      | "pendingStart"
      | "startReview"
      | "pendingReview"
      | "publishAttempts"
      | "reviewDialog"
      | "discussionDialog"
      | "newDiscussion"
      | "textDrafts"
      | "sidebarCollapsed"
      | "lastRepositoryId"
      | "historyQuery"
      | "leftover"
      | "flashing"
      | "promptEdit"
      | "pendingLeave"
      | "promptReturn"
    >
  >;
}

export interface RenderWithStoreResult extends RenderResult {
  user: UserEvent;
}

export function resetAppStore(options: StoreOptions = {}): void {
  useAppStore.setState({
    startup: options.startup ?? null,
    startupTheme: null,
    app: options.state ?? null,
    error: options.ui?.error ?? null,
    location: options.ui?.location ?? HOME,
    back: options.ui?.back ?? [],
    forward: options.ui?.forward ?? [],
    panel: options.ui?.panel ?? null,
    panelDocument: options.ui?.panelDocument ?? null,
    earlierConversation: options.ui?.earlierConversation ?? null,
    pendingFocus: options.ui?.pendingFocus ?? null,
    sidebarRail: options.ui?.sidebarRail ?? false,
    toasts: options.ui?.toasts ?? [],
    announcement: options.ui?.announcement ?? null,
    expectGone: options.ui?.expectGone ?? null,
    transcripts: options.ui?.transcripts ?? {},
    drafts: options.ui?.drafts ?? {},
    markerRequest: options.ui?.markerRequest ?? null,
    draftRequest: options.ui?.draftRequest ?? null,
    boardCardRequest: options.ui?.boardCardRequest ?? null,
    openStepTab: options.ui?.openStepTab ?? {},
    prDrafts: options.ui?.prDrafts ?? {},
    questionChoices: options.ui?.questionChoices ?? {},
    questionSending: options.ui?.questionSending ?? {},
    newTaskOpen: options.ui?.newTaskOpen ?? false,
    newTaskCard: options.ui?.newTaskCard ?? null,
    pendingStart: options.ui?.pendingStart ?? null,
    startReview: options.ui?.startReview ?? null,
    pendingReview: options.ui?.pendingReview ?? null,
    publishAttempts: options.ui?.publishAttempts ?? {},
    reviewDialog: options.ui?.reviewDialog ?? null,
    discussionDialog: options.ui?.discussionDialog ?? null,
    newDiscussion: options.ui?.newDiscussion ?? null,
    textDrafts: options.ui?.textDrafts ?? {},
    sidebarCollapsed: options.ui?.sidebarCollapsed ?? new Set<string>(),
    lastRepositoryId: options.ui?.lastRepositoryId ?? null,
    historyQuery: options.ui?.historyQuery ?? "",
    leftover: options.ui?.leftover ?? null,
    flashing: options.ui?.flashing ?? new Set<string>(),
    promptEdit: options.ui?.promptEdit ?? null,
    pendingLeave: options.ui?.pendingLeave ?? null,
    promptReturn: options.ui?.promptReturn ?? null,
  });
}

export function renderWithStore(
  ui: ReactElement,
  options: StoreOptions = {},
): RenderWithStoreResult {
  resetAppStore(options);
  return { user: userEvent.setup(), ...render(ui) };
}
