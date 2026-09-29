import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME, type Location, NAV_LIMIT } from "@/lib/locations";
import {
  LAST_ITEM_KEY,
  NAV_STACK_KEY,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_RAIL_KEY,
} from "@/lib/ui-storage";
import type { ArchivedTask, Place, PullRequest, Situation, TranscriptEvent } from "@/lib/wails";
import { sessionKey } from "@/lib/wails";
import {
  initialNav,
  readLastItem,
  stepTabKey,
  useAppStore,
  useArchivedDiscussion,
  useArchivedReview,
  useArchivedTask,
  useBackTarget,
  useBoard,
  useBoardCard,
  useBoards,
  useDiscussion,
  useDiscussionHistory,
  useDiscussions,
  useDraft,
  useEarlierConversation,
  useError,
  useFlashing,
  useForwardTarget,
  useHistory,
  useHistoryUi,
  useLeftover,
  useMigration,
  useModelCatalog,
  useNewDiscussion,
  useOnScreenSituationId,
  useOpenBoardId,
  useOpenItemId,
  useOpenStepTab,
  useOpenTaskId,
  usePrDraft,
  useRepositories,
  useRepository,
  useRepositoryFilter,
  useReview,
  useReviewCenter,
  useReviewHistory,
  useReviewsOpen,
  useSettingsUi,
  useSidebarCollapsed,
  useStartReview,
  useTask,
  useTasks,
  useTextDraft,
  useThemeState,
  useTranscript,
} from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeEntry,
  makeMigration,
  makeModelCatalog,
  makePullRequest,
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskConversation,
  makeTranscript,
} from "@/test/wails-mock";

const WEB = makeRepository();
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

const WEB_TASK = makeTask({ id: "task-web", name: "add-login" });
const API_TASK = makeTask({
  id: "task-api",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
});

function withTasks(overrides = {}) {
  return makeState({ repositories: [WEB, API], tasks: [WEB_TASK, API_TASK], ...overrides });
}

// WEB_KEY is the session of the web task in the stage its fixture is in.
const WEB_KEY = sessionKey(WEB_TASK.id, WEB_TASK.stage);

function transcriptEvent(overrides: Partial<TranscriptEvent> = {}): TranscriptEvent {
  return {
    taskId: WEB_TASK.id,
    stage: WEB_TASK.stage,
    kind: "entry",
    entry: null,
    entryId: "",
    text: "",
    ...overrides,
  };
}

// location is the place on screen.
function location(): Location {
  return useAppStore.getState().location;
}

beforeEach(() => {
  resetAppStore();
});

describe("applyState", () => {
  it("keeps what is on screen while repositories stay registered", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(API_TASK.id);

    useAppStore.getState().applyState(withTasks({ systemDark: true }));

    expect(location()).toEqual({ kind: "task", id: API_TASK.id });
  });

  // The welcome screen takes the place of everything the app shows of the tasks.
  it("clears the screen when the last repository is gone", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(API_TASK.id);
    useAppStore.getState().openSettings();

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(location()).toEqual(HOME);
  });

  it("forgets the last repository used once it is no longer registered", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().rememberRepository("repo-2");

    useAppStore.getState().applyState(makeState({ repositories: [WEB], tasks: [WEB_TASK] }));

    expect(useAppStore.getState().lastRepositoryId).toBeNull();
  });

  it("keeps the last repository used while it is still registered", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().rememberRepository("repo-2");

    useAppStore.getState().applyState(withTasks());

    expect(useAppStore.getState().lastRepositoryId).toBe("repo-2");
  });
});

describe("selectors", () => {
  it("report an empty state before the first snapshot", () => {
    const { result } = renderHook(() => ({
      repositories: useRepositories(),
      filter: useRepositoryFilter(),
      migration: useMigration(),
      catalog: useModelCatalog(),
      error: useError(),
      theme: useThemeState(),
    }));

    expect(result.current.repositories).toEqual([]);
    expect(result.current.filter).toBe("");
    expect(result.current.migration).toBeNull();
    expect(result.current.catalog).toEqual({ models: [], failure: "" });
    expect(result.current.error).toBeNull();
    expect(result.current.theme).toEqual({ preference: "system", systemDark: false });
  });

  it("report the current snapshot", () => {
    const { result } = renderHook(() => ({
      repositories: useRepositories(),
      filter: useRepositoryFilter(),
      web: useRepository("repo-1"),
      unknown: useRepository("repo-9"),
      migration: useMigration(),
      catalog: useModelCatalog(),
      error: useError(),
      theme: useThemeState(),
    }));

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          repositories: [WEB, API],
          repositoryFilter: "repo-2",
          theme: "dark",
          systemDark: true,
        }),
      );
      useAppStore.getState().setError({ label: "Couldn't pause", detail: "binding failed" });
    });

    expect(result.current.repositories).toHaveLength(2);
    expect(result.current.filter).toBe("repo-2");
    expect(result.current.web?.fullName).toBe("dev/web");
    expect(result.current.unknown).toBeNull();
    expect(result.current.migration).toBeNull();
    expect(result.current.catalog).toEqual(makeModelCatalog());
    expect(result.current.error).toEqual({ label: "Couldn't pause", detail: "binding failed" });
    expect(result.current.theme).toEqual({ preference: "dark", systemDark: true });
  });

  it("reports a migration the app could not carry out", () => {
    const { result } = renderHook(() => useMigration());

    act(() => {
      useAppStore
        .getState()
        .applyState(makeState({ repositories: [], migration: makeMigration() }));
    });

    expect(result.current?.cases).toHaveLength(1);
  });

  it("falls back to an empty repository list when the snapshot has none", () => {
    const { result } = renderHook(() => useRepositories());

    act(() => {
      useAppStore.getState().applyState(makeState({ repositories: null }));
    });

    expect(result.current).toEqual([]);
  });
});

describe("open task", () => {
  it("opens a task and puts the history and the settings away", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openHistory();

    useAppStore.getState().openTask(API_TASK.id);

    expect(location()).toEqual({ kind: "task", id: API_TASK.id });
  });

  it("opens a task the snapshot does not have yet", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().openTask("task-unknown");

    expect(location()).toEqual({ kind: "task", id: "task-unknown" });
  });

  it("closes a task that the snapshot no longer has and drops its transcript", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(location().kind).toBe("gone");
    expect(useAppStore.getState().transcripts[WEB_KEY]).toBeUndefined();
  });

  it("forgets tasks, transcripts and drafts once no repository is registered", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));
    useAppStore.getState().setDraft(WEB_TASK.id, WEB_TASK.stage, "half a message");
    useAppStore.getState().openNewTask();
    useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(location()).toEqual(HOME);
    expect(useAppStore.getState().transcripts).toEqual({});
    expect(useAppStore.getState().drafts).toEqual({});
    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().openStepTab).toEqual({});
  });

  it("opens and closes the creation dialog, and remembers the repository used", () => {
    useAppStore.getState().openNewTask();
    expect(useAppStore.getState().newTaskOpen).toBe(true);

    useAppStore.getState().rememberRepository("repo-2");
    expect(useAppStore.getState().lastRepositoryId).toBe("repo-2");

    useAppStore.getState().closeNewTask();
    expect(useAppStore.getState().newTaskOpen).toBe(false);
  });
});

describe("transcripts", () => {
  it("buffers what arrives while loading and applies it once loaded", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore.getState().beginTranscript(WEB_TASK.id, WEB_TASK.stage);

    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ entry }));
    expect(useAppStore.getState().transcripts[WEB_KEY]?.entries).toEqual([]);

    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));

    const transcript = useAppStore.getState().transcripts[WEB_KEY];
    expect(transcript?.status).toBe("ready");
    expect(transcript?.entries).toEqual([entry]);
    expect(transcript?.buffered).toEqual([]);
  });

  it("applies an event to a conversation it has already loaded", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));

    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ entry }));

    expect(useAppStore.getState().transcripts[WEB_KEY]?.entries).toEqual([entry]);
  });

  it("ignores an event for a task nobody opened", () => {
    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ taskId: "task-other" }));

    expect(useAppStore.getState().transcripts).toEqual({});
  });

  it("ignores an event that changes nothing", () => {
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));
    const before = useAppStore.getState().transcripts[WEB_KEY];

    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ kind: "text", entryId: "gone" }));

    expect(useAppStore.getState().transcripts[WEB_KEY]).toBe(before);
  });

  it("keeps the entries it has while reloading", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id, entries: [entry] }));

    useAppStore.getState().beginTranscript(WEB_TASK.id, WEB_TASK.stage);

    const transcript = useAppStore.getState().transcripts[WEB_KEY];
    expect(transcript?.status).toBe("loading");
    expect(transcript?.entries).toEqual([entry]);
  });

  it("keeps why a conversation could not be read until it loads again", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id, entries: [entry] }));

    useAppStore.getState().failTranscript(WEB_TASK.id, WEB_TASK.stage, "database is locked");

    const failed = useAppStore.getState().transcripts[WEB_KEY];
    expect(failed?.status).toBe("error");
    expect(failed?.error).toBe("database is locked");
    expect(failed?.entries).toEqual([entry]);

    useAppStore.getState().beginTranscript(WEB_TASK.id, WEB_TASK.stage);
    expect(useAppStore.getState().transcripts[WEB_KEY]?.error).toBe("");
  });

  it("drops a conversation on request", () => {
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));

    useAppStore.getState().dropTranscript(WEB_TASK.id, WEB_TASK.stage);

    expect(useAppStore.getState().transcripts[WEB_KEY]).toBeUndefined();
  });

  it("keeps the conversations of one task apart, one per stage", () => {
    const prd = makeEntry("user", { id: "a", seq: 1 });
    const spec = makeEntry("user", { id: "b", seq: 1 });
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id, entries: [prd] }));
    useAppStore
      .getState()
      .setTranscript(makeTranscript({ taskId: WEB_TASK.id, stage: "tech_spec", entries: [spec] }));

    // An event of one stage never reaches the conversation of the other.
    const entry = makeEntry("assistant", { id: "c", seq: 2 });
    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ stage: "tech_spec", entry }));

    const specKey = sessionKey(WEB_TASK.id, "tech_spec");
    expect(useAppStore.getState().transcripts[WEB_KEY]?.entries).toEqual([prd]);
    expect(useAppStore.getState().transcripts[specKey]?.entries).toEqual([spec, entry]);

    // Dropping one leaves the other alone.
    useAppStore.getState().dropTranscript(WEB_TASK.id, "tech_spec");
    expect(useAppStore.getState().transcripts[specKey]).toBeUndefined();
    expect(useAppStore.getState().transcripts[WEB_KEY]?.entries).toEqual([prd]);
  });

  it("forgets every conversation of a task that left the snapshot", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id, stage: "plan" }));
    useAppStore.getState().setTranscript(makeTranscript({ taskId: API_TASK.id }));

    useAppStore.getState().applyState(makeState({ tasks: [API_TASK] }));

    expect(useAppStore.getState().transcripts).toEqual({
      [sessionKey(API_TASK.id, API_TASK.stage)]: expect.anything(),
    });
  });

  it("keeps one draft per session, not one per task", () => {
    useAppStore.getState().setDraft(WEB_TASK.id, WEB_TASK.stage, "hello");
    useAppStore.getState().setDraft(API_TASK.id, API_TASK.stage, "there");

    expect(useAppStore.getState().drafts).toEqual({
      [WEB_KEY]: "hello",
      [sessionKey(API_TASK.id, API_TASK.stage)]: "there",
    });
  });
});

describe("task selectors", () => {
  it("report the tasks of the snapshot, the open one, its transcript and its draft", () => {
    const { result } = renderHook(() => ({
      tasks: useTasks(),
      task: useTask(API_TASK.id),
      open: useOpenTaskId(),
      transcript: useTranscript(WEB_TASK.id, WEB_TASK.stage),
      draft: useDraft(WEB_TASK.id, WEB_TASK.stage),
    }));

    expect(result.current.tasks).toEqual([]);
    expect(result.current.task).toBeNull();
    expect(result.current.transcript).toBeNull();
    expect(result.current.draft).toBe("");

    act(() => {
      useAppStore.getState().applyState(withTasks());
      useAppStore.getState().openTask(WEB_TASK.id);
      useAppStore.getState().setDraft(WEB_TASK.id, WEB_TASK.stage, "hello");
      useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.task).toEqual(API_TASK);
    expect(result.current.open).toBe(WEB_TASK.id);
    expect(result.current.transcript?.status).toBe("ready");
    expect(result.current.draft).toBe("hello");
  });

  it("falls back to an empty task list when the snapshot has none", () => {
    const { result } = renderHook(() => useTasks());

    act(() => {
      useAppStore.getState().applyState(makeState({ tasks: null }));
    });

    expect(result.current).toEqual([]);
  });
});

const PR_PLACE: Place = { kind: "pr", stage: "", step: 0 };

function withPR(pr: PullRequest | null, situations: Situation[] = []) {
  return withTasks({ tasks: [{ ...WEB_TASK, stage: "pr", pr, situations }] });
}

describe("pull request drafts", () => {
  const draft = { title: "Add the login form", body: "Closes #12" };

  it("keeps what the user is editing across state updates", () => {
    const { result } = renderHook(() => usePrDraft(WEB_TASK.id));

    act(() => {
      useAppStore.getState().applyState(withPR(makePullRequest({ status: "drafting" })));
      useAppStore.getState().setPrDraft(WEB_TASK.id, draft);
    });
    expect(result.current).toEqual(draft);

    act(() => {
      useAppStore.getState().applyState(withPR(makePullRequest({ status: "draft_ready" })));
    });

    expect(result.current).toEqual(draft);
  });

  it("keys a draft by task", () => {
    act(() => {
      useAppStore.getState().setPrDraft(WEB_TASK.id, draft);
    });

    expect(useAppStore.getState().prDrafts).toEqual({ [WEB_TASK.id]: draft });
  });

  it("clears one draft and leaves the others", () => {
    act(() => {
      useAppStore.getState().setPrDraft(WEB_TASK.id, draft);
      useAppStore.getState().setPrDraft(API_TASK.id, draft);
      useAppStore.getState().clearPrDraft(WEB_TASK.id);
    });

    expect(useAppStore.getState().prDrafts).toEqual({ [API_TASK.id]: draft });
  });

  it("drops the drafts once no repository is registered", () => {
    act(() => {
      useAppStore.getState().applyState(withPR(makePullRequest()));
      useAppStore.getState().setPrDraft(WEB_TASK.id, draft);
    });

    act(() => {
      useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));
    });

    expect(useAppStore.getState().prDrafts).toEqual({});
  });
});

describe("question choices", () => {
  const choices = { 0: { labels: ["Per key"], other: null } };

  it("keeps the choices by request and leaves the others", () => {
    act(() => {
      useAppStore.getState().setQuestionChoices("req-1", choices);
      useAppStore.getState().setQuestionChoices("req-2", { 0: { labels: [], other: "Disk" } });
      useAppStore.getState().setQuestionChoices("req-2", { 0: { labels: [], other: "Memory" } });
    });

    expect(useAppStore.getState().questionChoices).toEqual({
      "req-1": choices,
      "req-2": { 0: { labels: [], other: "Memory" } },
    });
  });

  // asked is a question entry of the conversation, pending or settled.
  function asked(requestId: string, status: string, seq = 1) {
    const entry = makeEntry("question", { id: requestId, seq });
    if (entry.question === null) {
      throw new Error("the question fixture has no payload");
    }
    return { ...entry, question: { ...entry.question, requestId, status } };
  }

  it("marks and unmarks the answer of a question on its way", () => {
    act(() => {
      useAppStore.getState().setQuestionSending("req-1", true);
      useAppStore.getState().setQuestionSending("req-2", true);
      useAppStore.getState().setQuestionSending("req-2", false);
    });

    expect(useAppStore.getState().questionSending).toEqual({ "req-1": true });
  });

  it("forgets the choices and the sending of a question the conversation marks answered", () => {
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));
    act(() => {
      useAppStore.getState().setQuestionChoices("req-1", choices);
      useAppStore.getState().setQuestionChoices("req-2", choices);
      useAppStore.getState().setQuestionSending("req-1", true);
    });

    act(() => {
      useAppStore
        .getState()
        .applyTranscriptEvent(transcriptEvent({ entry: asked("req-2", "pending") }));
    });

    expect(useAppStore.getState().questionChoices).toEqual({ "req-1": choices, "req-2": choices });

    act(() => {
      useAppStore
        .getState()
        .applyTranscriptEvent(transcriptEvent({ entry: asked("req-1", "allowed") }));
    });

    expect(useAppStore.getState().questionChoices).toEqual({ "req-2": choices });
    expect(useAppStore.getState().questionSending).toEqual({});
  });

  it("forgets the choices of a question cancelled in a conversation loaded again", () => {
    act(() => {
      useAppStore.getState().setQuestionChoices("req-1", choices);
      useAppStore.getState().setQuestionSending("req-1", true);
      useAppStore.getState().beginTranscript(WEB_TASK.id, WEB_TASK.stage);
      useAppStore
        .getState()
        .applyTranscriptEvent(transcriptEvent({ entry: asked("req-1", "cancelled") }));
    });

    expect(useAppStore.getState().questionChoices).toEqual({ "req-1": choices });

    act(() => {
      useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));
    });

    expect(useAppStore.getState().questionChoices).toEqual({});
    expect(useAppStore.getState().questionSending).toEqual({});
  });

  it("drops the choices once no repository is registered", () => {
    act(() => {
      useAppStore.getState().applyState(withPR(makePullRequest()));
      useAppStore.getState().setQuestionChoices("req-1", choices);
    });

    act(() => {
      useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));
    });

    expect(useAppStore.getState().questionChoices).toEqual({});
  });
});

// A task under the agent review of two steps, each with a reviewer unless told otherwise.
function withSteps(
  overrides: { currentStep?: number; reviewer?: boolean; situations?: Situation[] } = {},
) {
  const reviewer = overrides.reviewer === false ? null : makeStepReviewer();
  return withTasks({
    tasks: [
      {
        ...WEB_TASK,
        stage: "implementation",
        currentStep: overrides.currentStep ?? 1,
        situations: overrides.situations ?? [],
        steps: [
          makeStep({ status: "agent_review", reviewer }),
          makeStep({ number: 2, file: "2-wire-the-api.md", status: "agent_review", reviewer }),
        ],
      },
    ],
  });
}

describe("step tabs", () => {
  it("opens on the tab of firstTab and keeps the tab the user picks", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));

    act(() => {
      useAppStore.getState().applyState(withSteps());
    });
    expect(result.current).toBe("reviewer");

    act(() => {
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "implementer");
    });
    expect(result.current).toBe("implementer");

    act(() => {
      useAppStore.getState().applyState(withSteps());
    });
    expect(result.current).toBe("implementer");
  });

  it("falls back to the implementer while the step has no reviewer", () => {
    const { result } = renderHook(() => ({
      open: useOpenStepTab(WEB_TASK.id),
      gone: useOpenStepTab("task-gone"),
    }));

    act(() => {
      useAppStore.getState().applyState(withSteps({ reviewer: false }));
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");
      useAppStore.getState().selectStepTab("task-gone", 1, "reviewer");
    });

    expect(result.current).toEqual({ open: "implementer", gone: "implementer" });
  });

  it("keeps the tabs of each step apart", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));

    act(() => {
      useAppStore.getState().applyState(withSteps());
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "implementer");
      useAppStore.getState().applyState(withSteps({ currentStep: 2 }));
    });

    expect(result.current).toBe("reviewer");
    expect(useAppStore.getState().openStepTab).toEqual({
      [stepTabKey(WEB_TASK.id, 1)]: "implementer",
    });
  });
});

const ARCHIVED = makeArchivedTask({ id: "task-archived", name: "add-login" });
const OLDER = makeArchivedTask({
  id: "task-old",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
});

describe("history", () => {
  it("shows the archived tasks of the snapshot", () => {
    const { result } = renderHook(() => ({
      history: useHistory(),
      entry: useArchivedTask(ARCHIVED.id),
      missing: useArchivedTask("task-gone"),
    }));

    expect(result.current.history).toEqual([]);

    act(() => {
      useAppStore.getState().applyState(withTasks({ history: [ARCHIVED, OLDER] }));
    });

    expect(result.current.history).toHaveLength(2);
    expect(result.current.entry).toEqual(ARCHIVED);
    expect(result.current.missing).toBeNull();
  });

  it("falls back to an empty history when the snapshot has none", () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      useAppStore.getState().applyState(withTasks({ history: null }));
    });

    expect(result.current).toEqual([]);
  });

  it("opens and closes the history and the task inside it", () => {
    const { result } = renderHook(() => useHistoryUi());

    act(() => {
      useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
      useAppStore.getState().openTask(WEB_TASK.id);
      useAppStore.getState().openHistory();
    });
    expect(result.current).toEqual({
      historyOpen: true,
      openArchivedId: null,
      historyQuery: "",
    });
    expect(location()).toEqual({ kind: "history" });

    act(() => {
      useAppStore.getState().openArchived(ARCHIVED.id);
      useAppStore.getState().setHistoryQuery("log");
    });
    expect(result.current).toEqual({
      historyOpen: true,
      openArchivedId: ARCHIVED.id,
      historyQuery: "log",
    });
  });

  it("leaves the history when a task is opened", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().openTask(WEB_TASK.id);

    expect(location()).toEqual({ kind: "task", id: WEB_TASK.id });
  });

  it("closes an archived task that left the history", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().applyState(withTasks({ history: [] }));

    expect(location()).toEqual({ kind: "history" });
  });

  it("keeps the archived task open while the history still has it", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED, OLDER] }));

    expect(location()).toEqual({ kind: "archived-task", id: ARCHIVED.id });
  });
});

describe("toasts", () => {
  it("shows a toast for a task archived while not open", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK], history: [ARCHIVED] }));

    expect(useAppStore.getState().toasts).toEqual([
      { id: ARCHIVED.id, taskId: ARCHIVED.id, name: ARCHIVED.name },
    ]);
  });

  it("shows no toast for the task archived while open", () => {
    const task = makeTask({ id: ARCHIVED.id, name: ARCHIVED.name });
    useAppStore.getState().applyState(withTasks({ tasks: [task] }));
    useAppStore.getState().openTask(task.id);

    useAppStore.getState().applyState(withTasks({ tasks: [], history: [ARCHIVED] }));

    expect(useAppStore.getState().toasts).toEqual([]);
  });

  it("shows a toast for each task archived in the same update", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().applyState(withTasks({ tasks: [], history: [ARCHIVED, OLDER] }));

    expect(useAppStore.getState().toasts).toEqual([
      { id: ARCHIVED.id, taskId: ARCHIVED.id, name: ARCHIVED.name },
      { id: OLDER.id, taskId: OLDER.id, name: OLDER.name },
    ]);
  });

  it("shows a toast for every task archived in the same update but the open one", () => {
    const task = makeTask({ id: ARCHIVED.id, name: ARCHIVED.name });
    useAppStore.getState().applyState(withTasks({ tasks: [task] }));
    useAppStore.getState().openTask(task.id);

    useAppStore.getState().applyState(withTasks({ tasks: [], history: [ARCHIVED, OLDER] }));

    expect(useAppStore.getState().toasts).toEqual([
      { id: OLDER.id, taskId: OLDER.id, name: OLDER.name },
    ]);
  });

  // The first snapshot brings the whole history; none of it was archived now.
  it("shows no toast for a history that was already there", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED, OLDER] }));

    expect(useAppStore.getState().toasts).toEqual([]);
  });

  it("keeps three toasts at most, dropping the oldest", () => {
    useAppStore.getState().applyState(withTasks());
    const history: ArchivedTask[] = [];
    for (const n of [1, 2, 3, 4]) {
      history.push(makeArchivedTask({ id: `task-${n}`, name: `task ${n}` }));
      useAppStore.getState().applyState(withTasks({ history: [...history] }));
    }

    expect(useAppStore.getState().toasts.map((toast) => toast.id)).toEqual([
      "task-2",
      "task-3",
      "task-4",
    ]);
  });

  it("takes a dismissed toast off", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));

    useAppStore.getState().dismissToast(ARCHIVED.id);

    expect(useAppStore.getState().toasts).toEqual([]);
  });
});

describe("notices", () => {
  it("holds what the last deletion left on disk", () => {
    const { result } = renderHook(() => useLeftover());
    const leftover = {
      path: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
      branch: "",
      error: "permission denied",
    };

    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().setLeftover(leftover);
    });
    expect(result.current).toEqual(leftover);

    act(() => {
      useAppStore.getState().setLeftover(null);
    });
    expect(result.current).toBeNull();
  });
});

function stagePlace(stage: string): Place {
  return { kind: "stage", stage, step: 0 };
}

function stepPlace(step: number): Place {
  return { kind: "step", stage: "", step };
}

function reviewerPlace(step: number): Place {
  return { kind: "step_review", stage: "", step };
}

describe("marker request", () => {
  it("asks the conversation of a task to open a marker, until it is cleared", () => {
    useAppStore.getState().requestMarkerOpen("task-1", "plan_invalid");
    expect(useAppStore.getState().markerRequest).toEqual({
      taskId: "task-1",
      type: "plan_invalid",
    });

    useAppStore.getState().clearMarkerRequest();
    expect(useAppStore.getState().markerRequest).toBeNull();
  });
});

describe("open situation", () => {
  it("opens the task of a situation, the focus going to what it asks", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().openSituation(API_TASK.id, stagePlace("prd"));

    expect(location()).toEqual({ kind: "task", id: API_TASK.id });
    expect(useAppStore.getState().pendingFocus).toBe("request");
  });

  it("opens the reviewer tab of the step the situation is in", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));
    act(() => {
      useAppStore.getState().applyState(withSteps());
    });

    act(() => {
      useAppStore.getState().openSituation(WEB_TASK.id, reviewerPlace(1));
    });

    expect(location()).toEqual({ kind: "task", id: WEB_TASK.id });
    expect(result.current).toBe("reviewer");
  });

  it("opens the implementer tab for a situation of the step", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));
    act(() => {
      useAppStore.getState().applyState(withSteps());
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");
    });

    act(() => {
      useAppStore.getState().openSituation(WEB_TASK.id, stepPlace(1));
    });

    expect(result.current).toBe("implementer");
  });

  it("puts away the archived task", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().openSituation(WEB_TASK.id, stagePlace("prd"));

    expect(location()).toEqual({ kind: "task", id: WEB_TASK.id });
  });

  it("ignores an item that is no longer there", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openHistory();
    useAppStore.getState().openNewTask();

    useAppStore.getState().openSituation("task-gone", PR_PLACE);

    expect(location()).toEqual({ kind: "history" });
    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });
});

describe("flashing", () => {
  it("highlights situations and lets each one go on its own, in a new set every time", () => {
    const { result } = renderHook(() => useFlashing());
    const initial = result.current;
    expect(initial.size).toBe(0);

    act(() => {
      useAppStore.getState().flashSituation("s1");
      useAppStore.getState().flashSituation("s2");
    });
    expect([...result.current]).toEqual(["s1", "s2"]);
    expect(result.current).not.toBe(initial);

    const flashed = result.current;
    act(() => {
      useAppStore.getState().unflashSituation("s1");
    });
    expect([...result.current]).toEqual(["s2"]);
    expect(result.current).not.toBe(flashed);
    expect(flashed.has("s1")).toBe(true);
  });

  it("forgets the highlights once no repository is registered", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().flashSituation("s1");

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(useAppStore.getState().flashing.size).toBe(0);
  });
});

describe("situation on screen", () => {
  it("is none without an open task", () => {
    const { result } = renderHook(() => useOnScreenSituationId());

    act(() => {
      useAppStore
        .getState()
        .applyState(withTasks({ tasks: [{ ...WEB_TASK, situations: [makeSituation()] }] }));
    });

    expect(result.current).toBeNull();
  });

  it("is the situation of the stage the open task is in", () => {
    const { result } = renderHook(() => useOnScreenSituationId());

    act(() => {
      useAppStore.getState().applyState(
        withTasks({
          tasks: [
            {
              ...WEB_TASK,
              stage: "tech_spec",
              situations: [makeSituation({ id: "s-spec", place: stagePlace("tech_spec") })],
            },
          ],
        }),
      );
    });
    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().openTask(WEB_TASK.id);
    });
    expect(result.current).toBe("s-spec");
  });

  it("is the situation of the step that runs", () => {
    const { result } = renderHook(() => useOnScreenSituationId());

    act(() => {
      useAppStore.getState().applyState(
        withTasks({
          tasks: [
            {
              ...WEB_TASK,
              stage: "implementation",
              currentStep: 2,
              situations: [
                makeSituation({
                  id: "s-step",
                  kind: "step_review",
                  form: "review",
                  place: stepPlace(2),
                }),
              ],
            },
          ],
        }),
      );
      useAppStore.getState().openTask(WEB_TASK.id);
    });

    expect(result.current).toBe("s-step");
  });

  it("is the situation of the reviewer while its tab is selected", () => {
    const { result } = renderHook(() => useOnScreenSituationId());
    const situations = [
      makeSituation({ id: "s-step", kind: "permission", place: stepPlace(1) }),
      makeSituation({ id: "s-reviewer", kind: "question", place: reviewerPlace(1) }),
    ];

    act(() => {
      useAppStore.getState().applyState(withSteps({ situations }));
      useAppStore.getState().openTask(WEB_TASK.id);
    });
    expect(result.current).toBe("s-step");

    act(() => {
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");
    });
    expect(result.current).toBe("s-reviewer");
  });

  it("is the situation of the pull request, and none when it has none", () => {
    const { result } = renderHook(() => useOnScreenSituationId());
    const draft = makeSituation({ id: "s-draft", kind: "draft", place: PR_PLACE });

    act(() => {
      useAppStore
        .getState()
        .applyState(withPR(makePullRequest({ status: "draft_ready" }), [draft]));
      useAppStore.getState().openTask(WEB_TASK.id);
    });
    expect(result.current).toBe("s-draft");

    act(() => {
      useAppStore.getState().applyState(withPR(makePullRequest({ status: "drafting" })));
    });
    expect(result.current).toBeNull();
  });
});

describe("settings", () => {
  it("opens the settings in place of a task, the history and an archived task", () => {
    const { result } = renderHook(() => useSettingsUi());

    act(() => {
      useAppStore.getState().applyState(withTasks());
      useAppStore.getState().openTask(WEB_TASK.id);
      useAppStore.getState().openArchived(ARCHIVED.id);
      useAppStore.getState().openNewTask();
      useAppStore.getState().openSettings();
    });

    expect(result.current).toEqual({
      settingsOpen: true,
      settingsSection: "defaults",
      promptEdit: null,
      pendingLeave: null,
    });
    expect(location()).toEqual({ kind: "settings", section: "defaults" });

    act(() => {
      useAppStore.getState().closeSettings();
    });
    expect(result.current.settingsOpen).toBe(false);
  });

  it("gives the main area back to a task, the history or a place that opens", () => {
    useAppStore.getState().applyState(withTasks());

    for (const navigate of [
      () => useAppStore.getState().openTask(WEB_TASK.id),
      () => useAppStore.getState().openHistory(),
      () => useAppStore.getState().openArchived(ARCHIVED.id),
      () => useAppStore.getState().openSituation(WEB_TASK.id, stagePlace("prd")),
    ]) {
      useAppStore.getState().openSettings();

      navigate();

      expect(location().kind).not.toBe("settings");
    }
  });

  it("keeps the settings open while the repositories change", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openSettings();
    useAppStore.getState().selectSettingsSection("plan");
    useAppStore.getState().startPromptEdit("plan", "# Plan");

    useAppStore.getState().applyState(makeState({ repositories: [WEB], tasks: [WEB_TASK] }));

    expect(location()).toEqual({ kind: "settings", section: "plan" });
    expect(useAppStore.getState().promptEdit).toEqual({
      stage: "plan",
      original: "# Plan",
      text: "# Plan",
    });
  });

  it("closes the prompt editor without asking when nothing changed", () => {
    useAppStore.getState().openSettings();
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD");

    useAppStore.getState().selectSettingsSection("commit");

    expect(location()).toEqual({ kind: "settings", section: "commit" });
    expect(useAppStore.getState().promptEdit).toBeNull();
    expect(useAppStore.getState().pendingLeave).toBeNull();

    // With the editor closed there is no text to type into.
    useAppStore.getState().setPromptEditText("# Commit, edited");
    expect(useAppStore.getState().promptEdit).toBeNull();
  });

  it("holds a navigation while the prompt editor has unsaved changes", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openSettings();
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    useAppStore.getState().openTask(WEB_TASK.id);

    expect(useAppStore.getState().pendingLeave).not.toBeNull();
    expect(location()).toEqual({ kind: "settings", section: "defaults" });

    useAppStore.getState().cancelLeave();

    expect(useAppStore.getState().pendingLeave).toBeNull();
    expect(location()).toEqual({ kind: "settings", section: "defaults" });
    expect(useAppStore.getState().promptEdit?.text).toBe("# PRD, edited");

    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().confirmLeave();

    expect(location()).toEqual({ kind: "task", id: WEB_TASK.id });
    expect(useAppStore.getState().promptEdit).toBeNull();
    expect(useAppStore.getState().pendingLeave).toBeNull();
  });

  it("asks before cancelling an edit with changes", () => {
    useAppStore.getState().openSettings();
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    useAppStore.getState().cancelPromptEdit();

    expect(useAppStore.getState().pendingLeave).not.toBeNull();
    expect(useAppStore.getState().promptEdit?.text).toBe("# PRD, edited");

    useAppStore.getState().confirmLeave();

    expect(useAppStore.getState().promptEdit).toBeNull();
    expect(location().kind).toBe("settings");
  });

  it.each([
    ["Back", "back", () => useAppStore.getState().goBack()],
    ["Forward", "forward", () => useAppStore.getState().goForward()],
  ] as const)("asks before %s leaves an edit with changes", (_name, side, move) => {
    const settings: Location = { kind: "settings", section: "prd" };
    const task: Location = { kind: "task", id: WEB_TASK.id };
    useAppStore.getState().applyState(withTasks());
    useAppStore.setState({
      location: settings,
      back: side === "back" ? [task] : [],
      forward: side === "forward" ? [task] : [],
    });
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    move();

    expect(useAppStore.getState().pendingLeave).not.toBeNull();
    expect(location()).toEqual(settings);

    useAppStore.getState().confirmLeave();

    expect(location()).toEqual(task);
    expect(useAppStore.getState().promptEdit).toBeNull();
  });

  it.each([
    ["Back", () => useAppStore.getState().goBack()],
    ["Forward", () => useAppStore.getState().goForward()],
  ])("does not ask when %s has nowhere to go", (_name, move) => {
    const settings: Location = { kind: "settings", section: "prd" };
    useAppStore.getState().applyState(withTasks());
    useAppStore.setState({ location: settings, back: [], forward: [] });
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    move();

    expect(useAppStore.getState().pendingLeave).toBeNull();
    expect(location()).toEqual(settings);
    expect(useAppStore.getState().promptEdit?.text).toBe("# PRD, edited");
  });

  it("asks before closing the settings with an edit with changes", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().openSettings("prd");
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    useAppStore.getState().closeSettings();

    expect(useAppStore.getState().pendingLeave).not.toBeNull();
    expect(location()).toEqual({ kind: "settings", section: "prd" });

    useAppStore.getState().confirmLeave();

    expect(location()).toEqual({ kind: "task", id: WEB_TASK.id });
    expect(useAppStore.getState().promptEdit).toBeNull();
  });

  it("closes the editor after a save without asking", () => {
    useAppStore.getState().openSettings();
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    useAppStore.getState().finishPromptEdit();

    expect(useAppStore.getState().promptEdit).toBeNull();
    expect(useAppStore.getState().pendingLeave).toBeNull();
  });
});

describe("boards", () => {
  const ROADMAP = makeBoard();
  const OPS = makeBoard({ id: "board-2", title: "Ops", repositoryIds: [] });

  function withBoards(boards = [ROADMAP, OPS]) {
    return withTasks({ boards, history: [ARCHIVED] });
  }

  it("reports the boards of the snapshot", () => {
    const { result } = renderHook(() => ({
      boards: useBoards(),
      ops: useBoard("board-2"),
      unknown: useBoard("board-9"),
    }));

    expect(result.current.boards).toEqual([]);

    act(() => {
      useAppStore.getState().applyState(withBoards());
    });

    expect(result.current.boards).toEqual([ROADMAP, OPS]);
    expect(result.current.ops).toBe(OPS);
    expect(result.current.unknown).toBeNull();
  });

  it("reads a card in the last reading of its board, and says why when it can't", () => {
    const card = makeBoardCard();
    const { result } = renderHook(() => ({
      read: useBoardCard("board-1", card.key),
      outside: useBoardCard("board-1", "dev/web#99"),
      unread: useBoardCard("board-2", card.key),
      missing: useBoardCard("board-9", card.key),
    }));

    act(() => {
      useAppStore
        .getState()
        .applyState(withBoards([makeBoard({ cards: [card] }), { ...OPS, readAt: "" }]));
    });

    expect(result.current).toEqual({
      read: { board: "read", card },
      outside: { board: "read", card: null },
      unread: { board: "unread", card: null },
      missing: { board: "missing", card: null },
    });
  });

  it("opens a board view in place of a task, the history and the settings", () => {
    const { result } = renderHook(() => useOpenBoardId());

    for (const place of [
      () => useAppStore.getState().openTask(WEB_TASK.id),
      () => useAppStore.getState().openArchived(ARCHIVED.id),
      () => useAppStore.getState().openSettings(),
    ]) {
      act(() => {
        useAppStore.getState().applyState(withBoards());
        place();
        useAppStore.getState().openBoard("board-2");
      });

      expect(result.current).toBe("board-2");
      expect(location()).toEqual({ kind: "board", id: "board-2" });
    }
  });

  it("puts the board view away when another place opens", () => {
    useAppStore.getState().applyState(withBoards());

    for (const navigate of [
      () => useAppStore.getState().openTask(WEB_TASK.id),
      () => useAppStore.getState().openHistory(),
      () => useAppStore.getState().openArchived(ARCHIVED.id),
      () => useAppStore.getState().openSettings(),
      () => useAppStore.getState().openSituation(WEB_TASK.id, stagePlace("prd")),
    ]) {
      useAppStore.getState().openBoard("board-1");

      navigate();

      expect(location().kind).not.toBe("board");
    }
  });

  it("waits for the user to discard an unsaved prompt before opening a board", () => {
    useAppStore.getState().applyState(withBoards());
    useAppStore.getState().openSettings();
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    useAppStore.getState().openBoard("board-1");

    expect(location().kind).toBe("settings");

    useAppStore.getState().confirmLeave();

    expect(location()).toEqual({ kind: "board", id: "board-1" });
  });

  it("takes the view of a board that is gone off the screen", () => {
    useAppStore.getState().applyState(withBoards());
    useAppStore.getState().openBoard("board-2");

    useAppStore.getState().applyState(withBoards([OPS]));
    expect(location()).toEqual({ kind: "board", id: "board-2" });

    useAppStore.getState().applyState(withBoards([ROADMAP]));
    expect(location().kind).toBe("gone");
  });

  it("keeps the screen while a board is registered without any repository", () => {
    useAppStore.getState().applyState(makeState({ repositories: [], boards: [OPS] }));
    useAppStore.getState().openBoard("board-2");

    useAppStore.getState().applyState(makeState({ repositories: [], boards: [OPS] }));

    expect(location()).toEqual({ kind: "board", id: "board-2" });
  });

  it("clears the board view once no board and no repository is registered", () => {
    useAppStore.getState().applyState(withBoards());
    useAppStore.getState().openBoard("board-1");
    useAppStore
      .getState()
      .setPendingStart({ boardId: "board-1", key: "dev/web#12", repositoryId: "repo-1" });

    useAppStore.getState().applyState(makeState({ repositories: [], boards: [] }));

    expect(location()).toEqual(HOME);
    expect(useAppStore.getState().pendingStart).toBeNull();
  });

  it("opens the creation dialog for a card, and forgets the card on closing", () => {
    useAppStore.getState().openNewTask({ boardId: "board-1", key: "dev/web#12" });

    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(useAppStore.getState().newTaskCard).toEqual({ boardId: "board-1", key: "dev/web#12" });

    useAppStore.getState().closeNewTask();

    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().newTaskCard).toBeNull();

    useAppStore.getState().openNewTask({ boardId: "board-1", key: "dev/web#12" });
    useAppStore.getState().openNewTask();

    expect(useAppStore.getState().newTaskCard).toBeNull();
  });

  it("holds a card waiting for its clone", () => {
    const pending = { boardId: "board-1", key: "dev/web#12", repositoryId: "repo-1" };

    useAppStore.getState().setPendingStart(pending);
    expect(useAppStore.getState().pendingStart).toEqual(pending);

    useAppStore.getState().setPendingStart(null);
    expect(useAppStore.getState().pendingStart).toBeNull();
  });
});

describe("sidebar nodes", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("collapses and expands a node, and keeps what is collapsed", () => {
    const { result } = renderHook(() => useSidebarCollapsed());

    act(() => {
      useAppStore.getState().toggleSidebarNode("board-1");
      useAppStore.getState().toggleSidebarNode("epic-4");
    });

    expect([...result.current]).toEqual(["board-1", "epic-4"]);
    expect(JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) ?? "")).toEqual([
      "board-1",
      "epic-4",
    ]);

    act(() => {
      useAppStore.getState().toggleSidebarNode("board-1");
    });

    expect([...result.current]).toEqual(["epic-4"]);
    expect(JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) ?? "")).toEqual(["epic-4"]);
  });

  it("expands the nodes asked for and leaves the others collapsed", () => {
    useAppStore.getState().toggleSidebarNode("board-1");
    useAppStore.getState().toggleSidebarNode("epic-4");
    useAppStore.getState().toggleSidebarNode("epic-5");

    useAppStore.getState().expandSidebarNodes(["board-1", "epic-5", "epic-9"]);

    expect([...useAppStore.getState().sidebarCollapsed]).toEqual(["epic-4"]);
    expect(JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) ?? "")).toEqual(["epic-4"]);
  });

  it("changes nothing when the nodes asked for are already expanded", () => {
    useAppStore.getState().toggleSidebarNode("epic-4");
    const before = useAppStore.getState().sidebarCollapsed;

    useAppStore.getState().expandSidebarNodes(["board-1"]);

    expect(useAppStore.getState().sidebarCollapsed).toBe(before);
  });

  it("starts with the nodes collapsed in the last run", async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(["board-1"]));
    vi.resetModules();

    const fresh = await import("@/store/app-store");

    expect([...fresh.useAppStore.getState().sidebarCollapsed]).toEqual(["board-1"]);
  });
});

const REVIEW = makeReviewSummary({ id: "review-1" });
const OTHER_REVIEW = makeReviewSummary({ id: "review-2", number: 32, title: "Fix the header" });
const ARCHIVED_REVIEW = makeArchivedReview({ id: "review-1" });
const REVIEW_PLACE: Place = { kind: "review", stage: "", step: 0 };

// REVIEW_KEY is the conversation of a review: a review has the one stage.
const REVIEW_KEY = sessionKey(REVIEW.id, "review");

function withReviews(overrides = {}) {
  return withTasks({ reviews: [REVIEW, OTHER_REVIEW], ...overrides });
}

describe("reviews", () => {
  it("report the reviews of the snapshot, and nothing before the first one", () => {
    const { result } = renderHook(() => ({
      center: useReviewCenter(),
      review: useReview(REVIEW.id),
      missing: useReview("review-gone"),
      history: useReviewHistory(),
      archived: useArchivedReview(ARCHIVED_REVIEW.id),
    }));

    expect(result.current.center.pendingCount).toBe(0);
    expect(result.current.center.pullRequests).toEqual([]);
    expect(result.current.review).toBeNull();
    expect(result.current.history).toEqual([]);

    act(() => {
      useAppStore.getState().applyState(
        withReviews({
          reviewCenter: makeReviewCenter({ pendingCount: 2 }),
          reviewHistory: [ARCHIVED_REVIEW],
        }),
      );
    });

    expect(result.current.center.pendingCount).toBe(2);
    expect(result.current.review).toEqual(REVIEW);
    expect(result.current.missing).toBeNull();
    expect(result.current.archived).toEqual(ARCHIVED_REVIEW);
  });

  it("falls back to no review when the snapshot carries none", () => {
    const { result } = renderHook(() => ({
      review: useReview(REVIEW.id),
      history: useReviewHistory(),
    }));

    act(() => {
      useAppStore.getState().applyState(withTasks({ reviews: null, reviewHistory: null }));
    });

    expect(result.current.review).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it("opens the Reviews view in place of a task and then a review", () => {
    const { result } = renderHook(() => ({
      open: useReviewsOpen(),
      openId: useOpenItemId(),
    }));

    act(() => {
      useAppStore.getState().applyState(withReviews());
      useAppStore.getState().openTask(WEB_TASK.id);
      useAppStore.getState().openReviews();
    });
    expect(result.current).toEqual({ open: true, openId: null });
    expect(location()).toEqual({ kind: "reviews" });

    act(() => {
      useAppStore.getState().openReview(REVIEW.id);
    });
    expect(result.current).toEqual({ open: false, openId: REVIEW.id });
  });

  it("opens an archived review inside the history", () => {
    act(() => {
      useAppStore.getState().applyState(withReviews({ reviewHistory: [ARCHIVED_REVIEW] }));
      useAppStore.getState().openReview(REVIEW.id);
      useAppStore.getState().openArchivedReview(ARCHIVED_REVIEW.id);
    });
    expect(location()).toEqual({ kind: "archived-review", id: ARCHIVED_REVIEW.id });
  });

  it.each([
    ["a task", () => useAppStore.getState().openTask(WEB_TASK.id)],
    [
      "the situation of a task",
      () => useAppStore.getState().openSituation(WEB_TASK.id, stagePlace("prd")),
    ],
    ["a board", () => useAppStore.getState().openBoard("board-1")],
    ["the history", () => useAppStore.getState().openHistory()],
    ["an archived task", () => useAppStore.getState().openArchived(ARCHIVED.id)],
    ["the settings", () => useAppStore.getState().openSettings()],
  ])("leaves the review places behind when %s opens", (_name, navigate) => {
    useAppStore.getState().applyState(withReviews({ history: [ARCHIVED] }));
    useAppStore.getState().openReview(REVIEW.id);

    navigate();

    expect(["review", "reviews", "archived-review"]).not.toContain(location().kind);
  });

  it("closes the screen of a review that is gone and drops its conversation", () => {
    useAppStore.getState().applyState(withReviews());
    useAppStore.getState().openReview(REVIEW.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: REVIEW.id, stage: "review" }));

    useAppStore.getState().applyState(withReviews({ reviews: [OTHER_REVIEW] }));

    expect(location().kind).toBe("gone");
    expect(useAppStore.getState().transcripts[REVIEW_KEY]).toBeUndefined();
  });

  it("closes an archived review that is no longer in the history", () => {
    useAppStore.getState().applyState(withReviews({ reviewHistory: [ARCHIVED_REVIEW] }));
    useAppStore.getState().openArchivedReview(ARCHIVED_REVIEW.id);

    useAppStore.getState().applyState(withReviews({ reviewHistory: [] }));

    expect(location()).toEqual({ kind: "history" });
  });

  it("forgets the review screens once no repository is registered", () => {
    useAppStore.getState().applyState(withReviews());
    useAppStore.getState().openReview(REVIEW.id);

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(location()).toEqual(HOME);
  });

  it("opens the dialog that starts a review, and keeps the pull request waiting for a clone", () => {
    const { result } = renderHook(() => useStartReview());
    const pull = { repositoryId: "repo-1", number: 31 };

    act(() => {
      useAppStore.getState().openStartReview(pull);
    });
    expect(result.current).toEqual(pull);

    act(() => {
      useAppStore.getState().setPendingReview(pull);
      useAppStore.getState().closeStartReview();
    });
    expect(result.current).toBeNull();
    expect(useAppStore.getState().pendingReview).toEqual(pull);

    act(() => {
      useAppStore.getState().setPendingReview(null);
    });
    expect(useAppStore.getState().pendingReview).toBeNull();
  });

  it("keeps the text of a finding the user is editing until it is cleared", () => {
    const key = `${REVIEW.id}|1|2`;
    const { result } = renderHook(() => useTextDraft(key));

    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().setTextDraft(key, { text: "half a note", revision: 1 });
    });
    expect(result.current).toEqual({ text: "half a note", revision: 1 });

    act(() => {
      useAppStore.getState().clearTextDraft(key);
    });
    expect(result.current).toBeNull();
  });

  it("opens the review a situation is in, and ignores one that is gone", () => {
    useAppStore.getState().applyState(withReviews());

    useAppStore.getState().openSituation("review-gone", REVIEW_PLACE);
    expect(location()).toEqual(HOME);

    useAppStore.getState().openSituation(REVIEW.id, REVIEW_PLACE);
    expect(location()).toEqual({ kind: "review", id: REVIEW.id });
    expect(useAppStore.getState().pendingFocus).toBe("title");
  });

  it("is the situation of the open review on screen", () => {
    const { result } = renderHook(() => useOnScreenSituationId());
    const situation = makeSituation({
      id: "s-report",
      taskId: REVIEW.id,
      kind: "review_report",
      form: "decide",
      place: REVIEW_PLACE,
    });

    act(() => {
      useAppStore
        .getState()
        .applyState(withReviews({ reviews: [{ ...REVIEW, situations: [situation] }] }));
    });
    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().openReview(REVIEW.id);
    });
    expect(result.current).toBe("s-report");
  });
});

const BOARD = makeBoard();
const DISCUSSION = makeDiscussion({ id: "discussion-1" });
const OTHER_DISCUSSION = makeDiscussion({ id: "discussion-2", title: "Billing" });
const ARCHIVED_DISCUSSION = makeArchivedDiscussion({ id: "discussion-1" });
const DISCUSSION_PLACE: Place = { kind: "discussion", stage: "", step: 0 };

// DISCUSSION_KEY is the conversation of a discussion: a discussion has the one stage.
const DISCUSSION_KEY = sessionKey(DISCUSSION.id, "discussion");

function withDiscussions(overrides = {}) {
  return withTasks({
    boards: [BOARD],
    discussions: [DISCUSSION, OTHER_DISCUSSION],
    ...overrides,
  });
}

describe("discussions", () => {
  it("report the discussions of the snapshot, and nothing before the first one", () => {
    const { result } = renderHook(() => ({
      discussions: useDiscussions(),
      discussion: useDiscussion(DISCUSSION.id),
      missing: useDiscussion("discussion-gone"),
      history: useDiscussionHistory(),
      archived: useArchivedDiscussion(ARCHIVED_DISCUSSION.id),
    }));

    expect(result.current.discussions).toEqual([]);
    expect(result.current.discussion).toBeNull();
    expect(result.current.history).toEqual([]);

    act(() => {
      useAppStore
        .getState()
        .applyState(withDiscussions({ discussionHistory: [ARCHIVED_DISCUSSION] }));
    });

    expect(result.current.discussions).toEqual([DISCUSSION, OTHER_DISCUSSION]);
    expect(result.current.discussion).toEqual(DISCUSSION);
    expect(result.current.missing).toBeNull();
    expect(result.current.archived).toEqual(ARCHIVED_DISCUSSION);
  });

  it("falls back to no discussion when the snapshot carries none", () => {
    const { result } = renderHook(() => ({
      discussions: useDiscussions(),
      history: useDiscussionHistory(),
    }));

    act(() => {
      useAppStore.getState().applyState(withTasks({ discussions: null, discussionHistory: null }));
    });

    expect(result.current.discussions).toEqual([]);
    expect(result.current.history).toEqual([]);
  });

  it("opens a discussion in place of a task", () => {
    const { result } = renderHook(() => ({
      openId: useOpenItemId(),
      boardId: useOpenBoardId(),
    }));

    act(() => {
      useAppStore.getState().applyState(withDiscussions());
      useAppStore.getState().openTask(WEB_TASK.id);
      useAppStore.getState().openDiscussion(DISCUSSION.id);
    });
    expect(result.current).toEqual({ openId: DISCUSSION.id, boardId: null });
    expect(location()).toEqual({ kind: "discussion", id: DISCUSSION.id });
  });

  it("opens an archived discussion inside the history", () => {
    act(() => {
      useAppStore
        .getState()
        .applyState(withDiscussions({ discussionHistory: [ARCHIVED_DISCUSSION] }));
      useAppStore.getState().openDiscussion(DISCUSSION.id);
      useAppStore.getState().openArchivedDiscussion(ARCHIVED_DISCUSSION.id);
    });
    expect(location()).toEqual({ kind: "archived-discussion", id: ARCHIVED_DISCUSSION.id });
  });

  it.each([
    ["a task", () => useAppStore.getState().openTask(WEB_TASK.id)],
    [
      "the situation of a task",
      () => useAppStore.getState().openSituation(WEB_TASK.id, stagePlace("prd")),
    ],
    ["a board", () => useAppStore.getState().openBoard(BOARD.id)],
    ["the history", () => useAppStore.getState().openHistory()],
    ["an archived task", () => useAppStore.getState().openArchived(ARCHIVED.id)],
    ["the settings", () => useAppStore.getState().openSettings()],
    ["the Reviews view", () => useAppStore.getState().openReviews()],
  ])("leaves the discussion screens behind when %s opens", (_name, navigate) => {
    useAppStore.getState().applyState(withDiscussions({ history: [ARCHIVED] }));
    useAppStore.getState().openDiscussion(DISCUSSION.id);

    navigate();

    expect(["discussion", "archived-discussion"]).not.toContain(location().kind);
  });

  it("closes the screen of a discussion that is gone and drops its conversation", () => {
    useAppStore.getState().applyState(withDiscussions());
    useAppStore.getState().openDiscussion(DISCUSSION.id);
    useAppStore
      .getState()
      .setTranscript(makeTranscript({ taskId: DISCUSSION.id, stage: "discussion" }));

    useAppStore.getState().applyState(withDiscussions({ discussions: [OTHER_DISCUSSION] }));

    expect(location().kind).toBe("gone");
    expect(useAppStore.getState().transcripts[DISCUSSION_KEY]).toBeUndefined();
  });

  it("closes an archived discussion that is no longer in the history", () => {
    useAppStore
      .getState()
      .applyState(withDiscussions({ discussionHistory: [ARCHIVED_DISCUSSION] }));
    useAppStore.getState().openArchivedDiscussion(ARCHIVED_DISCUSSION.id);

    useAppStore.getState().applyState(withDiscussions({ discussionHistory: [] }));

    expect(location()).toEqual({ kind: "history" });
  });

  it("forgets the discussion screens once no repository and no board is registered", () => {
    useAppStore.getState().applyState(withDiscussions());
    useAppStore.getState().openDiscussion(DISCUSSION.id);

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(location()).toEqual(HOME);
  });

  it("opens and closes the dialog that creates a discussion", () => {
    const { result } = renderHook(() => useNewDiscussion());
    const ref = { boardId: BOARD.id, cardKeys: ["dev/web#12"], askBoard: false };

    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().openNewDiscussion(ref);
    });
    expect(result.current).toEqual(ref);

    act(() => {
      useAppStore.getState().closeNewDiscussion();
    });
    expect(result.current).toBeNull();
  });

  it("opens the discussion a situation is in, and ignores one that is gone", () => {
    useAppStore.getState().applyState(withDiscussions());

    useAppStore.getState().openSituation("discussion-gone", DISCUSSION_PLACE);
    expect(location()).toEqual(HOME);

    useAppStore.getState().openSituation(DISCUSSION.id, DISCUSSION_PLACE);
    expect(location()).toEqual({ kind: "discussion", id: DISCUSSION.id });
    expect(useAppStore.getState().pendingFocus).toBe("title");
  });

  it("is the situation of the open discussion on screen", () => {
    const { result } = renderHook(() => useOnScreenSituationId());
    const situation = makeSituation({
      id: "s-drafts",
      taskId: DISCUSSION.id,
      kind: "drafts",
      form: "decide",
      place: DISCUSSION_PLACE,
    });

    act(() => {
      useAppStore
        .getState()
        .applyState(withDiscussions({ discussions: [{ ...DISCUSSION, situations: [situation] }] }));
    });
    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().openDiscussion(DISCUSSION.id);
    });
    expect(result.current).toBe("s-drafts");
  });
});

describe("selectors of the place on screen", () => {
  const SPEC_TASK = {
    ...WEB_TASK,
    stage: "tech_spec",
    situations: [makeSituation({ id: "s-spec", place: stagePlace("tech_spec") })],
  };
  const REVIEW_WITH_SITUATION = {
    ...REVIEW,
    situations: [
      makeSituation({
        id: "s-report",
        taskId: REVIEW.id,
        kind: "review_report",
        form: "decide",
        place: REVIEW_PLACE,
      }),
    ],
  };
  const DISCUSSION_WITH_SITUATION = {
    ...DISCUSSION,
    situations: [
      makeSituation({
        id: "s-drafts",
        taskId: DISCUSSION.id,
        kind: "drafts",
        form: "decide",
        place: DISCUSSION_PLACE,
      }),
    ],
  };

  interface Expected {
    task: string | null;
    item: string | null;
    board: string | null;
    reviews: boolean;
    history: { historyOpen: boolean; openArchivedId: string | null };
    settings: { settingsOpen: boolean; settingsSection: string };
    situation: string | null;
  }

  const NONE: Expected = {
    task: null,
    item: null,
    board: null,
    reviews: false,
    history: { historyOpen: false, openArchivedId: null },
    settings: { settingsOpen: false, settingsSection: "defaults" },
    situation: null,
  };
  const IN_HISTORY = { historyOpen: true, openArchivedId: null };

  it.each<[Location, Expected]>([
    [HOME, NONE],
    [
      { kind: "board", id: BOARD.id },
      { ...NONE, board: BOARD.id },
    ],
    [{ kind: "reviews" }, { ...NONE, reviews: true }],
    [{ kind: "history" }, { ...NONE, history: IN_HISTORY }],
    [
      { kind: "settings", section: "plan" },
      { ...NONE, settings: { settingsOpen: true, settingsSection: "plan" } },
    ],
    [
      { kind: "task", id: WEB_TASK.id },
      { ...NONE, task: WEB_TASK.id, item: WEB_TASK.id, situation: "s-spec" },
    ],
    [
      { kind: "review", id: REVIEW.id },
      { ...NONE, item: REVIEW.id, situation: "s-report" },
    ],
    [
      { kind: "discussion", id: DISCUSSION.id },
      { ...NONE, item: DISCUSSION.id, situation: "s-drafts" },
    ],
    [
      { kind: "archived-task", id: ARCHIVED.id },
      { ...NONE, history: { historyOpen: true, openArchivedId: ARCHIVED.id } },
    ],
    [
      { kind: "archived-review", id: ARCHIVED_REVIEW.id },
      { ...NONE, history: IN_HISTORY },
    ],
    [
      { kind: "archived-discussion", id: ARCHIVED_DISCUSSION.id },
      { ...NONE, history: IN_HISTORY },
    ],
  ])("reads %o as the screens it stands for", (place, expected) => {
    useAppStore.getState().applyState(
      withTasks({
        tasks: [SPEC_TASK],
        boards: [BOARD],
        reviews: [REVIEW_WITH_SITUATION],
        discussions: [DISCUSSION_WITH_SITUATION],
      }),
    );
    useAppStore.setState({ location: place });

    const { result } = renderHook(() => ({
      task: useOpenTaskId(),
      item: useOpenItemId(),
      board: useOpenBoardId(),
      reviews: useReviewsOpen(),
      history: useHistoryUi(),
      settings: useSettingsUi(),
      situation: useOnScreenSituationId(),
    }));

    expect(result.current).toEqual({
      ...expected,
      history: { ...expected.history, historyQuery: "" },
      settings: { ...expected.settings, promptEdit: null, pendingLeave: null },
    });
  });
});

describe("navigation", () => {
  const TASK: Location = { kind: "task", id: WEB_TASK.id };
  const OTHER_TASK: Location = { kind: "task", id: API_TASK.id };
  const HISTORY: Location = { kind: "history" };

  function withEverything(overrides = {}) {
    return withTasks({ boards: [BOARD], history: [ARCHIVED], ...overrides });
  }

  it("puts the current place behind the new one", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.getState().go(TASK);

    useAppStore.getState().go(HISTORY);

    expect(useAppStore.getState().back).toEqual([HOME, TASK]);
    expect(location()).toEqual(HISTORY);
  });

  it("drops the places ahead when it goes somewhere new", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.setState({ location: TASK, back: [HOME], forward: [HISTORY] });

    useAppStore.getState().go(OTHER_TASK);

    expect(useAppStore.getState().forward).toEqual([]);
    expect(useAppStore.getState().back).toEqual([HOME, TASK]);
  });

  it("does not stack the place already on screen", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.getState().go(TASK);

    useAppStore.getState().go(TASK);

    expect(useAppStore.getState().back).toEqual([HOME]);
  });

  it("changes the page of the settings without stacking", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.getState().openSettings();

    useAppStore.getState().selectSettingsSection("plan");

    expect(location()).toEqual({ kind: "settings", section: "plan" });
    expect(useAppStore.getState().back).toEqual([HOME]);
  });

  it("never stacks the page of an item that left", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.setState({
      location: { kind: "gone", item: "task", id: "task-old", name: "old", boardId: "" },
      back: [HOME],
    });

    useAppStore.getState().go(TASK);

    expect(useAppStore.getState().back).toEqual([HOME]);
  });

  it("keeps at most NAV_LIMIT places behind", () => {
    useAppStore.getState().applyState(withEverything());
    const behind: Location[] = Array.from({ length: NAV_LIMIT }, (_, index) => ({
      kind: "task",
      id: `task-${index}`,
    }));
    useAppStore.setState({ location: TASK, back: behind });

    useAppStore.getState().go(HISTORY);

    const { back } = useAppStore.getState();
    expect(back).toHaveLength(NAV_LIMIT);
    expect(back[0]).toEqual({ kind: "task", id: "task-1" });
    expect(back.at(-1)).toEqual(TASK);
  });

  it("stays on Home when there is no task", () => {
    useAppStore
      .getState()
      .applyState(makeState({ repositories: [WEB], tasks: [], boards: [BOARD] }));
    useAppStore.getState().openHistory();

    useAppStore.getState().go(HOME);

    expect(location()).toEqual(HOME);
  });

  it("closes the panel of the place it leaves", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.setState({ location: TASK, panel: "artifacts" });

    useAppStore.getState().go(HISTORY);

    expect(useAppStore.getState().panel).toBeNull();
  });

  it("closes the settings back to the place they were opened from", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().openSettings();

    useAppStore.getState().closeSettings();

    expect(location()).toEqual(TASK);
    expect(useAppStore.getState().pendingFocus).toBe("title");
  });

  it("closes the settings to Home when there is no place behind them", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.setState({ location: { kind: "settings", section: "defaults" }, back: [] });

    useAppStore.getState().closeSettings();

    expect(location()).toEqual(HOME);
  });

  it("closes the settings past the places behind them that no longer exist", () => {
    useAppStore.getState().applyState(withEverything());
    const settings: Location = { kind: "settings", section: "defaults" };
    useAppStore.setState({ location: settings, back: [TASK, { kind: "task", id: "task-gone" }] });

    useAppStore.getState().closeSettings();

    expect(useAppStore.getState()).toMatchObject({ location: TASK, back: [], forward: [settings] });
  });

  it("offers as Back and Forward only places that still exist", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.setState({
      location: HISTORY,
      back: [TASK, { kind: "task", id: "task-gone" }],
      forward: [OTHER_TASK, { kind: "board", id: "board-gone" }],
    });

    const { result } = renderHook(() => ({ back: useBackTarget(), forward: useForwardTarget() }));

    expect(result.current).toEqual({ back: TASK, forward: OTHER_TASK });
  });

  it("offers no Back and no Forward when nothing behind or ahead exists", () => {
    useAppStore.getState().applyState(withEverything());
    useAppStore.setState({ back: [{ kind: "task", id: "task-gone" }], forward: [] });

    const { result } = renderHook(() => ({ back: useBackTarget(), forward: useForwardTarget() }));

    expect(result.current).toEqual({ back: null, forward: null });
  });
});

describe("history of places", () => {
  const TASK: Location = { kind: "task", id: WEB_TASK.id };
  const OTHER_TASK: Location = { kind: "task", id: API_TASK.id };
  const HISTORY: Location = { kind: "history" };
  const GONE: Location = { kind: "gone", item: "task", id: "task-old", name: "old", boardId: "" };

  beforeEach(() => {
    useAppStore.getState().applyState(withTasks({ boards: [BOARD], history: [ARCHIVED] }));
  });

  it("goes back to the place behind and keeps the current one ahead", () => {
    useAppStore.setState({ location: HISTORY, back: [HOME, TASK], forward: [] });

    useAppStore.getState().goBack({ focus: "back" });

    expect(useAppStore.getState()).toMatchObject({
      location: TASK,
      back: [HOME],
      forward: [HISTORY],
      pendingFocus: "back",
    });
  });

  it("goes forward to the place ahead and keeps the current one behind", () => {
    useAppStore.setState({ location: HOME, back: [], forward: [HISTORY, TASK] });

    useAppStore.getState().goForward({ focus: "forward" });

    expect(useAppStore.getState()).toMatchObject({
      location: TASK,
      back: [HOME],
      forward: [HISTORY],
      pendingFocus: "forward",
    });
  });

  it("goes back past the places that no longer exist", () => {
    useAppStore.setState({
      location: HISTORY,
      back: [TASK, { kind: "task", id: "task-gone" }],
      forward: [],
    });

    useAppStore.getState().goBack();

    expect(useAppStore.getState()).toMatchObject({ location: TASK, back: [], forward: [HISTORY] });
  });

  it("goes forward past the places that no longer exist", () => {
    useAppStore.setState({
      location: HOME,
      back: [],
      forward: [OTHER_TASK, { kind: "board", id: "board-gone" }],
    });

    useAppStore.getState().goForward();

    expect(useAppStore.getState()).toMatchObject({
      location: OTHER_TASK,
      back: [HOME],
      forward: [],
    });
  });

  it("does nothing going back with no place behind that exists", () => {
    useAppStore.setState({ location: TASK, back: [{ kind: "task", id: "task-gone" }] });

    useAppStore.getState().goBack();

    expect(useAppStore.getState()).toMatchObject({
      location: TASK,
      back: [{ kind: "task", id: "task-gone" }],
      forward: [],
    });
  });

  it("never keeps the page of an item that left ahead of the one it goes back to", () => {
    useAppStore.setState({ location: GONE, back: [TASK], forward: [] });

    useAppStore.getState().goBack();

    expect(useAppStore.getState()).toMatchObject({ location: TASK, back: [], forward: [] });
  });

  it("closes the panel going back", () => {
    useAppStore.setState({ location: TASK, back: [HISTORY], panel: "reports" });

    useAppStore.getState().goBack();

    expect(useAppStore.getState().panel).toBeNull();
  });

  it("opens a panel, closes it on the next navigation and never reopens it going back", () => {
    useAppStore.setState({ location: TASK, back: [], forward: [], panel: null });

    useAppStore.getState().openPanel("artifacts");
    expect(useAppStore.getState().panel).toBe("artifacts");

    useAppStore.getState().go(HISTORY);
    expect(useAppStore.getState().panel).toBeNull();

    useAppStore.getState().goBack();
    expect(useAppStore.getState()).toMatchObject({ location: TASK, panel: null });
  });

  it("opens a panel at a document until the panel takes it, and a plain opening asks for none", () => {
    useAppStore.setState({ location: TASK, panel: null, panelDocument: null });

    useAppStore.getState().openPanelAt("details", "step-reviews/3-1.md");
    expect(useAppStore.getState()).toMatchObject({
      panel: "details",
      panelDocument: "step-reviews/3-1.md",
    });

    useAppStore.getState().clearPanelDocument();
    expect(useAppStore.getState()).toMatchObject({ panel: "details", panelDocument: null });

    useAppStore.getState().openPanelAt("artifacts", "PRD.md");
    useAppStore.getState().openPanel("details");
    expect(useAppStore.getState()).toMatchObject({ panel: "details", panelDocument: null });
  });

  it("clears the focus it asked for", () => {
    useAppStore.setState({ pendingFocus: "title" });

    useAppStore.getState().clearPendingFocus();

    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("says the same announcement again with a new id", () => {
    useAppStore.getState().announce("Nothing else needs you now.");
    const first = useAppStore.getState().announcement;

    useAppStore.getState().announce("Nothing else needs you now.");

    expect(useAppStore.getState().announcement).toEqual({
      id: (first?.id ?? 0) + 1,
      text: "Nothing else needs you now.",
    });
  });
});

describe("kept places", () => {
  const TASK: Location = { kind: "task", id: WEB_TASK.id };
  const HISTORY: Location = { kind: "history" };

  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().applyState(withTasks({ boards: [BOARD], history: [ARCHIVED] }));
  });

  it("reopens with Home on screen and the places of the last run behind it", () => {
    useAppStore.getState().go(TASK);
    useAppStore.getState().go(HISTORY);

    expect(initialNav()).toEqual({ location: HOME, back: [HOME, TASK, HISTORY], forward: [] });
  });

  it("does not repeat Home behind Home when the last run ended on it", () => {
    useAppStore.getState().go(TASK);
    useAppStore.getState().go(HOME);

    expect(initialNav()).toEqual({ location: HOME, back: [HOME, TASK], forward: [] });
  });

  it("keeps neither the page of an item that left nor the places ahead", () => {
    const gone: Location = { kind: "gone", item: "task", id: "task-old", name: "old", boardId: "" };
    useAppStore.setState({ location: gone, back: [TASK, gone], forward: [HISTORY] });

    expect(initialNav()).toEqual({ location: HOME, back: [TASK], forward: [] });
  });

  it("reopens with at most NAV_LIMIT places behind", () => {
    const behind: Location[] = Array.from({ length: NAV_LIMIT }, (_, index) => ({
      kind: "task",
      id: `task-${index}`,
    }));
    useAppStore.setState({ location: HISTORY, back: behind });

    const { back } = initialNav();

    expect(back).toHaveLength(NAV_LIMIT);
    expect(back.at(-1)).toEqual(HISTORY);
  });

  it.each([
    ["nothing kept", null],
    ["not JSON", "{"],
    ["no current place", JSON.stringify({ back: [] })],
    ["an unknown place", JSON.stringify({ back: [{ kind: "nowhere" }], current: HOME })],
  ])("opens with nothing behind on %s", (_, raw) => {
    if (raw !== null) {
      localStorage.setItem(NAV_STACK_KEY, raw);
    }

    expect(initialNav()).toEqual({ location: HOME, back: [], forward: [] });
  });

  it("keeps the last active item opened", () => {
    useAppStore.getState().go(TASK);
    useAppStore.getState().go(HISTORY);

    expect(readLastItem()).toEqual(TASK);
  });

  it.each([
    ["nothing kept", null],
    ["a place that is not an active item", JSON.stringify(HISTORY)],
    ["an unknown place", JSON.stringify({ kind: "nowhere" })],
  ])("has no last item with %s", (_, raw) => {
    if (raw !== null) {
      localStorage.setItem(LAST_ITEM_KEY, raw);
    }

    expect(readLastItem()).toBeNull();
  });

  it("keeps the sidebar collapsed into its strip", () => {
    useAppStore.getState().toggleSidebarRail();

    expect(useAppStore.getState().sidebarRail).toBe(true);
    expect(localStorage.getItem(SIDEBAR_RAIL_KEY)).toBe("true");
  });
});

describe("place in a new snapshot", () => {
  it("leaves an archived task that is gone for the history", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);
    const { back } = useAppStore.getState();

    useAppStore.getState().applyState(withTasks({ history: [] }));

    expect(location()).toEqual({ kind: "history" });
    expect(useAppStore.getState().back).toBe(back);
  });

  it("puts the page of a review that left in its place, named by its reference", () => {
    useAppStore.getState().applyState(withReviews());
    useAppStore.getState().openReview(REVIEW.id);
    const { back } = useAppStore.getState();

    useAppStore
      .getState()
      .applyState(withReviews({ reviews: [OTHER_REVIEW], reviewHistory: [ARCHIVED_REVIEW] }));

    expect(location()).toEqual({
      kind: "gone",
      item: "review",
      id: REVIEW.id,
      name: `web#${REVIEW.number}`,
      boardId: "",
    });
    expect(useAppStore.getState().back).toBe(back);
  });

  it("puts the page of a discussion that left in its place, with its board", () => {
    useAppStore.getState().applyState(withDiscussions());
    useAppStore.getState().openDiscussion(DISCUSSION.id);

    useAppStore.getState().applyState(withDiscussions({ discussions: [OTHER_DISCUSSION] }));

    expect(location()).toEqual({
      kind: "gone",
      item: "discussion",
      id: DISCUSSION.id,
      name: DISCUSSION.title,
      boardId: DISCUSSION.boardId,
    });
  });

  it("puts the page of a task that left in its place, with the board of its repository", () => {
    const repository = { ...WEB, boardId: BOARD.id };
    useAppStore
      .getState()
      .applyState(withTasks({ repositories: [repository, API], boards: [BOARD] }));
    useAppStore.getState().openTask(WEB_TASK.id);

    useAppStore
      .getState()
      .applyState(
        withTasks({ repositories: [repository, API], boards: [BOARD], tasks: [API_TASK] }),
      );

    expect(location()).toEqual({
      kind: "gone",
      item: "task",
      id: WEB_TASK.id,
      name: WEB_TASK.name,
      boardId: BOARD.id,
    });
  });

  it("puts the page of a task without a board in its place", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(location()).toEqual({
      kind: "gone",
      item: "task",
      id: WEB_TASK.id,
      name: WEB_TASK.name,
      boardId: "",
    });
  });

  it("puts the page of a board that was removed in its place", () => {
    useAppStore.getState().applyState(withTasks({ boards: [BOARD] }));
    useAppStore.getState().openBoard(BOARD.id);

    useAppStore.getState().applyState(withTasks({ boards: [] }));

    expect(location()).toEqual({
      kind: "gone",
      item: "board",
      id: BOARD.id,
      name: BOARD.title,
      boardId: "",
    });
  });

  it("announces the page of an item that left on its own", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(useAppStore.getState().announcement?.text).toBe(`${WEB_TASK.name} was deleted`);
  });

  it("does not announce the page of the item the user asked to remove", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.setState({ expectGone: WEB_TASK.id });

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(useAppStore.getState().announcement).toBeNull();
    expect(useAppStore.getState().expectGone).toBeNull();
  });

  it("keeps an item that was not in the previous snapshot", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask("task-new");

    useAppStore.getState().applyState(withTasks());

    expect(location()).toEqual({ kind: "task", id: "task-new" });
    expect(useAppStore.getState().announcement).toBeNull();
  });

  it("shows Home at start when there is no task", () => {
    useAppStore
      .getState()
      .applyState(makeState({ repositories: [WEB], tasks: [], boards: [BOARD] }));

    expect(location()).toEqual(HOME);
  });

  it("closes the panel when the place on screen changes", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.setState({ panel: "reports" });

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(useAppStore.getState().panel).toBeNull();
  });

  it("goes Home on the welcome screen and keeps the places behind and ahead", () => {
    useAppStore.getState().applyState(withTasks());
    const back: Location[] = [HOME];
    const forward: Location[] = [{ kind: "history" }];
    useAppStore.setState({ location: { kind: "task", id: WEB_TASK.id }, back, forward });

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(location()).toEqual(HOME);
    expect(useAppStore.getState().back).toBe(back);
    expect(useAppStore.getState().forward).toBe(forward);
  });
});

describe("places beside the one on screen", () => {
  const BOARD_PLACE: Location = { kind: "board", id: BOARD.id };

  beforeEach(() => {
    localStorage.clear();
  });

  it("does not keep behind a board the board the page of an item that left opens", () => {
    useAppStore.getState().applyState(withTasks({ boards: [BOARD] }));
    useAppStore.getState().openBoard(BOARD.id);
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().applyState(withTasks({ boards: [BOARD], tasks: [API_TASK] }));
    expect(location().kind).toBe("gone");

    useAppStore.getState().go(BOARD_PLACE);

    expect(useAppStore.getState()).toMatchObject({
      location: BOARD_PLACE,
      back: [HOME],
      forward: [],
    });
    const { result } = renderHook(() => useBackTarget());
    expect(result.current).toEqual(HOME);
  });

  it("closes the settings opened from the page of an item that left to the place before them", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openSettings();
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    useAppStore.getState().openSettings();

    expect(useAppStore.getState().back).toEqual([HOME]);

    useAppStore.getState().closeSettings();

    expect(location()).toEqual(HOME);
  });

  it("does not offer the board on screen behind a task that left after it", () => {
    useAppStore.getState().applyState(withTasks({ boards: [BOARD] }));
    useAppStore.getState().openBoard(BOARD.id);
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().openBoard(BOARD.id);
    useAppStore.getState().applyState(withTasks({ boards: [BOARD], tasks: [API_TASK] }));
    const { result } = renderHook(() => useBackTarget());
    expect(result.current).toEqual(HOME);

    useAppStore.getState().goBack();

    expect(useAppStore.getState()).toMatchObject({
      location: HOME,
      back: [],
      forward: [BOARD_PLACE],
    });
  });

  it("closes the settings reopened from a task that left while they were open", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openSettings();
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().openSettings();
    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    useAppStore.getState().closeSettings();

    expect(location()).toEqual(HOME);
  });
});

describe("earlier conversation", () => {
  // READ_TASK is the web task on its tech spec, with the PRD conversation behind it.
  const READ_TASK = makeTask({
    ...WEB_TASK,
    stage: "tech_spec",
    conversations: [
      makeTaskConversation({ stage: "prd" }),
      makeTaskConversation({ stage: "tech_spec", startedAt: "2026-09-05T11:00:00Z" }),
    ],
    situations: [makeSituation({ taskId: WEB_TASK.id, place: stagePlace("tech_spec") })],
  });
  const TASK_PLACE: Location = { kind: "task", id: WEB_TASK.id };

  // reading opens the task and reads its PRD conversation in place of the tech spec one.
  function reading() {
    useAppStore.getState().applyState(withTasks({ tasks: [READ_TASK, API_TASK] }));
    useAppStore.getState().go(TASK_PLACE);
    useAppStore.getState().openEarlierConversation(WEB_TASK.id, "prd", true);
  }

  it("is read in place of the conversation of the task, and closes back to it", () => {
    const { result } = renderHook(() => useEarlierConversation(WEB_TASK.id));
    act(() => reading());

    expect(result.current).toEqual({ taskId: WEB_TASK.id, stage: "prd", from: "panel" });

    act(() => useAppStore.getState().closeEarlierConversation());

    expect(result.current).toBeNull();
  });

  it("remembers that the panel was closed when it opened", () => {
    act(() => reading());
    useAppStore.getState().openEarlierConversation(WEB_TASK.id, "prd", false);

    expect(useAppStore.getState().earlierConversation?.from).toBeNull();
  });

  it("belongs to its task only", () => {
    act(() => reading());
    const { result } = renderHook(() => useEarlierConversation(API_TASK.id));

    expect(result.current).toBeNull();
  });

  it("hides the situation of the place while it is on screen", () => {
    const { result } = renderHook(() => useOnScreenSituationId());
    act(() => {
      useAppStore.getState().applyState(withTasks({ tasks: [READ_TASK, API_TASK] }));
      useAppStore.getState().go(TASK_PLACE);
    });
    expect(result.current).toBe("situation-1");

    act(() => useAppStore.getState().openEarlierConversation(WEB_TASK.id, "prd", true));

    expect(result.current).toBeNull();
  });

  it("closes on the way to another place", () => {
    reading();

    useAppStore.getState().go({ kind: "history" });

    expect(useAppStore.getState().earlierConversation).toBeNull();
  });

  it("closes on the way back and forward through the places", () => {
    useAppStore.getState().applyState(withTasks({ tasks: [READ_TASK, API_TASK] }));
    useAppStore.getState().go({ kind: "history" });
    reading();

    useAppStore.getState().goBack();

    expect(useAppStore.getState().earlierConversation).toBeNull();

    useAppStore.getState().goForward();
    useAppStore.getState().openEarlierConversation(WEB_TASK.id, "prd", true);
    useAppStore.getState().goBack();
    useAppStore.getState().goForward();

    expect(location()).toEqual(TASK_PLACE);
    expect(useAppStore.getState().earlierConversation).toBeNull();
  });

  it("closes when a situation of the same task is opened", () => {
    reading();

    useAppStore.getState().openSituation(WEB_TASK.id, stagePlace("tech_spec"));

    expect(location()).toEqual(TASK_PLACE);
    expect(useAppStore.getState().earlierConversation).toBeNull();
  });

  it("is never stacked among the places", () => {
    reading();

    expect(useAppStore.getState().back).not.toContainEqual(
      expect.objectContaining({ stage: "prd" }),
    );
    expect(localStorage.getItem(NAV_STACK_KEY) ?? "").not.toContain("earlier");
  });

  it("stays open while its session is still there", () => {
    reading();

    useAppStore.getState().applyState(withTasks({ tasks: [READ_TASK, API_TASK] }));

    expect(useAppStore.getState().earlierConversation).not.toBeNull();
  });

  it("closes when a snapshot comes without its session, as a discarded one", () => {
    reading();

    useAppStore.getState().applyState(
      withTasks({
        tasks: [{ ...READ_TASK, conversations: [makeTaskConversation({ stage: "tech_spec" })] }],
      }),
    );

    expect(useAppStore.getState().earlierConversation).toBeNull();
  });

  it("closes when a snapshot comes without its task", () => {
    reading();

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(useAppStore.getState().earlierConversation).toBeNull();
  });

  it("closes once no repository nor board is registered", () => {
    reading();

    useAppStore.getState().applyState(makeState({ repositories: [], boards: [], tasks: [] }));

    expect(useAppStore.getState().earlierConversation).toBeNull();
  });
});
