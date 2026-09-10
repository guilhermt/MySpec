import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { defaultRepoPath, reposOf } from "@/lib/repos";
import type {
  ArchivedTask,
  Leftover,
  Notice,
  Recent,
  RepoPR,
  State,
  TaskSummary,
  ThemePreference,
  Transcript,
  TranscriptEvent,
  Workspace,
} from "@/lib/wails";
import { asThemePreference, sessionKey } from "@/lib/wails";
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
  /** transcripts and drafts are keyed by sessionKey: a task has one per stage. */
  transcripts: Record<string, TranscriptState>;
  drafts: Record<string, string>;
  /** openRepo is the repository tab of a task in the PR stage, by task id. */
  openRepo: Record<string, string>;
  /** prDrafts is the pull request the user is editing, by repoKey. */
  prDrafts: Record<string, PrDraft>;
  newTaskFor: NodeId | null;
  /** historyOpen shows the archived tasks in the main area instead of a node. */
  historyOpen: boolean;
  /** openArchivedId is the archived task on screen, when one is. */
  openArchivedId: string | null;
  historyQuery: string;
  /** archivedNotice names the task that just left the workspace, until dismissed. */
  archivedNotice: ArchivedNotice | null;
  /** leftovers is what the last deletion could not remove from disk, until dismissed. */
  leftovers: readonly Leftover[] | null;

  applyState: (next: State) => void;
  setError: (message: string | null) => void;
  selectNode: (id: NodeId) => void;
  toggleNode: (id: NodeId) => void;
  setNodeExpanded: (id: NodeId, expanded: boolean) => void;

  openTask: (id: string) => void;
  closeTask: () => void;
  openNewTask: (nodeId: NodeId) => void;
  closeNewTask: () => void;
  beginTranscript: (taskId: string, stage: string) => void;
  setTranscript: (transcript: Transcript) => void;
  applyTranscriptEvent: (event: TranscriptEvent) => void;
  dropTranscript: (taskId: string, stage: string) => void;
  setDraft: (taskId: string, stage: string, text: string) => void;
  selectRepo: (taskId: string, repoPath: string) => void;
  setPrDraft: (taskId: string, repoPath: string, draft: PrDraft) => void;
  clearPrDraft: (taskId: string, repoPath: string) => void;

  openHistory: () => void;
  closeHistory: () => void;
  openArchived: (id: string) => void;
  closeArchived: () => void;
  setHistoryQuery: (query: string) => void;
  dismissArchivedNotice: () => void;
  setLeftovers: (leftovers: readonly Leftover[] | null) => void;
}

/** PrDraft is the title and the description of a pull request being edited. */
export interface PrDraft {
  title: string;
  body: string;
}

/** ArchivedNotice is the task that just left the workspace, as the notice names it. */
export interface ArchivedNotice {
  id: string;
  name: string;
}

/** repoKey identifies one pull request draft: a task and one of its repositories. */
export function repoKey(taskId: string, repoPath: string): string {
  return `${taskId}|${repoPath}`;
}

function tasksOf(state: State | null): readonly TaskSummary[] {
  return state?.tasks ?? NO_TASKS;
}

function findTask(state: State | null, id: string | null): TaskSummary | null {
  return tasksOf(state).find((task) => task.id === id) ?? null;
}

function historyOf(state: State | null): readonly ArchivedTask[] {
  return state?.history ?? NO_HISTORY;
}

// A task that shows up in the history between two snapshots was archived
// while the user was watching, which is what the notice announces.
function newlyArchived(
  previous: readonly ArchivedTask[],
  next: readonly ArchivedTask[],
): ArchivedTask | null {
  const known = new Set(previous.map((entry) => entry.id));
  return next.find((entry) => !known.has(entry.id)) ?? null;
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
  key: string,
): Record<string, TranscriptState> {
  const { [key]: _dropped, ...rest } = transcripts;
  return rest;
}

// A task that is gone takes every conversation it had with it, whatever stage
// each belonged to.
function withoutTaskTranscripts(
  transcripts: Record<string, TranscriptState>,
  taskId: string,
): Record<string, TranscriptState> {
  const prefix = sessionKey(taskId, "");
  return Object.fromEntries(Object.entries(transcripts).filter(([key]) => !key.startsWith(prefix)));
}

function initialTreeUi(): Pick<AppStore, "selectedNodeId" | "expandedNodeIds"> {
  return { selectedNodeId: ROOT_NODE_ID, expandedNodeIds: new Set<NodeId>([ROOT_NODE_ID]) };
}

// Nothing of another workspace survives: its tasks are gone from the snapshot.
function initialTaskUi(): Pick<
  AppStore,
  | "openTaskId"
  | "transcripts"
  | "drafts"
  | "openRepo"
  | "prDrafts"
  | "newTaskFor"
  | "historyOpen"
  | "openArchivedId"
  | "historyQuery"
  | "archivedNotice"
  | "leftovers"
> {
  return {
    openTaskId: null,
    transcripts: {},
    drafts: {},
    openRepo: {},
    prDrafts: {},
    newTaskFor: null,
    historyOpen: false,
    openArchivedId: null,
    historyQuery: "",
    archivedNotice: null,
    leftovers: null,
  };
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
      const history = historyOf(next);
      // The first snapshot brings the whole history at once; nothing in it was
      // archived under the eyes of the user.
      const archived = state.app === null ? null : newlyArchived(historyOf(state.app), history);
      const archivedNotice =
        archived === null ? state.archivedNotice : { id: archived.id, name: archived.name };
      const openArchivedId =
        state.openArchivedId !== null && !history.some((entry) => entry.id === state.openArchivedId)
          ? null
          : state.openArchivedId;
      const openTaskId = state.openTaskId;
      if (openTaskId === null || findTask(next, openTaskId) !== null) {
        return { app: next, selectedNodeId, archivedNotice, openArchivedId };
      }
      return {
        app: next,
        selectedNodeId,
        archivedNotice,
        openArchivedId,
        openTaskId: null,
        transcripts: withoutTaskTranscripts(state.transcripts, openTaskId),
      };
    }),

  setError: (message) => set({ error: message }),

  // Picking a node in the tree is asking for the workspace, not the history.
  selectNode: (id) => set({ selectedNodeId: id, historyOpen: false, openArchivedId: null }),

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
        return { openTaskId: id, historyOpen: false, openArchivedId: null };
      }
      const nodeId = nodeOfTask(task);
      return {
        openTaskId: id,
        historyOpen: false,
        openArchivedId: null,
        selectedNodeId: nodeId,
        expandedNodeIds: withExpanded(state.expandedNodeIds, nodeId, true),
      };
    }),

  closeTask: () => set({ openTaskId: null }),

  openNewTask: (nodeId) => set({ newTaskFor: nodeId }),

  closeNewTask: () => set({ newTaskFor: null }),

  beginTranscript: (taskId, stage) =>
    set((state) => {
      const key = sessionKey(taskId, stage);
      return {
        transcripts: {
          ...state.transcripts,
          [key]: {
            ...(state.transcripts[key] ?? emptyTranscript()),
            status: "loading",
            buffered: [],
          },
        },
      };
    }),

  // What arrived while loading is folded in afterwards, so the events that
  // raced with GetTranscript are neither lost nor applied out of order.
  setTranscript: (transcript) =>
    set((state) => {
      const key = sessionKey(transcript.taskId, transcript.stage);
      const buffered = state.transcripts[key]?.buffered ?? [];
      const loaded = buffered.reduce(applyEvent, fromTranscript(transcript));
      return { transcripts: { ...state.transcripts, [key]: loaded } };
    }),

  applyTranscriptEvent: (event) =>
    set((state) => {
      const key = sessionKey(event.taskId, event.stage);
      const current = state.transcripts[key];
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
      return { transcripts: { ...state.transcripts, [key]: next } };
    }),

  dropTranscript: (taskId, stage) =>
    set((state) => ({
      transcripts: withoutTranscript(state.transcripts, sessionKey(taskId, stage)),
    })),

  setDraft: (taskId, stage, text) =>
    set((state) => ({ drafts: { ...state.drafts, [sessionKey(taskId, stage)]: text } })),

  selectRepo: (taskId, repoPath) =>
    set((state) => ({ openRepo: { ...state.openRepo, [taskId]: repoPath } })),

  // The draft the user is editing outlives what the agent says next; only
  // opening the pull request, or throwing the draft away, clears it.
  setPrDraft: (taskId, repoPath, draft) =>
    set((state) => ({ prDrafts: { ...state.prDrafts, [repoKey(taskId, repoPath)]: draft } })),

  clearPrDraft: (taskId, repoPath) =>
    set((state) => {
      const { [repoKey(taskId, repoPath)]: _dropped, ...rest } = state.prDrafts;
      return { prDrafts: rest };
    }),

  // The history is a place of its own: opening it puts away whatever the main
  // area was showing.
  openHistory: () =>
    set({ historyOpen: true, openTaskId: null, openArchivedId: null, newTaskFor: null }),

  closeHistory: () => set({ historyOpen: false, openArchivedId: null }),

  openArchived: (id) => set({ openArchivedId: id, historyOpen: true, openTaskId: null }),

  closeArchived: () => set({ openArchivedId: null }),

  setHistoryQuery: (query) => set({ historyQuery: query }),

  dismissArchivedNotice: () => set({ archivedNotice: null }),

  setLeftovers: (leftovers) => set({ leftovers }),
}));

const NO_RECENTS: readonly Recent[] = [];
const NO_TASKS: readonly TaskSummary[] = [];
const NO_HISTORY: readonly ArchivedTask[] = [];

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

export function useTranscript(taskId: string, stage: string): TranscriptState | null {
  return useAppStore((state) => state.transcripts[sessionKey(taskId, stage)] ?? null);
}

export function useDraft(taskId: string, stage: string): string {
  return useAppStore((state) => state.drafts[sessionKey(taskId, stage)] ?? "");
}

export function useRepos(taskId: string): readonly RepoPR[] {
  return useAppStore((state) => reposOf(findTask(state.app, taskId)));
}

/**
 * useOpenRepo is the selected repository tab of a task. A selection that no
 * longer names a repository of the task falls back to the default.
 */
export function useOpenRepo(taskId: string): string {
  return useAppStore((state) => {
    const repos = reposOf(findTask(state.app, taskId));
    const selected = state.openRepo[taskId];
    if (selected !== undefined && repos.some((repo) => repo.repoPath === selected)) {
      return selected;
    }
    return defaultRepoPath(repos);
  });
}

export function usePrDraft(taskId: string, repoPath: string): PrDraft | null {
  return useAppStore((state) => state.prDrafts[repoKey(taskId, repoPath)] ?? null);
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

export function useHistory(): readonly ArchivedTask[] {
  return useAppStore((state) => historyOf(state.app));
}

export function useArchivedTask(id: string | null): ArchivedTask | null {
  return useAppStore((state) => historyOf(state.app).find((entry) => entry.id === id) ?? null);
}

export interface HistoryUi {
  historyOpen: boolean;
  openArchivedId: string | null;
  historyQuery: string;
}

export function useHistoryUi(): HistoryUi {
  return useAppStore(
    useShallow((state) => ({
      historyOpen: state.historyOpen,
      openArchivedId: state.openArchivedId,
      historyQuery: state.historyQuery,
    })),
  );
}

export function useArchivedNotice(): ArchivedNotice | null {
  return useAppStore((state) => state.archivedNotice);
}

export function useLeftovers(): readonly Leftover[] | null {
  return useAppStore((state) => state.leftovers);
}

/** filterHistory keeps the archived tasks whose name carries what was typed. */
export function filterHistory(
  history: readonly ArchivedTask[],
  query: string,
): readonly ArchivedTask[] {
  const term = query.trim().toLowerCase();
  if (term === "") {
    return history;
  }
  return history.filter((entry) => entry.name.toLowerCase().includes(term));
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
