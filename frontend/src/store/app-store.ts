import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Notice, Recent, State, ThemePreference, Workspace } from "@/lib/wails";
import { asThemePreference } from "@/lib/wails";

export type NodeId = "root" | `repo:${string}`;

export const ROOT_NODE_ID = "root" satisfies NodeId;

export function repoNodeId(path: string): NodeId {
  return `repo:${path}`;
}

export interface AppStore {
  app: State | null;
  error: string | null;
  selectedNodeId: NodeId;
  expandedNodeIds: ReadonlySet<NodeId>;

  applyState: (next: State) => void;
  setError: (message: string | null) => void;
  selectNode: (id: NodeId) => void;
  toggleNode: (id: NodeId) => void;
  setNodeExpanded: (id: NodeId, expanded: boolean) => void;
}

function nodeExists(state: State, id: NodeId): boolean {
  if (id === ROOT_NODE_ID) {
    return state.workspace !== null;
  }
  return (state.workspace?.repos ?? []).some((repo) => repoNodeId(repo.path) === id);
}

function withExpanded(
  current: ReadonlySet<NodeId>,
  id: NodeId,
  expanded: boolean,
): ReadonlySet<NodeId> {
  const next = new Set(current);
  if (expanded) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

function initialTreeUi(): Pick<AppStore, "selectedNodeId" | "expandedNodeIds"> {
  return { selectedNodeId: ROOT_NODE_ID, expandedNodeIds: new Set<NodeId>([ROOT_NODE_ID]) };
}

export const useAppStore = create<AppStore>()((set) => ({
  app: null,
  error: null,
  ...initialTreeUi(),

  applyState: (next) =>
    set((state) => {
      if (next.workspace?.path !== state.app?.workspace?.path) {
        return { app: next, ...initialTreeUi() };
      }
      const selectedNodeId = nodeExists(next, state.selectedNodeId)
        ? state.selectedNodeId
        : ROOT_NODE_ID;
      return { app: next, selectedNodeId };
    }),

  setError: (message) => set({ error: message }),

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleNode: (id) =>
    set((state) => ({
      expandedNodeIds: withExpanded(state.expandedNodeIds, id, !state.expandedNodeIds.has(id)),
    })),

  setNodeExpanded: (id, expanded) =>
    set((state) => ({ expandedNodeIds: withExpanded(state.expandedNodeIds, id, expanded) })),
}));

const NO_RECENTS: readonly Recent[] = [];

export function useWorkspace(): Workspace | null {
  return useAppStore((state) => state.app?.workspace ?? null);
}

export function useRecents(): readonly Recent[] {
  return useAppStore((state) => state.app?.recents ?? NO_RECENTS);
}

export function useNotice(): Notice | null {
  return useAppStore((state) => state.app?.notice ?? null);
}

export function useError(): string | null {
  return useAppStore((state) => state.error);
}

export interface ThemeState {
  preference: ThemePreference;
  systemDark: boolean;
}

export function useThemeState(): ThemeState {
  return useAppStore(
    useShallow((state) => ({
      preference: asThemePreference(state.app?.theme ?? "system"),
      systemDark: state.app?.systemDark ?? false,
    })),
  );
}

export interface TreeUi {
  selectedNodeId: NodeId;
  expandedNodeIds: ReadonlySet<NodeId>;
}

export function useTreeUi(): TreeUi {
  return useAppStore(
    useShallow((state) => ({
      selectedNodeId: state.selectedNodeId,
      expandedNodeIds: state.expandedNodeIds,
    })),
  );
}
