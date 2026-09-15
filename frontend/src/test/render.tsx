import { type RenderResult, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import type { State } from "@/lib/wails";
import { type AppStore, type NodeId, ROOT_NODE_ID, useAppStore } from "@/store/app-store";

export interface StoreOptions {
  state?: State | null;
  ui?: Partial<
    Pick<
      AppStore,
      | "selectedNodeId"
      | "expandedNodeIds"
      | "error"
      | "openTaskId"
      | "transcripts"
      | "drafts"
      | "openRepo"
      | "openStepTab"
      | "prDrafts"
      | "newTaskFor"
      | "historyOpen"
      | "openArchivedId"
      | "historyQuery"
      | "archivedNotice"
      | "leftovers"
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
    selectedNodeId: options.ui?.selectedNodeId ?? ROOT_NODE_ID,
    expandedNodeIds: options.ui?.expandedNodeIds ?? new Set<NodeId>([ROOT_NODE_ID]),
    openTaskId: options.ui?.openTaskId ?? null,
    transcripts: options.ui?.transcripts ?? {},
    drafts: options.ui?.drafts ?? {},
    openRepo: options.ui?.openRepo ?? {},
    openStepTab: options.ui?.openStepTab ?? {},
    prDrafts: options.ui?.prDrafts ?? {},
    newTaskFor: options.ui?.newTaskFor ?? null,
    historyOpen: options.ui?.historyOpen ?? false,
    openArchivedId: options.ui?.openArchivedId ?? null,
    historyQuery: options.ui?.historyQuery ?? "",
    archivedNotice: options.ui?.archivedNotice ?? null,
    leftovers: options.ui?.leftovers ?? null,
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
