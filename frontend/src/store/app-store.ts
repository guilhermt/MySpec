import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { defaultRepoPath, reposOf } from "@/lib/repos";
import { repoSituation, stageSituation, stepSituation } from "@/lib/situations";
import type {
  ArchivedTask,
  Leftover,
  Notice,
  Place,
  PromptStage,
  Recent,
  RepoPR,
  Situation,
  State,
  TaskSummary,
  ThemePreference,
  Transcript,
  TranscriptEvent,
  Workspace,
} from "@/lib/wails";
import { asPlaceKind, asTaskStage, asThemePreference, sessionKey } from "@/lib/wails";
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

/** SettingsSection is what the settings screen shows: the model defaults or one prompt. */
export type SettingsSection = "models" | PromptStage;

/** PromptEdit is a prompt open in the editor: the text it opened with and the text it has now. */
export interface PromptEdit {
  stage: PromptStage;
  original: string;
  text: string;
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
  /**
   * flashing are the situations that just started while the user was looking,
   * by id, for the brief highlight.
   */
  flashing: ReadonlySet<string>;
  /** settingsOpen shows the settings in the main area. They belong to the app, not to a workspace. */
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  /** promptEdit is the prompt open in the editor, null when the editor is closed. */
  promptEdit: PromptEdit | null;
  /** pendingLeave is the navigation that waits for the user to discard the unsaved edit of a prompt. */
  pendingLeave: (() => void) | null;

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

  flashSituation: (id: string) => void;
  unflashSituation: (id: string) => void;
  /** openPlace opens a task where one of its situations is. */
  openPlace: (taskId: string, place: Place) => void;

  openSettings: () => void;
  closeSettings: () => void;
  selectSettingsSection: (section: SettingsSection) => void;
  startPromptEdit: (stage: PromptStage, text: string) => void;
  setPromptEditText: (text: string) => void;
  /** cancelPromptEdit closes the editor, asking first when there are changes. */
  cancelPromptEdit: () => void;
  /** finishPromptEdit closes the editor after a save, with nothing left to lose. */
  finishPromptEdit: () => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
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
// The settings are not here: they belong to the app, so they stay on screen,
// with whatever prompt is open in the editor, across a change of workspace.
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
  | "flashing"
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
    flashing: new Set<string>(),
  };
}

export const useAppStore = create<AppStore>()((set, get) => {
  // leave runs a navigation that takes the prompt editor off the screen. With an
  // unsaved edit, the navigation waits for the user to agree to lose it.
  const leave = (navigate: () => void) => {
    const edit = get().promptEdit;
    if (edit !== null && edit.text !== edit.original) {
      set({ pendingLeave: navigate });
      return;
    }
    set({ promptEdit: null });
    navigate();
  };

  return {
    app: null,
    error: null,
    settingsOpen: false,
    settingsSection: "models",
    promptEdit: null,
    pendingLeave: null,
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
          state.openArchivedId !== null &&
          !history.some((entry) => entry.id === state.openArchivedId)
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

    // Picking a node in the tree is asking for the workspace, not the history or
    // the settings.
    selectNode: (id) =>
      leave(() =>
        set({
          selectedNodeId: id,
          historyOpen: false,
          openArchivedId: null,
          settingsOpen: false,
        }),
      ),

    toggleNode: (id) =>
      set((state) => ({
        expandedNodeIds: withExpanded(state.expandedNodeIds, id, !state.expandedNodeIds.has(id)),
      })),

    setNodeExpanded: (id, expanded) =>
      set((state) => ({ expandedNodeIds: withExpanded(state.expandedNodeIds, id, expanded) })),

    // Opening a task also reveals it in the tree, so the two panes agree.
    openTask: (id) =>
      leave(() =>
        set((state) => {
          const task = findTask(state.app, id);
          if (task === null) {
            return {
              openTaskId: id,
              historyOpen: false,
              openArchivedId: null,
              settingsOpen: false,
            };
          }
          const nodeId = nodeOfTask(task);
          return {
            openTaskId: id,
            historyOpen: false,
            openArchivedId: null,
            settingsOpen: false,
            selectedNodeId: nodeId,
            expandedNodeIds: withExpanded(state.expandedNodeIds, nodeId, true),
          };
        }),
      ),

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
      leave(() =>
        set({
          historyOpen: true,
          openTaskId: null,
          openArchivedId: null,
          newTaskFor: null,
          settingsOpen: false,
        }),
      ),

    closeHistory: () => set({ historyOpen: false, openArchivedId: null }),

    openArchived: (id) =>
      leave(() =>
        set({ openArchivedId: id, historyOpen: true, openTaskId: null, settingsOpen: false }),
      ),

    closeArchived: () => set({ openArchivedId: null }),

    setHistoryQuery: (query) => set({ historyQuery: query }),

    dismissArchivedNotice: () => set({ archivedNotice: null }),

    setLeftovers: (leftovers) => set({ leftovers }),

    // A new set every time: the selectors hand the set itself to the components,
    // which only see a change through a new reference.
    flashSituation: (id) => set((state) => ({ flashing: new Set(state.flashing).add(id) })),

    unflashSituation: (id) =>
      set((state) => {
        const flashing = new Set(state.flashing);
        flashing.delete(id);
        return { flashing };
      }),

    // A situation opens where it is: its task, on the tab of its repository when
    // it is in one. Going there puts away the history, the settings and the
    // creation of a task.
    openPlace: (taskId, place) => {
      // A situation of a task that is gone navigates nowhere, so it never asks
      // the user about an unsaved edit either.
      const task = findTask(get().app, taskId);
      if (task === null) {
        return;
      }
      const nodeId = nodeOfTask(task);
      leave(() =>
        set((state) => ({
          openTaskId: taskId,
          historyOpen: false,
          openArchivedId: null,
          newTaskFor: null,
          settingsOpen: false,
          selectedNodeId: nodeId,
          expandedNodeIds: withExpanded(state.expandedNodeIds, nodeId, true),
          openRepo:
            asPlaceKind(place.kind) === "repo"
              ? { ...state.openRepo, [taskId]: place.repoPath }
              : state.openRepo,
        })),
      );
    },

    // The settings are a place of its own, like the history. Opening them takes
    // no prompt editor off the screen, so they go without the guard.
    openSettings: () =>
      set({
        settingsOpen: true,
        openTaskId: null,
        historyOpen: false,
        openArchivedId: null,
        newTaskFor: null,
      }),

    closeSettings: () => leave(() => set({ settingsOpen: false })),

    selectSettingsSection: (section) => leave(() => set({ settingsSection: section })),

    startPromptEdit: (stage, text) => set({ promptEdit: { stage, original: text, text } }),

    setPromptEditText: (text) =>
      set((state) =>
        state.promptEdit === null ? {} : { promptEdit: { ...state.promptEdit, text } },
      ),

    cancelPromptEdit: () => leave(() => {}),

    finishPromptEdit: () => set({ promptEdit: null }),

    confirmLeave: () => {
      const navigate = get().pendingLeave;
      set({ pendingLeave: null, promptEdit: null });
      navigate?.();
    },

    cancelLeave: () => set({ pendingLeave: null }),
  };
});

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

// A selection that no longer names a repository of the task falls back to the
// default.
function openRepoOf(state: AppStore, taskId: string): string {
  const task = findTask(state.app, taskId);
  const selected = state.openRepo[taskId];
  if (selected !== undefined && reposOf(task).some((repo) => repo.repoPath === selected)) {
    return selected;
  }
  return defaultRepoPath(task);
}

/** useOpenRepo is the selected repository tab of a task. */
export function useOpenRepo(taskId: string): string {
  return useAppStore((state) => openRepoOf(state, taskId));
}

// The situation of the place the open task shows: the stage it is in, the step
// that runs, or the repository whose tab is selected.
function onScreenSituation(state: AppStore): Situation | null {
  const task = findTask(state.app, state.openTaskId);
  if (task === null) {
    return null;
  }
  switch (asTaskStage(task.stage)) {
    case "implementation":
      return stepSituation(task, task.currentStep);
    case "pr":
      return repoSituation(task, openRepoOf(state, task.id));
    case "prd":
    case "tech_spec":
    case "plan":
      return stageSituation(task);
  }
}

/** useOnScreenSituationId is the id of the situation on screen, null when there is none. */
export function useOnScreenSituationId(): string | null {
  return useAppStore((state) => onScreenSituation(state)?.id ?? null);
}

/** useFlashing is the situations whose brief highlight is showing, by id. */
export function useFlashing(): ReadonlySet<string> {
  return useAppStore((state) => state.flashing);
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

export interface SettingsUi {
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  promptEdit: PromptEdit | null;
  pendingLeave: (() => void) | null;
}

export function useSettingsUi(): SettingsUi {
  return useAppStore(
    useShallow((state) => ({
      settingsOpen: state.settingsOpen,
      settingsSection: state.settingsSection,
      promptEdit: state.promptEdit,
      pendingLeave: state.pendingLeave,
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
  historyOpen: boolean;
  settingsOpen: boolean;
  flashing: ReadonlySet<string>;
}

export function useTreeUi(): TreeUi {
  return useAppStore(
    useShallow((state) => ({
      selectedNodeId: state.selectedNodeId,
      expandedNodeIds: state.expandedNodeIds,
      openTaskId: state.openTaskId,
      historyOpen: state.historyOpen,
      settingsOpen: state.settingsOpen,
      flashing: state.flashing,
    })),
  );
}
