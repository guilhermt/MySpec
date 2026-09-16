import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { tasksInFilter } from "@/lib/repositories";
import { prSituation, reviewerSituation, stageSituation, stepSituation } from "@/lib/situations";
import type {
  ArchivedTask,
  Leftover,
  Migration,
  Place,
  PromptStage,
  Repository,
  Situation,
  State,
  TaskSummary,
  ThemePreference,
  Transcript,
  TranscriptEvent,
} from "@/lib/wails";
import { asPlaceKind, asTaskStage, asThemePreference, sessionKey } from "@/lib/wails";
import {
  applyEvent,
  emptyTranscript,
  fromTranscript,
  type TranscriptState,
} from "@/store/transcript";

/** SettingsSection is what the settings screen shows: the defaults of a new task, the repositories or one prompt. */
export type SettingsSection = "defaults" | "repositories" | PromptStage;

/** StepTab is the conversation of a step on screen: the agent that implements it, or the one that reviews it. */
export type StepTab = "implementer" | "reviewer";

/** stepTabKey identifies the tabs of one step: a task and the number of the step. */
export function stepTabKey(taskId: string, step: number): string {
  return `${taskId}|${step}`;
}

/** PromptEdit is a prompt open in the editor: the text it opened with and the text it has now. */
export interface PromptEdit {
  stage: PromptStage;
  original: string;
  text: string;
}

export interface AppStore {
  app: State | null;
  error: string | null;
  openTaskId: string | null;
  /** transcripts and drafts are keyed by sessionKey: a task has one per stage. */
  transcripts: Record<string, TranscriptState>;
  drafts: Record<string, string>;
  /** openStepTab is the conversation tab of a step, by stepTabKey. */
  openStepTab: Record<string, StepTab>;
  /** prDrafts is the pull request the user is editing, by task id. */
  prDrafts: Record<string, PrDraft>;
  /** newTaskOpen is the creation dialog being open. */
  newTaskOpen: boolean;
  /**
   * lastRepositoryId is the repository of the last task created in this run of
   * the app, which preselects the dialog when nothing before it does.
   */
  lastRepositoryId: string | null;
  /** historyOpen shows the archived tasks in the main area instead of a node. */
  historyOpen: boolean;
  /** openArchivedId is the archived task on screen, when one is. */
  openArchivedId: string | null;
  historyQuery: string;
  /** archivedNotice names the task that was just archived, until dismissed. */
  archivedNotice: ArchivedNotice | null;
  /** leftover is what the last deletion could not remove from disk, until dismissed. */
  leftover: Leftover | null;
  /**
   * flashing are the situations that just started while the user was looking,
   * by id, for the brief highlight.
   */
  flashing: ReadonlySet<string>;
  /** settingsOpen shows the settings in the main area. */
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  /** promptEdit is the prompt open in the editor, null when the editor is closed. */
  promptEdit: PromptEdit | null;
  /** pendingLeave is the navigation that waits for the user to discard the unsaved edit of a prompt. */
  pendingLeave: (() => void) | null;

  applyState: (next: State) => void;
  setError: (message: string | null) => void;

  openTask: (id: string) => void;
  closeTask: () => void;
  openNewTask: () => void;
  closeNewTask: () => void;
  /** rememberRepository keeps the repository a task was just created in. */
  rememberRepository: (id: string) => void;
  beginTranscript: (taskId: string, stage: string) => void;
  setTranscript: (transcript: Transcript) => void;
  applyTranscriptEvent: (event: TranscriptEvent) => void;
  dropTranscript: (taskId: string, stage: string) => void;
  setDraft: (taskId: string, stage: string, text: string) => void;
  selectStepTab: (taskId: string, step: number, tab: StepTab) => void;
  setPrDraft: (taskId: string, draft: PrDraft) => void;
  clearPrDraft: (taskId: string) => void;

  openHistory: () => void;
  closeHistory: () => void;
  openArchived: (id: string) => void;
  closeArchived: () => void;
  setHistoryQuery: (query: string) => void;
  dismissArchivedNotice: () => void;
  setLeftover: (leftover: Leftover | null) => void;

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

/** ArchivedNotice is the task that was just archived, as the notice names it. */
export interface ArchivedNotice {
  id: string;
  name: string;
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

// The tab a situation of a step asks for; any other place leaves the tabs alone.
function withStepTab(
  current: Record<string, StepTab>,
  taskId: string,
  place: Place,
): Record<string, StepTab> {
  switch (asPlaceKind(place.kind)) {
    case "step":
      return { ...current, [stepTabKey(taskId, place.step)]: "implementer" };
    case "step_review":
      return { ...current, [stepTabKey(taskId, place.step)]: "reviewer" };
    case "stage":
    case "pr":
      return current;
  }
}

// What the app shows of the tasks, as it stands with none of them on screen.
function initialTaskUi(): Pick<
  AppStore,
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
> {
  return {
    openTaskId: null,
    transcripts: {},
    drafts: {},
    openStepTab: {},
    prDrafts: {},
    newTaskOpen: false,
    lastRepositoryId: null,
    historyOpen: false,
    openArchivedId: null,
    historyQuery: "",
    archivedNotice: null,
    leftover: null,
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
    settingsSection: "defaults",
    promptEdit: null,
    pendingLeave: null,
    ...initialTaskUi(),

    applyState: (next) =>
      set((state) => {
        // With no repository registered the welcome screen takes the place of
        // everything the app shows of the tasks.
        if ((next.repositories ?? []).length === 0) {
          return {
            app: next,
            ...initialTaskUi(),
            settingsOpen: false,
            settingsSection: "defaults",
            promptEdit: null,
            pendingLeave: null,
          };
        }
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
        // A repository that is gone stops preselecting the creation dialog.
        const lastRepositoryId =
          state.lastRepositoryId !== null &&
          !(next.repositories ?? []).some((repository) => repository.id === state.lastRepositoryId)
            ? null
            : state.lastRepositoryId;
        const openTaskId = state.openTaskId;
        if (openTaskId === null || findTask(next, openTaskId) !== null) {
          return { app: next, archivedNotice, openArchivedId, lastRepositoryId };
        }
        return {
          app: next,
          archivedNotice,
          openArchivedId,
          lastRepositoryId,
          openTaskId: null,
          transcripts: withoutTaskTranscripts(state.transcripts, openTaskId),
        };
      }),

    setError: (message) => set({ error: message }),

    openTask: (id) =>
      leave(() =>
        set({ openTaskId: id, historyOpen: false, openArchivedId: null, settingsOpen: false }),
      ),

    closeTask: () => set({ openTaskId: null }),

    openNewTask: () => set({ newTaskOpen: true }),

    closeNewTask: () => set({ newTaskOpen: false }),

    rememberRepository: (id) => set({ lastRepositoryId: id }),

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

    selectStepTab: (taskId, step, tab) =>
      set((state) => ({ openStepTab: { ...state.openStepTab, [stepTabKey(taskId, step)]: tab } })),

    // The draft the user is editing outlives what the agent says next; only
    // opening the pull request, or throwing the draft away, clears it.
    setPrDraft: (taskId, draft) =>
      set((state) => ({ prDrafts: { ...state.prDrafts, [taskId]: draft } })),

    clearPrDraft: (taskId) =>
      set((state) => {
        const { [taskId]: _dropped, ...rest } = state.prDrafts;
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
          newTaskOpen: false,
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

    setLeftover: (leftover) => set({ leftover }),

    // A new set every time: the selectors hand the set itself to the components,
    // which only see a change through a new reference.
    flashSituation: (id) => set((state) => ({ flashing: new Set(state.flashing).add(id) })),

    unflashSituation: (id) =>
      set((state) => {
        const flashing = new Set(state.flashing);
        flashing.delete(id);
        return { flashing };
      }),

    // A situation opens where it is: its task, and the tab of the conversation
    // of a step when it is in a step: the situation of a reviewer opens on its
    // tab. Going there puts away the history, the settings and the creation of
    // a task.
    openPlace: (taskId, place) => {
      // A situation of a task that is gone navigates nowhere, so it never asks
      // the user about an unsaved edit either.
      if (findTask(get().app, taskId) === null) {
        return;
      }
      leave(() =>
        set((state) => ({
          openTaskId: taskId,
          historyOpen: false,
          openArchivedId: null,
          newTaskOpen: false,
          settingsOpen: false,
          openStepTab: withStepTab(state.openStepTab, taskId, place),
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
        newTaskOpen: false,
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

const NO_TASKS: readonly TaskSummary[] = [];
const NO_HISTORY: readonly ArchivedTask[] = [];
const NO_REPOSITORIES: readonly Repository[] = [];

/** useRepositories is every registered repository, by owner/name. */
export function useRepositories(): readonly Repository[] {
  return useAppStore((state) => state.app?.repositories ?? NO_REPOSITORIES);
}

/** useRepositoryFilter is the repository the task list and the history show; "" is all of them. */
export function useRepositoryFilter(): string {
  return useAppStore((state) => state.app?.repositoryFilter ?? "");
}

/** useRepository is a registered repository by id, null when none is. */
export function useRepository(id: string): Repository | null {
  return useAppStore(
    (state) => (state.app?.repositories ?? []).find((repository) => repository.id === id) ?? null,
  );
}

/** useMigration is the refused migration of the data, null when there is none. */
export function useMigration(): Migration | null {
  return useAppStore((state) => state.app?.migration ?? null);
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

/** useFilteredTasks are the active tasks the sidebar list shows, under the filter. */
export function useFilteredTasks(): readonly TaskSummary[] {
  return useAppStore(
    useShallow((state) => tasksInFilter(tasksOf(state.app), state.app?.repositoryFilter ?? "")),
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

// A tab that no longer has a conversation behind it falls back to the implementer.
function openStepTabOf(state: AppStore, taskId: string): StepTab {
  const task = findTask(state.app, taskId);
  const step = (task?.steps ?? []).find((candidate) => candidate.number === task?.currentStep);
  if (step === undefined || step.reviewer === null) {
    return "implementer";
  }
  return state.openStepTab[stepTabKey(taskId, step.number)] ?? "implementer";
}

/** useOpenStepTab is the conversation tab of the current step of a task. */
export function useOpenStepTab(taskId: string): StepTab {
  return useAppStore((state) => openStepTabOf(state, taskId));
}

// The situation of the place the open task shows: the stage it is in, the
// conversation of the step that runs whose tab is selected, or the pull
// request.
function onScreenSituation(state: AppStore): Situation | null {
  const task = findTask(state.app, state.openTaskId);
  if (task === null) {
    return null;
  }
  switch (asTaskStage(task.stage)) {
    case "implementation":
      return openStepTabOf(state, task.id) === "reviewer"
        ? reviewerSituation(task, task.currentStep)
        : stepSituation(task, task.currentStep);
    case "pr":
      return prSituation(task);
    case "prd":
    case "tech_spec":
    case "plan":
    case "one_shot":
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

export function usePrDraft(taskId: string): PrDraft | null {
  return useAppStore((state) => state.prDrafts[taskId] ?? null);
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

export function useLeftover(): Leftover | null {
  return useAppStore((state) => state.leftover);
}

/** filterHistory keeps the archived tasks of the filter whose name carries what was typed. */
export function filterHistory(
  history: readonly ArchivedTask[],
  query: string,
  filter: string,
): readonly ArchivedTask[] {
  const shown = tasksInFilter(history, filter);
  const term = query.trim().toLowerCase();
  if (term === "") {
    return shown;
  }
  return shown.filter((entry) => entry.name.toLowerCase().includes(term));
}
