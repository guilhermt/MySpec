import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { findBoard } from "@/lib/boards";
import {
  prSituation,
  reviewerSituation,
  reviewSituation,
  stageSituation,
  stepSituation,
} from "@/lib/situations";
import { readStored, SIDEBAR_COLLAPSED_KEY, writeStored } from "@/lib/ui-storage";
import type {
  ArchivedReview,
  ArchivedTask,
  Board,
  Leftover,
  Migration,
  Place,
  PromptStage,
  Repository,
  ReviewCenter,
  ReviewSummary,
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

/** SettingsSection is what the settings screen shows: the defaults of a new task, the boards, the repositories or one prompt. */
export type SettingsSection = "defaults" | "boards" | "repositories" | PromptStage;

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

/** CardRef names a card of a board: the board and the key of its issue. */
export interface CardRef {
  boardId: string;
  key: string;
}

/** PendingStart is a card whose Start task waits for the clone of its repository. */
export interface PendingStart extends CardRef {
  repositoryId: string;
}

/** FindingDraft is a text of a review the user is editing, and the report it was typed against. */
export interface FindingDraft {
  text: string;
  /** revision is the report of the pass the text was typed on; another one makes the draft stale. */
  revision: number;
}

/** PullRef names one pull request: the repository it belongs to and its number. */
export interface PullRef {
  repositoryId: string;
  number: number;
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
  /** newTaskCard is the card the creation dialog opens for; null for a task without one. */
  newTaskCard: CardRef | null;
  /** pendingStart is a card waiting for its clone to open the creation dialog. */
  pendingStart: PendingStart | null;
  /** openBoardId is the board view on screen, when one is. */
  openBoardId: string | null;
  /** reviewsOpen shows the open pull requests of the registered repositories in the main area. */
  reviewsOpen: boolean;
  /** openReviewId is the review on screen, when one is. */
  openReviewId: string | null;
  /** openArchivedReviewId is the archived review on screen, when one is. */
  openArchivedReviewId: string | null;
  /** startReview is the pull request the dialog that starts a review opens for. */
  startReview: PullRef | null;
  /** pendingReview is a pull request waiting for the clone of its repository to open the dialog. */
  pendingReview: PullRef | null;
  /**
   * findingDrafts are the texts of a review the user is editing, by
   * `${reviewId}|${pass}|${number}` and `${reviewId}|${pass}|summary`.
   */
  findingDrafts: Record<string, FindingDraft>;
  /** sidebarCollapsed are the ids of the sidebar nodes the user collapsed; kept across runs. */
  sidebarCollapsed: ReadonlySet<string>;
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
  /** openNewTask opens the creation dialog, for a card when one is given. */
  openNewTask: (card?: CardRef) => void;
  closeNewTask: () => void;
  setPendingStart: (pending: PendingStart | null) => void;
  openBoard: (id: string) => void;
  openReviews: () => void;
  openReview: (id: string) => void;
  /** closeReview goes back to the Reviews view, where the review was opened from. */
  closeReview: () => void;
  openArchivedReview: (id: string) => void;
  closeArchivedReview: () => void;
  /** openStartReview opens the dialog that starts a review of a pull request. */
  openStartReview: (pull: PullRef) => void;
  closeStartReview: () => void;
  setPendingReview: (pending: PullRef | null) => void;
  setFindingDraft: (key: string, draft: FindingDraft) => void;
  clearFindingDraft: (key: string) => void;
  toggleSidebarNode: (id: string) => void;
  /** expandSidebarNodes opens the given nodes of the sidebar, leaving the others as they are. */
  expandSidebarNodes: (ids: readonly string[]) => void;
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

function reviewsOf(state: State | null): readonly ReviewSummary[] {
  return state?.reviews ?? NO_REVIEWS;
}

function findReview(state: State | null, id: string | null): ReviewSummary | null {
  return reviewsOf(state).find((review) => review.id === id) ?? null;
}

function reviewHistoryOf(state: State | null): readonly ArchivedReview[] {
  return state?.reviewHistory ?? NO_REVIEW_HISTORY;
}

function findArchivedReview(state: State | null, id: string | null): ArchivedReview | null {
  return reviewHistoryOf(state).find((review) => review.id === id) ?? null;
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
    case "review":
    case "discussion":
      return current;
  }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// A new set every time the collapsed nodes change, kept for the next run.
function storeCollapsed(collapsed: Set<string>): Set<string> {
  writeStored(SIDEBAR_COLLAPSED_KEY, [...collapsed]);
  return collapsed;
}

// The review places every other navigation leaves behind.
const NO_REVIEW_PLACE = {
  reviewsOpen: false,
  openReviewId: null,
  openArchivedReviewId: null,
} as const;

// What the app shows of the tasks, as it stands with none of them on screen.
function initialTaskUi(): Pick<
  AppStore,
  | "openTaskId"
  | "transcripts"
  | "drafts"
  | "openStepTab"
  | "prDrafts"
  | "newTaskOpen"
  | "newTaskCard"
  | "pendingStart"
  | "openBoardId"
  | "reviewsOpen"
  | "openReviewId"
  | "openArchivedReviewId"
  | "startReview"
  | "pendingReview"
  | "findingDrafts"
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
    newTaskCard: null,
    pendingStart: null,
    openBoardId: null,
    reviewsOpen: false,
    openReviewId: null,
    openArchivedReviewId: null,
    startReview: null,
    pendingReview: null,
    findingDrafts: {},
    lastRepositoryId: null,
    historyOpen: false,
    openArchivedId: null,
    historyQuery: "",
    archivedNotice: null,
    leftover: null,
    flashing: new Set<string>(),
  };
}

/** ReviewPlace is where the two review screens stand in a new snapshot. */
interface ReviewPlace {
  openReviewId: string | null;
  openArchivedReviewId: string | null;
  historyOpen: boolean;
}

// A review on screen stays while it is active; an entity that is gone takes its
// screen with it.
function reviewPlace(state: AppStore, next: State): ReviewPlace {
  const archived = findArchivedReview(next, state.openArchivedReviewId)?.id ?? null;
  const open = state.openReviewId;
  if (open === null || findReview(next, open) !== null) {
    return {
      openReviewId: open,
      openArchivedReviewId: archived,
      historyOpen: state.historyOpen,
    };
  }
  // A review whose pull request was merged or closed leaves the screen of an
  // active review for the archived one, inside the history, where every other
  // way of opening an archived entity leaves the user.
  const moved = findArchivedReview(next, open)?.id ?? null;
  return {
    openReviewId: null,
    openArchivedReviewId: moved,
    historyOpen: moved !== null || state.historyOpen,
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
    sidebarCollapsed: new Set(readStored(SIDEBAR_COLLAPSED_KEY, [], isStringList)),
    ...initialTaskUi(),

    applyState: (next) =>
      set((state) => {
        // With no repository and no board registered the welcome screen takes
        // the place of everything the app shows of the tasks.
        if ((next.repositories ?? []).length === 0 && (next.boards ?? []).length === 0) {
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
        // A board that is gone takes its view off the screen.
        const openBoardId =
          state.openBoardId !== null && findBoard(next, state.openBoardId) === null
            ? null
            : state.openBoardId;
        const place = reviewPlace(state, next);
        const common = {
          app: next,
          archivedNotice,
          openArchivedId,
          lastRepositoryId,
          openBoardId,
          ...place,
        };
        // A review that is gone takes its conversation with it, like a task.
        const transcripts =
          state.openReviewId !== null && place.openReviewId === null
            ? withoutTaskTranscripts(state.transcripts, state.openReviewId)
            : state.transcripts;
        const openTaskId = state.openTaskId;
        if (openTaskId === null || findTask(next, openTaskId) !== null) {
          return { ...common, transcripts };
        }
        return {
          ...common,
          openTaskId: null,
          transcripts: withoutTaskTranscripts(transcripts, openTaskId),
        };
      }),

    setError: (message) => set({ error: message }),

    openTask: (id) =>
      leave(() =>
        set({
          openTaskId: id,
          historyOpen: false,
          openArchivedId: null,
          settingsOpen: false,
          openBoardId: null,
          ...NO_REVIEW_PLACE,
        }),
      ),

    closeTask: () => set({ openTaskId: null, ...NO_REVIEW_PLACE }),

    openNewTask: (card) => set({ newTaskOpen: true, newTaskCard: card ?? null }),

    closeNewTask: () => set({ newTaskOpen: false, newTaskCard: null }),

    setPendingStart: (pending) => set({ pendingStart: pending }),

    // A board view is a place of its own, like the history.
    openBoard: (id) =>
      leave(() =>
        set({
          openBoardId: id,
          openTaskId: null,
          openArchivedId: null,
          historyOpen: false,
          settingsOpen: false,
          ...NO_REVIEW_PLACE,
        }),
      ),

    // The Reviews view is a place of its own, like the history.
    openReviews: () =>
      leave(() =>
        set({
          reviewsOpen: true,
          openReviewId: null,
          openArchivedReviewId: null,
          openTaskId: null,
          openArchivedId: null,
          historyOpen: false,
          settingsOpen: false,
          openBoardId: null,
        }),
      ),

    openReview: (id) =>
      leave(() =>
        set({
          openReviewId: id,
          reviewsOpen: false,
          openArchivedReviewId: null,
          openTaskId: null,
          openArchivedId: null,
          historyOpen: false,
          settingsOpen: false,
          openBoardId: null,
        }),
      ),

    closeReview: () => set({ openReviewId: null, reviewsOpen: true }),

    openArchivedReview: (id) =>
      leave(() =>
        set({
          openArchivedReviewId: id,
          historyOpen: true,
          openReviewId: null,
          reviewsOpen: false,
          openTaskId: null,
          openArchivedId: null,
          settingsOpen: false,
          openBoardId: null,
        }),
      ),

    closeArchivedReview: () => set({ openArchivedReviewId: null }),

    openStartReview: (pull) => set({ startReview: pull }),

    closeStartReview: () => set({ startReview: null }),

    setPendingReview: (pending) => set({ pendingReview: pending }),

    setFindingDraft: (key, draft) =>
      set((state) => ({ findingDrafts: { ...state.findingDrafts, [key]: draft } })),

    clearFindingDraft: (key) =>
      set((state) => {
        const { [key]: _dropped, ...rest } = state.findingDrafts;
        return { findingDrafts: rest };
      }),

    toggleSidebarNode: (id) =>
      set((state) => {
        const collapsed = new Set(state.sidebarCollapsed);
        if (!collapsed.delete(id)) {
          collapsed.add(id);
        }
        return { sidebarCollapsed: storeCollapsed(collapsed) };
      }),

    expandSidebarNodes: (ids) =>
      set((state) => {
        if (!ids.some((id) => state.sidebarCollapsed.has(id))) {
          return {};
        }
        const collapsed = new Set(state.sidebarCollapsed);
        for (const id of ids) {
          collapsed.delete(id);
        }
        return { sidebarCollapsed: storeCollapsed(collapsed) };
      }),

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
          openBoardId: null,
          ...NO_REVIEW_PLACE,
        }),
      ),

    closeHistory: () => set({ historyOpen: false, openArchivedId: null }),

    openArchived: (id) =>
      leave(() =>
        set({
          openArchivedId: id,
          historyOpen: true,
          openTaskId: null,
          settingsOpen: false,
          openBoardId: null,
          ...NO_REVIEW_PLACE,
        }),
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

    // A situation opens where it is: its review, or its task and the tab of the
    // conversation of a step when it is in a step: the situation of a reviewer
    // opens on its tab. Going there puts away the history, the settings and the
    // creation of a task.
    openPlace: (taskId, place) => {
      const store = get();
      if (asPlaceKind(place.kind) === "review") {
        if (findReview(store.app, taskId) !== null) {
          store.openReview(taskId);
        }
        return;
      }
      // A situation of a task that is gone navigates nowhere, so it never asks
      // the user about an unsaved edit either.
      if (findTask(store.app, taskId) === null) {
        return;
      }
      leave(() =>
        set((state) => ({
          openTaskId: taskId,
          historyOpen: false,
          openArchivedId: null,
          newTaskOpen: false,
          settingsOpen: false,
          openBoardId: null,
          ...NO_REVIEW_PLACE,
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
        openBoardId: null,
        ...NO_REVIEW_PLACE,
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
const NO_REVIEWS: readonly ReviewSummary[] = [];
// The Reviews view before the first snapshot: a reading that found nothing and
// filters that hide nothing.
const NO_REVIEW_CENTER: ReviewCenter = {
  pullRequests: [],
  failures: [],
  readAt: "",
  reading: false,
  filters: {
    boardId: "",
    repositoryId: "",
    authorsInclude: [],
    authorsExclude: [],
    labelsInclude: [],
    labelsExclude: [],
    pendingOnly: false,
  },
  pendingCount: 0,
  authors: [],
  labels: [],
};
const NO_REVIEW_HISTORY: readonly ArchivedReview[] = [];
const NO_REPOSITORIES: readonly Repository[] = [];
const NO_BOARDS: readonly Board[] = [];

/** useBoards is every registered board, by title. */
export function useBoards(): readonly Board[] {
  return useAppStore((state) => state.app?.boards ?? NO_BOARDS);
}

/** useBoard is a registered board by id, null when none is. */
export function useBoard(id: string): Board | null {
  return useAppStore((state) => findBoard(state.app, id));
}

/** useOpenBoardId is the board whose view is on screen, null when none is. */
export function useOpenBoardId(): string | null {
  return useAppStore((state) => state.openBoardId);
}

/** useSidebarCollapsed is the ids of the sidebar nodes the user collapsed. */
export function useSidebarCollapsed(): ReadonlySet<string> {
  return useAppStore((state) => state.sidebarCollapsed);
}

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

// The situation of the place on screen: the one of the open review, or, of the
// open task, the stage it is in, the conversation of the step that runs whose
// tab is selected, or the pull request.
function onScreenSituation(state: AppStore): Situation | null {
  const review = findReview(state.app, state.openReviewId);
  if (review !== null) {
    return reviewSituation(review);
  }
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

/** useReviewCenter is the Reviews view: the pull requests of the last reading and the filters. */
export function useReviewCenter(): ReviewCenter {
  return useAppStore((state) => state.app?.reviewCenter ?? NO_REVIEW_CENTER);
}

/** useReviews is every active review, in the order they were started. */
export function useReviews(): readonly ReviewSummary[] {
  return useAppStore((state) => reviewsOf(state.app));
}

/** useReview is an active review by id, null when none is. */
export function useReview(id: string | null): ReviewSummary | null {
  return useAppStore((state) => findReview(state.app, id));
}

/** useOpenReviewId is the review whose screen is open, null when none is. */
export function useOpenReviewId(): string | null {
  return useAppStore((state) => state.openReviewId);
}

/** useReviewsOpen is the Reviews view being the main area. */
export function useReviewsOpen(): boolean {
  return useAppStore((state) => state.reviewsOpen);
}

/** useReviewHistory is every archived review, the most recent first. */
export function useReviewHistory(): readonly ArchivedReview[] {
  return useAppStore((state) => reviewHistoryOf(state.app));
}

/** useArchivedReview is an archived review by id, null when none is. */
export function useArchivedReview(id: string | null): ArchivedReview | null {
  return useAppStore((state) => findArchivedReview(state.app, id));
}

/** useStartReview is the pull request the dialog that starts a review is open for. */
export function useStartReview(): PullRef | null {
  return useAppStore((state) => state.startReview);
}

/**
 * useFindingDraft is the text the user is editing and the report it was typed
 * against, null when they are editing none.
 */
export function useFindingDraft(key: string): FindingDraft | null {
  return useAppStore((state) => state.findingDrafts[key] ?? null);
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
