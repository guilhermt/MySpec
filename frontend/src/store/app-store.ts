import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  Notice,
  Recent,
  State,
  TaskSummary,
  ThemePreference,
  Transcript,
  TranscriptEvent,
  Workspace,
} from "@/lib/wails";
import { asThemePreference } from "@/lib/wails";
import {
  applyEvent,
  emptyTranscript,
  fromTranscript,
  type TranscriptState,
} from "@/store/transcript";

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
  openTaskId: string | null;
  transcripts: Record<string, TranscriptState>;
  drafts: Record<string, string>;
  newTaskFor: NodeId | null;

  applyState: (next: State) => void;
  setError: (message: string | null) => void;
  selectNode: (id: NodeId) => void;
  toggleNode: (id: NodeId) => void;
  setNodeExpanded: (id: NodeId, expanded: boolean) => void;

  openTask: (id: string) => void;
  closeTask: () => void;
  openNewTask: (nodeId: NodeId) => void;
  closeNewTask: () => void;
  beginTranscript: (taskId: string) => void;
  setTranscript: (transcript: Transcript) => void;
  applyTranscriptEvent: (event: TranscriptEvent) => void;
  dropTranscript: (taskId: string) => void;
  setDraft: (taskId: string, text: string) => void;
}

function tasksOf(state: State | null): readonly TaskSummary[] {
  return state?.tasks ?? NO_TASKS;
}

function findTask(state: State | null, id: string | null): TaskSummary | null {
  return tasksOf(state).find((task) => task.id === id) ?? null;
}

function nodeOfTask(task: TaskSummary): NodeId {
  return task.repoPath === "" ? ROOT_NODE_ID : repoNodeId(task.repoPath);
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

function withoutTranscript(
  transcripts: Record<string, TranscriptState>,
  taskId: string,
): Record<string, TranscriptState> {
  const { [taskId]: _dropped, ...rest } = transcripts;
  return rest;
}

function initialTreeUi(): Pick<AppStore, "selectedNodeId" | "expandedNodeIds"> {
  return { selectedNodeId: ROOT_NODE_ID, expandedNodeIds: new Set<NodeId>([ROOT_NODE_ID]) };
}

// Nothing of another workspace survives: its tasks are gone from the snapshot.
function initialTaskUi(): Pick<AppStore, "openTaskId" | "transcripts" | "drafts" | "newTaskFor"> {
  return { openTaskId: null, transcripts: {}, drafts: {}, newTaskFor: null };
}

export const useAppStore = create<AppStore>()((set) => ({
  app: null,
  error: null,
  ...initialTreeUi(),
  ...initialTaskUi(),

  applyState: (next) =>
    set((state) => {
      if (next.workspace?.path !== state.app?.workspace?.path) {
        return { app: next, ...initialTreeUi(), ...initialTaskUi() };
      }
      const selectedNodeId = nodeExists(next, state.selectedNodeId)
        ? state.selectedNodeId
        : ROOT_NODE_ID;
      const openTaskId = state.openTaskId;
      if (openTaskId === null || findTask(next, openTaskId) !== null) {
        return { app: next, selectedNodeId };
      }
      return {
        app: next,
        selectedNodeId,
        openTaskId: null,
        transcripts: withoutTranscript(state.transcripts, openTaskId),
      };
    }),

  setError: (message) => set({ error: message }),

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleNode: (id) =>
    set((state) => ({
      expandedNodeIds: withExpanded(state.expandedNodeIds, id, !state.expandedNodeIds.has(id)),
    })),

  setNodeExpanded: (id, expanded) =>
    set((state) => ({ expandedNodeIds: withExpanded(state.expandedNodeIds, id, expanded) })),

  // Opening a task also reveals it in the tree, so the two panes agree.
  openTask: (id) =>
    set((state) => {
      const task = findTask(state.app, id);
      if (task === null) {
        return { openTaskId: id };
      }
      const nodeId = nodeOfTask(task);
      return {
        openTaskId: id,
        selectedNodeId: nodeId,
        expandedNodeIds: withExpanded(state.expandedNodeIds, nodeId, true),
      };
    }),

  closeTask: () => set({ openTaskId: null }),

  openNewTask: (nodeId) => set({ newTaskFor: nodeId }),

  closeNewTask: () => set({ newTaskFor: null }),

  beginTranscript: (taskId) =>
    set((state) => ({
      transcripts: {
        ...state.transcripts,
        [taskId]: {
          ...(state.transcripts[taskId] ?? emptyTranscript()),
          status: "loading",
          buffered: [],
        },
      },
    })),

  // What arrived while loading is folded in afterwards, so the events that
  // raced with GetTranscript are neither lost nor applied out of order.
  setTranscript: (transcript) =>
    set((state) => {
      const buffered = state.transcripts[transcript.taskId]?.buffered ?? [];
      const loaded = buffered.reduce(applyEvent, fromTranscript(transcript));
      return { transcripts: { ...state.transcripts, [transcript.taskId]: loaded } };
    }),

  applyTranscriptEvent: (event) =>
    set((state) => {
      const current = state.transcripts[event.taskId];
      if (current === undefined) {
        return {};
      }
      const next =
        current.status === "loading"
          ? { ...current, buffered: [...current.buffered, event] }
          : applyEvent(current, event);
      if (next === current) {
        return {};
      }
      return { transcripts: { ...state.transcripts, [event.taskId]: next } };
    }),

  dropTranscript: (taskId) =>
    set((state) => ({ transcripts: withoutTranscript(state.transcripts, taskId) })),

  setDraft: (taskId, text) => set((state) => ({ drafts: { ...state.drafts, [taskId]: text } })),
}));

const NO_RECENTS: readonly Recent[] = [];
const NO_TASKS: readonly TaskSummary[] = [];

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

export function useTasks(): readonly TaskSummary[] {
  return useAppStore((state) => state.app?.tasks ?? NO_TASKS);
}

export function useTask(id: string | null): TaskSummary | null {
  return useAppStore((state) => findTask(state.app, id));
}

export function useTasksOf(nodeId: NodeId): readonly TaskSummary[] {
  return useAppStore(
    useShallow((state) => tasksOf(state.app).filter((task) => nodeOfTask(task) === nodeId)),
  );
}

export function useOpenTask(): TaskSummary | null {
  return useAppStore((state) => findTask(state.app, state.openTaskId));
}

export function useTranscript(taskId: string): TranscriptState | null {
  return useAppStore((state) => state.transcripts[taskId] ?? null);
}

export function useDraft(taskId: string): string {
  return useAppStore((state) => state.drafts[taskId] ?? "");
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
  openTaskId: string | null;
}

export function useTreeUi(): TreeUi {
  return useAppStore(
    useShallow((state) => ({
      selectedNodeId: state.selectedNodeId,
      expandedNodeIds: state.expandedNodeIds,
      openTaskId: state.openTaskId,
    })),
  );
}
