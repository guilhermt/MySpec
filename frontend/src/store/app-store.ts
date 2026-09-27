import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { findBoard } from "@/lib/boards";
import {
  HOME,
  isActiveItem,
  isLocation,
  isLocationList,
  type Location,
  locationExists,
  NAV_LIMIT,
  openItemId,
  resolveHome,
  type SettingsSection,
  sameLocation,
} from "@/lib/locations";
import {
  discussionSituation,
  prSituation,
  reviewerSituation,
  reviewSituation,
  stageSituation,
  stepSituation,
} from "@/lib/situations";
import {
  LAST_ITEM_KEY,
  NAV_STACK_KEY,
  readStored,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_RAIL_KEY,
  writeStored,
} from "@/lib/ui-storage";
import type {
  ArchivedDiscussion,
  ArchivedReview,
  ArchivedTask,
  Board,
  DiscussionSummary,
  Leftover,
  Migration,
  ModelCatalog,
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

export type { SettingsSection } from "@/lib/locations";

/** PanelId is an auxiliary panel of an item: its artifacts, its reports or its documents. */
export type PanelId = "artifacts" | "reports" | "documents";

/** Toast is the notice of an item that left without being open; its id is the id of the task. */
export interface Toast {
  id: string;
  taskId: string;
  name: string;
}

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

/**
 * TextDraft is a text of a review or of a draft of a discussion the user is
 * editing, and the revision it was typed against.
 */
export interface TextDraft {
  text: string;
  /** revision is the revision of the text the draft was typed on; another one makes the draft stale. */
  revision: number;
}

/** NewDiscussionRef is what the dialog that creates a discussion opens for: a board and the cards picked on it. */
export interface NewDiscussionRef {
  boardId: string;
  cardKeys: string[];
}

/** PullRef names one pull request: the repository it belongs to and its number. */
export interface PullRef {
  repositoryId: string;
  number: number;
}

export interface AppStore {
  app: State | null;
  error: string | null;
  /** location is the place on screen. */
  location: Location;
  /** back are the places behind the current one, the most recent last; forward the ones ahead, the nearest last. */
  back: Location[];
  forward: Location[];
  /** panel is the auxiliary panel open in the place on screen, null when none is; every navigation closes it. */
  panel: PanelId | null;
  /** pendingFocus is where the focus goes once the new place is on screen: its title, or the back or forward button. */
  pendingFocus: "title" | "back" | "forward" | null;
  /** sidebarRail is the sidebar collapsed into its strip; kept across runs. */
  sidebarRail: boolean;
  /** toasts are the notices of items that left without being open, the oldest first, three at most. */
  toasts: Toast[];
  /** announcement is the text the live region says now; id changes with every announcement, so the same text is said again. */
  announcement: { id: number; text: string } | null;
  /** expectGone is the item the user just asked to remove, whose page is not announced. */
  expectGone: string | null;
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
  /** startReview is the pull request the dialog that starts a review opens for. */
  startReview: PullRef | null;
  /** pendingReview is a pull request waiting for the clone of its repository to open the dialog. */
  pendingReview: PullRef | null;
  /** newDiscussion is what the dialog that creates a discussion is open for, null when it is closed. */
  newDiscussion: NewDiscussionRef | null;
  /**
   * textDrafts are the texts the user is editing, by
   * `${reviewId}|${pass}|${number}` and `${reviewId}|${pass}|summary` for a
   * review, and `${discussionId}|${draftId}|title` and `|body` for a draft of
   * a discussion.
   */
  textDrafts: Record<string, TextDraft>;
  /** sidebarCollapsed are the ids of the sidebar nodes the user collapsed; kept across runs. */
  sidebarCollapsed: ReadonlySet<string>;
  /**
   * lastRepositoryId is the repository of the last task created in this run of
   * the app, which preselects the dialog when nothing before it does.
   */
  lastRepositoryId: string | null;
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
  /** promptEdit is the prompt open in the editor, null when the editor is closed. */
  promptEdit: PromptEdit | null;
  /** pendingLeave is the navigation that waits for the user to discard the unsaved edit of a prompt. */
  pendingLeave: (() => void) | null;

  applyState: (next: State) => void;
  setError: (message: string | null) => void;

  /** go opens a place: the current one goes behind it and whatever was ahead is dropped. */
  go: (location: Location, options?: { focus?: "title" | "back" | "forward" }) => void;
  /** goBack opens the nearest place behind the current one that still exists; with none, nothing happens. */
  goBack: (options?: { focus?: "title" | "back" }) => void;
  /** goForward opens the nearest place ahead of the current one that still exists; with none, nothing happens. */
  goForward: (options?: { focus?: "title" | "forward" }) => void;
  clearPendingFocus: () => void;
  toggleSidebarRail: () => void;
  /** announce has the live region say a text, even the same one again. */
  announce: (text: string) => void;
  openTask: (id: string) => void;
  /** openNewTask opens the creation dialog, for a card when one is given. */
  openNewTask: (card?: CardRef) => void;
  closeNewTask: () => void;
  setPendingStart: (pending: PendingStart | null) => void;
  openBoard: (id: string) => void;
  openReviews: () => void;
  openReview: (id: string) => void;
  openArchivedReview: (id: string) => void;
  closeArchivedReview: () => void;
  /** openStartReview opens the dialog that starts a review of a pull request. */
  openStartReview: (pull: PullRef) => void;
  closeStartReview: () => void;
  setPendingReview: (pending: PullRef | null) => void;
  openDiscussion: (id: string) => void;
  openArchivedDiscussion: (id: string) => void;
  closeArchivedDiscussion: () => void;
  /** openNewDiscussion opens the dialog that creates a discussion of a board. */
  openNewDiscussion: (ref: NewDiscussionRef) => void;
  closeNewDiscussion: () => void;
  setTextDraft: (key: string, draft: TextDraft) => void;
  clearTextDraft: (key: string) => void;
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
  openArchived: (id: string) => void;
  closeArchived: () => void;
  setHistoryQuery: (query: string) => void;
  dismissArchivedNotice: () => void;
  setLeftover: (leftover: Leftover | null) => void;

  flashSituation: (id: string) => void;
  unflashSituation: (id: string) => void;
  /** openSituation opens an item where one of its situations is. */
  openSituation: (itemId: string, place: Place) => void;

  openSettings: (section?: SettingsSection) => void;
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

function discussionsOf(state: State | null): readonly DiscussionSummary[] {
  return state?.discussions ?? NO_DISCUSSIONS;
}

function findDiscussion(state: State | null, id: string | null): DiscussionSummary | null {
  return discussionsOf(state).find((discussion) => discussion.id === id) ?? null;
}

function discussionHistoryOf(state: State | null): readonly ArchivedDiscussion[] {
  return state?.discussionHistory ?? NO_DISCUSSION_HISTORY;
}

function findArchivedDiscussion(state: State | null, id: string | null): ArchivedDiscussion | null {
  return discussionHistoryOf(state).find((discussion) => discussion.id === id) ?? null;
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

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** SavedNav is the history of places as it is kept between runs. */
interface SavedNav {
  back: Location[];
  current: Location;
}

function isSavedNav(value: unknown): value is SavedNav {
  return (
    typeof value === "object" &&
    value !== null &&
    "back" in value &&
    "current" in value &&
    isLocationList(value.back) &&
    isLocation(value.current)
  );
}

/** initialNav is the history of places the app opens with: Home, with the places of the last run behind it. */
export function initialNav(): Pick<AppStore, "location" | "back" | "forward"> {
  const saved = readStored<SavedNav>(NAV_STACK_KEY, { back: [], current: HOME }, isSavedNav);
  const back = saved.current.kind === "home" ? saved.back : [...saved.back, saved.current];
  return { location: HOME, back: back.slice(-NAV_LIMIT), forward: [] };
}

function isActiveItemLocation(value: unknown): value is Location {
  return isLocation(value) && isActiveItem(value);
}

/** readLastItem is the last active item opened, kept between runs; null when there is none. */
export function readLastItem(): Location | null {
  return readStored<Location | null>(LAST_ITEM_KEY, null, isActiveItemLocation);
}

// persistNav keeps the history of places for the next run, without the pages
// of items that left, which are never revisited, and the last active item
// opened.
function persistNav(state: Pick<AppStore, "location" | "back">): void {
  const current = state.location.kind === "gone" ? HOME : state.location;
  const saved: SavedNav = {
    back: state.back.filter((place) => place.kind !== "gone"),
    current,
  };
  writeStored(NAV_STACK_KEY, saved);
  if (isActiveItem(state.location)) {
    writeStored(LAST_ITEM_KEY, state.location);
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

// What the app shows of the tasks, as it stands with none of them on screen.
function initialTaskUi(): Pick<
  AppStore,
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
  | "lastRepositoryId"
  | "historyQuery"
  | "archivedNotice"
  | "leftover"
  | "flashing"
> {
  return {
    transcripts: {},
    drafts: {},
    openStepTab: {},
    prDrafts: {},
    newTaskOpen: false,
    newTaskCard: null,
    pendingStart: null,
    startReview: null,
    pendingReview: null,
    newDiscussion: null,
    textDrafts: {},
    lastRepositoryId: null,
    historyQuery: "",
    archivedNotice: null,
    leftover: null,
    flashing: new Set<string>(),
  };
}

/** Navigation is the part of the store a navigation changes. */
type Navigation = Pick<
  AppStore,
  "location" | "back" | "forward" | "panel" | "pendingFocus" | "promptEdit"
>;

// navigate opens a place. The same place only takes the new one (a page of
// Settings changes without stacking); another pushes the current one behind it,
// unless it is the page of an item that left, which is never revisited, and
// drops whatever was ahead.
function navigate(
  state: AppStore,
  location: Location,
  focus: AppStore["pendingFocus"],
): Navigation {
  const target = resolveHome(state.app, location);
  const common = { location: target, panel: null, pendingFocus: focus, promptEdit: null };
  if (sameLocation(state.location, target)) {
    return { ...common, back: state.back, forward: state.forward };
  }
  const back =
    state.location.kind === "gone" ? state.back : [...state.back, state.location].slice(-NAV_LIMIT);
  return { ...common, back, forward: [] };
}

// travel opens the nearest place behind (or ahead of) the current one that
// still exists, dropping the ones that no longer do; the current one goes to
// the other side, unless it is the page of an item that left. Null when there
// is nowhere to go.
function travel(
  state: AppStore,
  direction: "back" | "forward",
  focus: AppStore["pendingFocus"],
): Navigation | null {
  const from = direction === "back" ? state.back : state.forward;
  const to = direction === "back" ? state.forward : state.back;
  const index = from.reduce(
    (found, place, at) => (locationExists(state.app, place) ? at : found),
    -1,
  );
  const place = from[index];
  if (place === undefined) {
    return null;
  }
  const rest = from.slice(0, index);
  const behind = state.location.kind === "gone" ? to : [...to, state.location].slice(-NAV_LIMIT);
  return {
    location: resolveHome(state.app, place),
    back: direction === "back" ? rest : behind,
    forward: direction === "back" ? behind : rest,
    panel: null,
    pendingFocus: focus,
    promptEdit: null,
  };
}

// Where the place on screen stands in a new snapshot: an archived item that is
// gone leaves for the history; an active item or a board that is gone leaves
// for where it went, or for Home; Home stands for the first board while there
// is no task. An item that was not in the previous snapshot, just created and
// not yet published, has not left.
function placeIn(prev: State | null, next: State, location: Location): Location {
  switch (location.kind) {
    case "archived-task":
      return (next.history ?? []).some((entry) => entry.id === location.id)
        ? location
        : { kind: "history" };
    case "archived-review":
      return findArchivedReview(next, location.id) === null ? { kind: "history" } : location;
    case "archived-discussion":
      return findArchivedDiscussion(next, location.id) === null ? { kind: "history" } : location;
    case "task":
      return findTask(prev, location.id) !== null && findTask(next, location.id) === null
        ? HOME
        : location;
    case "review":
      if (findReview(prev, location.id) === null || findReview(next, location.id) !== null) {
        return location;
      }
      // A review whose pull request was merged or closed goes on as the
      // archived one.
      return findArchivedReview(next, location.id) === null
        ? HOME
        : { kind: "archived-review", id: location.id };
    case "discussion":
      if (
        findDiscussion(prev, location.id) === null ||
        findDiscussion(next, location.id) !== null
      ) {
        return location;
      }
      return findArchivedDiscussion(next, location.id) === null
        ? HOME
        : { kind: "archived-discussion", id: location.id };
    case "board":
      return findBoard(prev, location.id) !== null && findBoard(next, location.id) === null
        ? HOME
        : location;
    case "home":
      return resolveHome(next, location);
    case "reviews":
    case "history":
    case "settings":
    case "gone":
      return location;
  }
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

  const go: AppStore["go"] = (location, options) =>
    leave(() => set((state) => navigate(state, location, options?.focus ?? null)));

  // A step through the history with nowhere to go does nothing, so it never
  // asks the user about an unsaved edit either.
  const step = (direction: "back" | "forward", focus: AppStore["pendingFocus"]): boolean => {
    if (travel(get(), direction, focus) === null) {
      return false;
    }
    leave(() => set((state) => travel(state, direction, focus) ?? {}));
    return true;
  };

  return {
    app: null,
    error: null,
    ...initialNav(),
    panel: null,
    pendingFocus: null,
    sidebarRail: readStored(SIDEBAR_RAIL_KEY, false, isBoolean),
    toasts: [],
    announcement: null,
    expectGone: null,
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
            location: HOME,
            panel: null,
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
        // A repository that is gone stops preselecting the creation dialog.
        const lastRepositoryId =
          state.lastRepositoryId !== null &&
          !(next.repositories ?? []).some((repository) => repository.id === state.lastRepositoryId)
            ? null
            : state.lastRepositoryId;
        const location = placeIn(state.app, next, state.location);
        const moved = location !== state.location;
        // An item that left takes every conversation it had with it.
        const left = moved ? openItemId(state.location) : null;
        return {
          app: next,
          archivedNotice,
          lastRepositoryId,
          location,
          panel: moved ? null : state.panel,
          transcripts:
            left === null ? state.transcripts : withoutTaskTranscripts(state.transcripts, left),
        };
      }),

    setError: (message) => set({ error: message }),

    go,

    goBack: (options) => {
      step("back", options?.focus ?? null);
    },

    goForward: (options) => {
      step("forward", options?.focus ?? null);
    },

    clearPendingFocus: () => set({ pendingFocus: null }),

    toggleSidebarRail: () =>
      set((state) => {
        writeStored(SIDEBAR_RAIL_KEY, !state.sidebarRail);
        return { sidebarRail: !state.sidebarRail };
      }),

    announce: (text) =>
      set((state) => ({ announcement: { id: (state.announcement?.id ?? 0) + 1, text } })),

    openTask: (id) => go({ kind: "task", id }),

    openNewTask: (card) => set({ newTaskOpen: true, newTaskCard: card ?? null }),

    closeNewTask: () => set({ newTaskOpen: false, newTaskCard: null }),

    setPendingStart: (pending) => set({ pendingStart: pending }),

    openBoard: (id) => go({ kind: "board", id }),

    openReviews: () => go({ kind: "reviews" }),

    openReview: (id) => go({ kind: "review", id }),

    openArchivedReview: (id) => go({ kind: "archived-review", id }),

    closeArchivedReview: () => go({ kind: "history" }),

    openStartReview: (pull) => set({ startReview: pull }),

    closeStartReview: () => set({ startReview: null }),

    setPendingReview: (pending) => set({ pendingReview: pending }),

    openDiscussion: (id) => go({ kind: "discussion", id }),

    openArchivedDiscussion: (id) => go({ kind: "archived-discussion", id }),

    closeArchivedDiscussion: () => go({ kind: "history" }),

    openNewDiscussion: (ref) => set({ newDiscussion: ref }),

    closeNewDiscussion: () => set({ newDiscussion: null }),

    setTextDraft: (key, draft) =>
      set((state) => ({ textDrafts: { ...state.textDrafts, [key]: draft } })),

    clearTextDraft: (key) =>
      set((state) => {
        const { [key]: _dropped, ...rest } = state.textDrafts;
        return { textDrafts: rest };
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

    openHistory: () => go({ kind: "history" }),

    openArchived: (id) => go({ kind: "archived-task", id }),

    closeArchived: () => go({ kind: "history" }),

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

    // A situation opens where it is: its review, its discussion, or its task and
    // the tab of the conversation of a step when it is in a step: the situation
    // of a reviewer opens on its tab. A situation of an item that is gone
    // navigates nowhere, so it never asks the user about an unsaved edit either.
    openSituation: (itemId, place) => {
      const { app } = get();
      const location: Location | null =
        findTask(app, itemId) !== null
          ? { kind: "task", id: itemId }
          : findReview(app, itemId) !== null
            ? { kind: "review", id: itemId }
            : findDiscussion(app, itemId) !== null
              ? { kind: "discussion", id: itemId }
              : null;
      if (location === null) {
        return;
      }
      leave(() =>
        set((state) => ({
          ...navigate(state, location, "title"),
          openStepTab:
            location.kind === "task"
              ? withStepTab(state.openStepTab, itemId, place)
              : state.openStepTab,
        })),
      );
    },

    openSettings: (section) => go({ kind: "settings", section: section ?? "defaults" }),

    // Settings close back to the place before them, skipping the ones that no
    // longer exist; with none, to Home.
    closeSettings: () => {
      if (!step("back", "title")) {
        go(HOME, { focus: "title" });
      }
    },

    selectSettingsSection: (section) => go({ kind: "settings", section }),

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
const NO_DISCUSSIONS: readonly DiscussionSummary[] = [];
const NO_DISCUSSION_HISTORY: readonly ArchivedDiscussion[] = [];
const NO_REPOSITORIES: readonly Repository[] = [];
const NO_BOARDS: readonly Board[] = [];

/** NO_CATALOG is what the pickers offer before the state arrives: nothing, for no known reason. */
const NO_CATALOG: ModelCatalog = { models: [], failure: "" };

/** useBoards is every registered board, by title. */
export function useBoards(): readonly Board[] {
  return useAppStore((state) => state.app?.boards ?? NO_BOARDS);
}

/** useBoard is a registered board by id, null when none is. */
export function useBoard(id: string): Board | null {
  return useAppStore((state) => findBoard(state.app, id));
}

/** useLocation is the place on screen. */
export function useLocation(): Location {
  return useAppStore((state) => state.location);
}

// The id of the place on screen when it is of a kind, null otherwise.
function openIdOf(
  state: AppStore,
  kind: "task" | "review" | "discussion" | "board",
): string | null {
  const { location } = state;
  return location.kind === kind ? location.id : null;
}

/** useOpenTaskId is the task whose screen is open, null when none is. */
export function useOpenTaskId(): string | null {
  return useAppStore((state) => openIdOf(state, "task"));
}

/** useOpenItemId is the active item whose screen is open: a task, a review or a discussion; null when none is. */
export function useOpenItemId(): string | null {
  return useAppStore((state) => openItemId(state.location));
}

/** useOpenBoardId is the board whose view is on screen, null when none is. */
export function useOpenBoardId(): string | null {
  return useAppStore((state) => openIdOf(state, "board"));
}

// The last of the places that still exists, null when none does.
function lastExisting(app: State | null, places: readonly Location[]): Location | null {
  return [...places].reverse().find((place) => locationExists(app, place)) ?? null;
}

/** useBackTarget is the place Back goes to, null when there is none. */
export function useBackTarget(): Location | null {
  return useAppStore((state) => lastExisting(state.app, state.back));
}

/** useForwardTarget is the place Forward goes to, null when there is none. */
export function useForwardTarget(): Location | null {
  return useAppStore((state) => lastExisting(state.app, state.forward));
}

/** usePanel is the auxiliary panel open in the place on screen, null when none is. */
export function usePanel(): PanelId | null {
  return useAppStore((state) => state.panel);
}

/** useSidebarRail is the sidebar being collapsed into its strip. */
export function useSidebarRail(): boolean {
  return useAppStore((state) => state.sidebarRail);
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

/** useModelCatalog is what the installed Claude Code offers, as the state carries it. */
export function useModelCatalog(): ModelCatalog {
  return useAppStore((state) => state.app?.modelCatalog ?? NO_CATALOG);
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

// The situation of the place on screen: the one of the open discussion or of
// the open review, or, of the open task, the stage it is in, the conversation
// of the step that runs whose tab is selected, or the pull request.
function onScreenSituation(state: AppStore): Situation | null {
  const discussion = findDiscussion(state.app, openIdOf(state, "discussion"));
  if (discussion !== null) {
    return discussionSituation(discussion);
  }
  const review = findReview(state.app, openIdOf(state, "review"));
  if (review !== null) {
    return reviewSituation(review);
  }
  const task = findTask(state.app, openIdOf(state, "task"));
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
  return useAppStore((state) => openIdOf(state, "review"));
}

/** useReviewsOpen is the Reviews view being the main area. */
export function useReviewsOpen(): boolean {
  return useAppStore((state) => state.location.kind === "reviews");
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
 * useTextDraft is the text the user is editing and the revision it was typed
 * against, null when they are editing none.
 */
export function useTextDraft(key: string): TextDraft | null {
  return useAppStore((state) => state.textDrafts[key] ?? null);
}

/** useDiscussions is every active discussion, in the order they were created. */
export function useDiscussions(): readonly DiscussionSummary[] {
  return useAppStore((state) => discussionsOf(state.app));
}

/** useDiscussion is an active discussion by id, null when none is. */
export function useDiscussion(id: string | null): DiscussionSummary | null {
  return useAppStore((state) => findDiscussion(state.app, id));
}

/** useOpenDiscussionId is the discussion whose screen is open, null when none is. */
export function useOpenDiscussionId(): string | null {
  return useAppStore((state) => openIdOf(state, "discussion"));
}

/** useDiscussionHistory is every archived discussion, the most recent first. */
export function useDiscussionHistory(): readonly ArchivedDiscussion[] {
  return useAppStore((state) => discussionHistoryOf(state.app));
}

/** useArchivedDiscussion is an archived discussion by id, null when none is. */
export function useArchivedDiscussion(id: string | null): ArchivedDiscussion | null {
  return useAppStore((state) => findArchivedDiscussion(state.app, id));
}

/** useNewDiscussion is what the dialog that creates a discussion is open for, null when it is closed. */
export function useNewDiscussion(): NewDiscussionRef | null {
  return useAppStore((state) => state.newDiscussion);
}

export interface HistoryUi {
  historyOpen: boolean;
  openArchivedId: string | null;
  historyQuery: string;
}

export function useHistoryUi(): HistoryUi {
  return useAppStore(
    useShallow((state) => ({
      historyOpen:
        state.location.kind === "history" ||
        state.location.kind === "archived-task" ||
        state.location.kind === "archived-review" ||
        state.location.kind === "archived-discussion",
      openArchivedId: state.location.kind === "archived-task" ? state.location.id : null,
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
      settingsOpen: state.location.kind === "settings",
      settingsSection: state.location.kind === "settings" ? state.location.section : "defaults",
      promptEdit: state.promptEdit,
      pendingLeave: state.pendingLeave,
    })),
  );
}

export function useArchivedNotice(): ArchivedNotice | null {
  return useAppStore((state) => state.archivedNotice);
}

/** useAnnouncement is what the live region says now. */
export function useAnnouncement(): { id: number; text: string } | null {
  return useAppStore((state) => state.announcement);
}

export function useLeftover(): Leftover | null {
  return useAppStore((state) => state.leftover);
}

// The history of places is kept whenever it changes, whatever changed it.
useAppStore.subscribe((state, previous) => {
  if (
    state.location !== previous.location ||
    state.back !== previous.back ||
    state.forward !== previous.forward
  ) {
    persistNav(state);
  }
});
