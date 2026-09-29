import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { boardOfRepository, findBoard } from "@/lib/boards";
import {
  type GoneLocation,
  goneOutcome,
  goneTitle,
  HOME,
  isActiveItem,
  isLocation,
  isLocationList,
  type Location,
  locationExists,
  NAV_LIMIT,
  openItemId,
  type SettingsSection,
  sameLocation,
} from "@/lib/locations";
import {
  discussionSituation,
  prSituation,
  reviewerSituation,
  reviewName,
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
  BoardCard,
  DiscussionSummary,
  Entry,
  Leftover,
  MarkerType,
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
import { firstTab } from "@/store/step-tab";
import {
  applyEvent,
  emptyTranscript,
  fromTranscript,
  settledQuestions,
  type TranscriptState,
} from "@/store/transcript";

export type { SettingsSection } from "@/lib/locations";

/** MAX_TOASTS is how many toasts show at once; a new one pushes out the oldest. */
const MAX_TOASTS = 3;

/** PanelId is an auxiliary panel of an item: its artifacts, its reports, its documents, its details or its card. */
export type PanelId = "artifacts" | "reports" | "documents" | "details" | "card";

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
  /** askBoard is the dialog asking which board: opened from a place without a board, with more than one board. */
  askBoard: boolean;
}

/** PullRef names one pull request: the repository it belongs to and its number. */
export interface PullRef {
  repositoryId: string;
  number: number;
}

/**
 * EarlierConversation is a conversation of a task read from Details in place of the one of its
 * place: the stage of its session, and whether it was opened with the panel open.
 */
export interface EarlierConversation {
  taskId: string;
  stage: string;
  /** from is "panel" when the panel stayed open beside the conversation, where the focus returns. */
  from: "panel" | null;
}

/** AppError is what the app notice says of an action that failed: which action, and what happened. */
export interface AppError {
  /** label is the action that failed, with its item: "Couldn't pause Rate limit per API key". */
  label: string;
  /** detail is the message of the failure and, when the action has one, what to do. */
  detail: string;
}

export interface AppStore {
  app: State | null;
  /** error is the failure the app notice shows, until it is dismissed or the next one replaces it. */
  error: AppError | null;
  /** location is the place on screen. */
  location: Location;
  /** back are the places behind the current one, the most recent last; forward the ones ahead, the nearest last. */
  back: Location[];
  forward: Location[];
  /** panel is the auxiliary panel open in the place on screen, null when none is; every navigation closes it. */
  panel: PanelId | null;
  /**
   * panelDocument is the document the panel opens at, in place of its list: the one Open in
   * Artifacts or Open in Details of a marker of the conversation asked for. The panel takes it and
   * clears it.
   */
  panelDocument: string | null;
  /**
   * earlierConversation is a conversation of the task that is not the one of its place, read from
   * Details; every navigation clears it, and it is never stacked nor stored.
   */
  earlierConversation: EarlierConversation | null;
  /**
   * pendingFocus is where the focus goes once the new place is on screen: its title, the back or
   * forward button, or what the situation of a task asks (request), which the task screen settles.
   */
  pendingFocus: "title" | "back" | "forward" | "request" | null;
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
  /** markerRequest is a marker of a task the conversation opens and focuses: the last one of its type. */
  markerRequest: { taskId: string; type: MarkerType } | null;
  /** openStepTab is the conversation tab of a step, by stepTabKey. */
  openStepTab: Record<string, StepTab>;
  /** prDrafts is the pull request the user is editing, by task id. */
  prDrafts: Record<string, PrDraft>;
  /**
   * questionChoices are the choices of a pending question card, by its requestId, shared by the card
   * and the composer that answers it: by the index of each question, the labels picked and the text
   * of Other… (QuestionChoices of features/chat/composer.ts). The choices of an answer on its way
   * stay, so the card keeps showing them; a question's entry goes away when the conversation marks
   * the question answered or cancelled.
   */
  questionChoices: Record<string, Record<number, { labels: string[]; other: string | null }>>;
  /**
   * questionSending are the pending questions whose answer is on its way, by requestId, sent from
   * the card or from the composer: the card shows it sending and neither sends it again. A question
   * leaves it when the send fails or when the conversation marks it answered or cancelled.
   */
  questionSending: Record<string, true>;
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
  setError: (error: AppError | null) => void;

  /** go opens a place: the current one goes behind it and whatever was ahead is dropped. */
  go: (location: Location, options?: { focus?: "title" | "back" | "forward" }) => void;
  /** goBack opens the nearest place behind the current one that still exists; with none, nothing happens. */
  goBack: (options?: { focus?: "title" | "back" }) => void;
  /** goForward opens the nearest place ahead of the current one that still exists; with none, nothing happens. */
  goForward: (options?: { focus?: "title" | "forward" }) => void;
  clearPendingFocus: () => void;
  /** requestMarkerOpen asks the conversation of a task to open and focus its last marker of a type. */
  requestMarkerOpen: (taskId: string, type: MarkerType) => void;
  clearMarkerRequest: () => void;
  /** openPanel opens an auxiliary panel of the place on screen, closing the one open; null closes it. */
  openPanel: (panel: PanelId | null) => void;
  /** openPanelAt opens an auxiliary panel of the place on screen already at one of its documents. */
  openPanelAt: (panel: PanelId, file: string) => void;
  clearPanelDocument: () => void;
  /** openEarlierConversation puts an earlier conversation of a task in place of the one of its place. */
  openEarlierConversation: (taskId: string, stage: string, fromPanel: boolean) => void;
  /** closeEarlierConversation brings back the conversation of the place. */
  closeEarlierConversation: () => void;
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
  /** openStartReview opens the dialog that starts a review of a pull request. */
  openStartReview: (pull: PullRef) => void;
  closeStartReview: () => void;
  setPendingReview: (pending: PullRef | null) => void;
  openDiscussion: (id: string) => void;
  openArchivedDiscussion: (id: string) => void;
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
  /** failTranscript records why the conversation of a stage could not be read. */
  failTranscript: (taskId: string, stage: string, message: string) => void;
  dropTranscript: (taskId: string, stage: string) => void;
  setDraft: (taskId: string, stage: string, text: string) => void;
  selectStepTab: (taskId: string, step: number, tab: StepTab) => void;
  setPrDraft: (taskId: string, draft: PrDraft) => void;
  /** setQuestionChoices keeps what the card of a pending question has chosen. */
  setQuestionChoices: (
    requestId: string,
    choices: Record<number, { labels: string[]; other: string | null }>,
  ) => void;
  /** setQuestionSending marks a question's answer as on its way, or no longer. */
  setQuestionSending: (requestId: string, sending: boolean) => void;
  clearPrDraft: (taskId: string) => void;

  openHistory: () => void;
  openArchived: (id: string) => void;
  setHistoryQuery: (query: string) => void;
  /** dismissToast takes a toast off the screen. */
  dismissToast: (id: string) => void;
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

// The tasks that show up in the history between two snapshots were archived
// while the user was watching, which is what a toast says.
function newlyArchived(
  previous: readonly ArchivedTask[],
  next: readonly ArchivedTask[],
): ArchivedTask[] {
  const known = new Set(previous.map((entry) => entry.id));
  return next.filter((entry) => !known.has(entry.id));
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

// withoutKeys drops keys from a record; with none of them in it, the record stays the same object.
function withoutKeys<T>(record: Record<string, T>, keys: readonly string[]): Record<string, T> {
  if (!keys.some((key) => key in record)) {
    return record;
  }
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}

// A question the conversation marks answered or cancelled takes its choices and its sending mark
// with it: the card has turned into its answer.
function forgetSettled(
  state: Pick<AppStore, "questionChoices" | "questionSending">,
  entries: readonly Entry[],
): Partial<Pick<AppStore, "questionChoices" | "questionSending">> {
  const settled = settledQuestions(entries);
  if (settled.length === 0) {
    return {};
  }
  return {
    questionChoices: withoutKeys(state.questionChoices, settled),
    questionSending: withoutKeys(state.questionSending, settled),
  };
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
  | "markerRequest"
  | "openStepTab"
  | "prDrafts"
  | "questionChoices"
  | "questionSending"
  | "newTaskOpen"
  | "newTaskCard"
  | "pendingStart"
  | "startReview"
  | "pendingReview"
  | "newDiscussion"
  | "textDrafts"
  | "lastRepositoryId"
  | "historyQuery"
  | "leftover"
  | "flashing"
> {
  return {
    transcripts: {},
    drafts: {},
    markerRequest: null,
    openStepTab: {},
    prDrafts: {},
    questionChoices: {},
    questionSending: {},
    newTaskOpen: false,
    newTaskCard: null,
    pendingStart: null,
    startReview: null,
    pendingReview: null,
    newDiscussion: null,
    textDrafts: {},
    lastRepositoryId: null,
    historyQuery: "",
    leftover: null,
    flashing: new Set<string>(),
  };
}

/** Navigation is the part of the store a navigation changes. */
type Navigation = Pick<
  AppStore,
  "location" | "back" | "forward" | "panel" | "earlierConversation" | "pendingFocus" | "promptEdit"
>;

// beside drops the places at the end of a history that are the place on
// screen, which Back or Forward would only open again: leaving the page of an
// item that left stacks nothing, so the place it opens may already be the
// last one behind it. The same list comes back when nothing is dropped.
function beside(places: Location[], location: Location): Location[] {
  const end = places.reduce(
    (kept, place, at) => (sameLocation(place, location) ? kept : at + 1),
    0,
  );
  return end === places.length ? places : places.slice(0, end);
}

// navigate opens a place. The same place only takes the new one (a page of
// Settings changes without stacking); another pushes the current one behind it,
// unless it is the page of an item that left, which is never revisited, and
// drops whatever was ahead.
function navigate(
  state: AppStore,
  location: Location,
  focus: AppStore["pendingFocus"],
): Navigation {
  const target = location;
  const common = {
    location: target,
    panel: null,
    earlierConversation: null,
    pendingFocus: focus,
    promptEdit: null,
  };
  if (sameLocation(state.location, target)) {
    return {
      ...common,
      back: beside(state.back, target),
      forward: beside(state.forward, target),
    };
  }
  const back =
    state.location.kind === "gone" ? state.back : [...state.back, state.location].slice(-NAV_LIMIT);
  return { ...common, back: beside(back, target), forward: [] };
}

// reachable is whether Back or Forward can go to a place: it still exists and
// is not the place on screen, which a place that left between them can hide
// from beside.
function reachable(app: State | null, place: Location, current: Location): boolean {
  return locationExists(app, place) && !sameLocation(place, current);
}

// travel opens the nearest place behind (or ahead of) the current one it can
// reach, dropping the ones it cannot; the current one goes to the other side,
// unless it is the page of an item that left. Null when there is nowhere to go.
function travel(
  state: AppStore,
  direction: "back" | "forward",
  focus: AppStore["pendingFocus"],
): Navigation | null {
  const from = direction === "back" ? state.back : state.forward;
  const to = direction === "back" ? state.forward : state.back;
  const index = from.reduce(
    (found, place, at) => (reachable(state.app, place, state.location) ? at : found),
    -1,
  );
  const place = from[index];
  if (place === undefined) {
    return null;
  }
  const rest = from.slice(0, index);
  const behind = state.location.kind === "gone" ? to : [...to, state.location].slice(-NAV_LIMIT);
  const location = place;
  return {
    location,
    back: beside(direction === "back" ? rest : behind, location),
    forward: beside(direction === "back" ? behind : rest, location),
    panel: null,
    earlierConversation: null,
    pendingFocus: focus,
    promptEdit: null,
  };
}

// keptEarlier is the earlier conversation once a new state arrives: it closes when its task or its
// session is gone, as a discarded session is.
function keptEarlier(next: State, earlier: EarlierConversation | null): EarlierConversation | null {
  if (earlier === null) {
    return null;
  }
  const task = findTask(next, earlier.taskId);
  const kept = (task?.conversations ?? []).some(
    (conversation) => conversation.stage === earlier.stage,
  );
  return kept ? earlier : null;
}

// gone is the page of an item that left, with what the state no longer has of
// it: the name its page says and the board it lived under.
function gone(item: GoneLocation["item"], id: string, name: string, boardId: string): GoneLocation {
  return { kind: "gone", item, id, name, boardId };
}

// The place on screen once a new state arrives. An archived item that left
// goes back to the History; an active item or a board that was there and is
// no longer becomes the page of what left. An item that was not in the
// previous state is not treated as gone: it was just created.
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
    case "task": {
      const task = findTask(prev, location.id);
      if (task === null || findTask(next, location.id) !== null) {
        return location;
      }
      const boardId = boardOfRepository(prev, task.repositoryId)?.id ?? "";
      return gone("task", task.id, task.name, boardId);
    }
    case "review": {
      const review = findReview(prev, location.id);
      if (review === null || findReview(next, location.id) !== null) {
        return location;
      }
      return gone("review", review.id, reviewName(review), "");
    }
    case "discussion": {
      const discussion = findDiscussion(prev, location.id);
      if (discussion === null || findDiscussion(next, location.id) !== null) {
        return location;
      }
      return gone("discussion", discussion.id, discussion.title, discussion.boardId);
    }
    case "board": {
      const board = findBoard(prev, location.id);
      if (board === null || findBoard(next, location.id) !== null) {
        return location;
      }
      return gone("board", board.id, board.title, "");
    }
    case "home":
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
    panelDocument: null,
    earlierConversation: null,
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
            earlierConversation: null,
            promptEdit: null,
            pendingLeave: null,
          };
        }
        const history = historyOf(next);
        // The first snapshot brings the whole history at once; nothing in it was
        // archived under the eyes of the user.
        const archived = state.app === null ? [] : newlyArchived(historyOf(state.app), history);
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
        // The task archived while open has its page; every other one, a toast.
        const toasted = archived.filter((entry) => entry.id !== openItemId(state.location));
        const toasts =
          toasted.length === 0
            ? state.toasts
            : [
                ...state.toasts,
                ...toasted.map((entry) => ({ id: entry.id, taskId: entry.id, name: entry.name })),
              ].slice(-MAX_TOASTS);
        // The page of an item that left on its own is announced; the one the
        // user just asked to remove is not.
        const arrived = moved && location.kind === "gone" ? location : null;
        const announcement =
          arrived === null || arrived.id === state.expectGone
            ? state.announcement
            : {
                id: (state.announcement?.id ?? 0) + 1,
                text: goneTitle(arrived, goneOutcome(next, arrived)),
              };
        return {
          app: next,
          lastRepositoryId,
          location,
          back: moved ? beside(state.back, location) : state.back,
          forward: moved ? beside(state.forward, location) : state.forward,
          panel: moved ? null : state.panel,
          earlierConversation: keptEarlier(next, state.earlierConversation),
          toasts,
          announcement,
          expectGone: arrived === null ? state.expectGone : null,
          transcripts:
            left === null ? state.transcripts : withoutTaskTranscripts(state.transcripts, left),
        };
      }),

    setError: (error) => set({ error }),

    go,

    goBack: (options) => {
      step("back", options?.focus ?? null);
    },

    goForward: (options) => {
      step("forward", options?.focus ?? null);
    },

    clearPendingFocus: () => set({ pendingFocus: null }),

    requestMarkerOpen: (taskId, type) => set({ markerRequest: { taskId, type } }),

    clearMarkerRequest: () => set({ markerRequest: null }),

    openPanel: (panel) => set({ panel, panelDocument: null }),

    openPanelAt: (panel, file) => set({ panel, panelDocument: file }),

    clearPanelDocument: () => set({ panelDocument: null }),

    openEarlierConversation: (taskId, stage, fromPanel) =>
      set({ earlierConversation: { taskId, stage, from: fromPanel ? "panel" : null } }),

    closeEarlierConversation: () => set({ earlierConversation: null }),

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

    openStartReview: (pull) => set({ startReview: pull }),

    closeStartReview: () => set({ startReview: null }),

    setPendingReview: (pending) => set({ pendingReview: pending }),

    openDiscussion: (id) => go({ kind: "discussion", id }),

    openArchivedDiscussion: (id) => go({ kind: "archived-discussion", id }),

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
              error: "",
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
        return {
          transcripts: { ...state.transcripts, [key]: loaded },
          ...forgetSettled(state, loaded.entries),
        };
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
        // A buffered event settles its question when the loaded conversation folds it in.
        const settles =
          current.status !== "loading" && event.kind === "entry" && event.entry !== null
            ? [event.entry]
            : [];
        return {
          transcripts: { ...state.transcripts, [key]: next },
          ...forgetSettled(state, settles),
        };
      }),

    failTranscript: (taskId, stage, message) =>
      set((state) => {
        const key = sessionKey(taskId, stage);
        return {
          transcripts: {
            ...state.transcripts,
            [key]: {
              ...(state.transcripts[key] ?? emptyTranscript()),
              status: "error",
              error: message,
              buffered: [],
            },
          },
        };
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

    setQuestionChoices: (requestId, choices) =>
      set((state) => ({ questionChoices: { ...state.questionChoices, [requestId]: choices } })),

    setQuestionSending: (requestId, sending) =>
      set((state) => ({
        questionSending: sending
          ? { ...state.questionSending, [requestId]: true }
          : withoutKeys(state.questionSending, [requestId]),
      })),

    clearPrDraft: (taskId) =>
      set((state) => {
        const { [taskId]: _dropped, ...rest } = state.prDrafts;
        return { prDrafts: rest };
      }),

    openHistory: () => go({ kind: "history" }),

    openArchived: (id) => go({ kind: "archived-task", id }),

    setHistoryQuery: (query) => set({ historyQuery: query }),

    dismissToast: (id) =>
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

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
      // A task takes the focus to what its situation asks; a review and a discussion, to the title.
      leave(() =>
        set((state) => ({
          ...navigate(state, location, location.kind === "task" ? "request" : "title"),
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

/**
 * BoardCardReading is a card as the last reading of its board has it: the board missing when it was
 * removed, unread before its first reading, and read with the card, or with null when the reading
 * doesn't have it.
 */
export type BoardCardReading =
  | { board: "missing" | "unread"; card: null }
  | { board: "read"; card: BoardCard | null };

/** useBoardCard is the card of a key in the last reading of a board. */
export function useBoardCard(boardId: string, key: string): BoardCardReading {
  return useAppStore(
    useShallow((state): BoardCardReading => {
      const board = findBoard(state.app, boardId);
      if (board === null) {
        return { board: "missing", card: null };
      }
      if (board.readAt === "") {
        return { board: "unread", card: null };
      }
      return { board: "read", card: (board.cards ?? []).find((card) => card.key === key) ?? null };
    }),
  );
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

// The last of the places Back or Forward can reach, null when there is none.
function lastReachable(
  app: State | null,
  places: readonly Location[],
  current: Location,
): Location | null {
  return [...places].reverse().find((place) => reachable(app, place, current)) ?? null;
}

/** useBackTarget is the place Back goes to, null when there is none. */
export function useBackTarget(): Location | null {
  return useAppStore((state) => lastReachable(state.app, state.back, state.location));
}

/** useForwardTarget is the place Forward goes to, null when there is none. */
export function useForwardTarget(): Location | null {
  return useAppStore((state) => lastReachable(state.app, state.forward, state.location));
}

/** useEarlierConversation is the earlier conversation on screen of a task, null when none is. */
export function useEarlierConversation(taskId: string): EarlierConversation | null {
  return useAppStore((state) =>
    state.earlierConversation?.taskId === taskId ? state.earlierConversation : null,
  );
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

/** useError is the failure the app notice shows, if any. */
export function useError(): AppError | null {
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

// A tab that no longer has a conversation behind it falls back to the implementer, and a step
// with nothing stored opens the tab of firstTab.
function openStepTabOf(state: AppStore, taskId: string): StepTab {
  const task = findTask(state.app, taskId);
  const step = (task?.steps ?? []).find((candidate) => candidate.number === task?.currentStep);
  if (task === null || step === undefined || step.reviewer === null) {
    return "implementer";
  }
  return state.openStepTab[stepTabKey(taskId, step.number)] ?? firstTab(task, step);
}

/** useOpenStepTab is the conversation tab of the current step of a task. */
export function useOpenStepTab(taskId: string): StepTab {
  return useAppStore((state) => openStepTabOf(state, taskId));
}

// The situation of the place on screen: the one of the open discussion or of
// the open review, or, of the open task, the stage it is in, the conversation
// of the step that runs whose tab is selected, or the pull request. An earlier
// conversation on screen hides the one of the place, and its situation with it.
function onScreenSituation(state: AppStore): Situation | null {
  if (state.earlierConversation !== null) {
    return null;
  }
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

/** useReview is an active review by id, null when none is. */
export function useReview(id: string | null): ReviewSummary | null {
  return useAppStore((state) => findReview(state.app, id));
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

/** useToasts are the toasts on screen, the oldest first. */
export function useToasts(): readonly Toast[] {
  return useAppStore((state) => state.toasts);
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
