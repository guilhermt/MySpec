import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COLLAPSED_KEY } from "@/lib/ui-storage";
import type { Place, PullRequest, Situation, TranscriptEvent } from "@/lib/wails";
import { sessionKey } from "@/lib/wails";
import {
  filterHistory,
  stepTabKey,
  useAppStore,
  useArchivedNotice,
  useArchivedReview,
  useArchivedTask,
  useBoard,
  useBoards,
  useDraft,
  useError,
  useFindingDraft,
  useFlashing,
  useHistory,
  useHistoryUi,
  useLeftover,
  useMigration,
  useOnScreenSituationId,
  useOpenBoardId,
  useOpenReviewId,
  useOpenStepTab,
  useOpenTask,
  usePrDraft,
  useRepositories,
  useRepository,
  useRepositoryFilter,
  useReview,
  useReviewCenter,
  useReviewHistory,
  useReviews,
  useReviewsOpen,
  useSettingsUi,
  useSidebarCollapsed,
  useStartReview,
  useTask,
  useTasks,
  useThemeState,
  useTranscript,
} from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import {
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeEntry,
  makeMigration,
  makePullRequest,
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
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

beforeEach(() => {
  resetAppStore();
});

describe("applyState", () => {
  it("keeps what is on screen while repositories stay registered", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(API_TASK.id);

    useAppStore.getState().applyState(withTasks({ systemDark: true }));

    expect(useAppStore.getState().openTaskId).toBe(API_TASK.id);
  });

  // The welcome screen takes the place of everything the app shows of the tasks.
  it("clears the screen when the last repository is gone", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(API_TASK.id);
    useAppStore.getState().openSettings();

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().settingsOpen).toBe(false);
    expect(useAppStore.getState().settingsSection).toBe("defaults");
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
      error: useError(),
      theme: useThemeState(),
    }));

    expect(result.current.repositories).toEqual([]);
    expect(result.current.filter).toBe("");
    expect(result.current.migration).toBeNull();
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
      useAppStore.getState().setError("binding failed");
    });

    expect(result.current.repositories).toHaveLength(2);
    expect(result.current.filter).toBe("repo-2");
    expect(result.current.web?.fullName).toBe("dev/web");
    expect(result.current.unknown).toBeNull();
    expect(result.current.migration).toBeNull();
    expect(result.current.error).toBe("binding failed");
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

    expect(useAppStore.getState().openTaskId).toBe(API_TASK.id);
    expect(useAppStore.getState().historyOpen).toBe(false);
    expect(useAppStore.getState().settingsOpen).toBe(false);
  });

  it("opens a task the snapshot does not have yet", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().openTask("task-unknown");

    expect(useAppStore.getState().openTaskId).toBe("task-unknown");
  });

  it("closes the task", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);

    useAppStore.getState().closeTask();

    expect(useAppStore.getState().openTaskId).toBeNull();
  });

  it("closes a task that the snapshot no longer has and drops its transcript", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: WEB_TASK.id }));

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK] }));

    expect(useAppStore.getState().openTaskId).toBeNull();
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

    expect(useAppStore.getState().openTaskId).toBeNull();
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
      open: useOpenTask(),
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
    expect(result.current.open).toEqual(WEB_TASK);
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
  it("opens on the implementer and keeps the tab the user picks", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));

    act(() => {
      useAppStore.getState().applyState(withSteps());
    });
    expect(result.current).toBe("implementer");

    act(() => {
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");
    });
    expect(result.current).toBe("reviewer");

    act(() => {
      useAppStore.getState().applyState(withSteps());
    });
    expect(result.current).toBe("reviewer");
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
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");
      useAppStore.getState().applyState(withSteps({ currentStep: 2 }));
    });

    expect(result.current).toBe("implementer");
    expect(useAppStore.getState().openStepTab).toEqual({
      [stepTabKey(WEB_TASK.id, 1)]: "reviewer",
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
    expect(useAppStore.getState().openTaskId).toBeNull();

    act(() => {
      useAppStore.getState().openArchived(ARCHIVED.id);
      useAppStore.getState().setHistoryQuery("log");
    });
    expect(result.current).toEqual({
      historyOpen: true,
      openArchivedId: ARCHIVED.id,
      historyQuery: "log",
    });

    act(() => {
      useAppStore.getState().closeArchived();
    });
    expect(result.current.openArchivedId).toBeNull();

    act(() => {
      useAppStore.getState().closeHistory();
    });
    expect(result.current.historyOpen).toBe(false);
  });

  it("leaves the history when a task is opened", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().openTask(WEB_TASK.id);

    expect(useAppStore.getState().historyOpen).toBe(false);
    expect(useAppStore.getState().openArchivedId).toBeNull();
  });

  it("closes an archived task that left the history", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().applyState(withTasks({ history: [] }));

    expect(useAppStore.getState().openArchivedId).toBeNull();
    expect(useAppStore.getState().historyOpen).toBe(true);
  });

  it("keeps the archived task open while the history still has it", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED] }));
    useAppStore.getState().openArchived(ARCHIVED.id);

    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED, OLDER] }));

    expect(useAppStore.getState().openArchivedId).toBe(ARCHIVED.id);
  });
});

describe("filterHistory", () => {
  it("keeps everything without a query and without a filter", () => {
    expect(filterHistory([ARCHIVED, OLDER], "", "")).toHaveLength(2);
    expect(filterHistory([ARCHIVED, OLDER], "   ", "")).toHaveLength(2);
  });

  it("matches part of the name, whatever the case", () => {
    expect(filterHistory([ARCHIVED, OLDER], "LOG", "")).toEqual([ARCHIVED]);
    expect(filterHistory([ARCHIVED, OLDER], " header ", "")).toEqual([OLDER]);
  });

  it("keeps the tasks of the repository of the filter", () => {
    expect(filterHistory([ARCHIVED, OLDER], "", "repo-2")).toEqual([OLDER]);
    expect(filterHistory([ARCHIVED, OLDER], "header", "repo-1")).toEqual([]);
  });

  it("answers with nothing when no name matches", () => {
    expect(filterHistory([ARCHIVED, OLDER], "payments", "")).toEqual([]);
  });
});

describe("notices", () => {
  it("announces the task that was just archived", () => {
    const { result } = renderHook(() => useArchivedNotice());

    act(() => {
      useAppStore.getState().applyState(withTasks());
    });
    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().applyState(withTasks({ tasks: [API_TASK], history: [ARCHIVED] }));
    });

    expect(result.current).toEqual({ id: ARCHIVED.id, name: ARCHIVED.name });
  });

  // The first snapshot brings the whole history; none of it was archived now.
  it("says nothing about a history that was already there", () => {
    useAppStore.getState().applyState(withTasks({ history: [ARCHIVED, OLDER] }));

    expect(useAppStore.getState().archivedNotice).toBeNull();
  });

  it("says nothing once no repository is registered", () => {
    useAppStore.getState().applyState(withTasks({ tasks: [WEB_TASK] }));

    useAppStore.getState().applyState(makeState({ repositories: [], history: [ARCHIVED] }));

    expect(useAppStore.getState().archivedNotice).toBeNull();
  });

  it("keeps the notice while the snapshots go by, until it is dismissed", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK], history: [ARCHIVED] }));

    useAppStore.getState().applyState(withTasks({ tasks: [API_TASK], history: [ARCHIVED] }));
    expect(useAppStore.getState().archivedNotice?.id).toBe(ARCHIVED.id);

    useAppStore.getState().dismissArchivedNotice();
    expect(useAppStore.getState().archivedNotice).toBeNull();
  });

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

describe("open place", () => {
  it("opens the task of a situation", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().openPlace(API_TASK.id, stagePlace("prd"));

    expect(useAppStore.getState().openTaskId).toBe(API_TASK.id);
  });

  it("opens the reviewer tab of the step the situation is in", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));
    act(() => {
      useAppStore.getState().applyState(withSteps());
    });

    act(() => {
      useAppStore.getState().openPlace(WEB_TASK.id, reviewerPlace(1));
    });

    expect(useAppStore.getState().openTaskId).toBe(WEB_TASK.id);
    expect(result.current).toBe("reviewer");
  });

  it("opens the implementer tab for a situation of the step", () => {
    const { result } = renderHook(() => useOpenStepTab(WEB_TASK.id));
    act(() => {
      useAppStore.getState().applyState(withSteps());
      useAppStore.getState().selectStepTab(WEB_TASK.id, 1, "reviewer");
    });

    act(() => {
      useAppStore.getState().openPlace(WEB_TASK.id, stepPlace(1));
    });

    expect(result.current).toBe("implementer");
  });

  it("puts away the history, the archived task and the creation dialog", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openArchived(ARCHIVED.id);
    useAppStore.getState().openNewTask();

    useAppStore.getState().openPlace(WEB_TASK.id, stagePlace("prd"));

    expect(useAppStore.getState().openTaskId).toBe(WEB_TASK.id);
    expect(useAppStore.getState().historyOpen).toBe(false);
    expect(useAppStore.getState().openArchivedId).toBeNull();
    expect(useAppStore.getState().newTaskOpen).toBe(false);
  });

  it("ignores a task that is no longer there", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openHistory();
    useAppStore.getState().openNewTask();

    useAppStore.getState().openPlace("task-gone", PR_PLACE);

    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().historyOpen).toBe(true);
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
    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().historyOpen).toBe(false);
    expect(useAppStore.getState().openArchivedId).toBeNull();
    expect(useAppStore.getState().newTaskOpen).toBe(false);

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
      () => useAppStore.getState().openPlace(WEB_TASK.id, stagePlace("prd")),
    ]) {
      useAppStore.getState().openSettings();

      navigate();

      expect(useAppStore.getState().settingsOpen).toBe(false);
    }
  });

  it("keeps the settings open while the repositories change", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openSettings();
    useAppStore.getState().selectSettingsSection("plan");
    useAppStore.getState().startPromptEdit("plan", "# Plan");

    useAppStore.getState().applyState(makeState({ repositories: [WEB], tasks: [WEB_TASK] }));

    expect(useAppStore.getState().settingsOpen).toBe(true);
    expect(useAppStore.getState().settingsSection).toBe("plan");
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

    expect(useAppStore.getState().settingsSection).toBe("commit");
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
    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().settingsOpen).toBe(true);

    useAppStore.getState().cancelLeave();

    expect(useAppStore.getState().pendingLeave).toBeNull();
    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().settingsOpen).toBe(true);
    expect(useAppStore.getState().promptEdit?.text).toBe("# PRD, edited");

    useAppStore.getState().openTask(WEB_TASK.id);
    useAppStore.getState().confirmLeave();

    expect(useAppStore.getState().openTaskId).toBe(WEB_TASK.id);
    expect(useAppStore.getState().settingsOpen).toBe(false);
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
    expect(useAppStore.getState().settingsOpen).toBe(true);
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
      expect(useAppStore.getState().openTaskId).toBeNull();
      expect(useAppStore.getState().openArchivedId).toBeNull();
      expect(useAppStore.getState().historyOpen).toBe(false);
      expect(useAppStore.getState().settingsOpen).toBe(false);
    }
  });

  it("puts the board view away when another place opens", () => {
    useAppStore.getState().applyState(withBoards());

    for (const navigate of [
      () => useAppStore.getState().openTask(WEB_TASK.id),
      () => useAppStore.getState().openHistory(),
      () => useAppStore.getState().openArchived(ARCHIVED.id),
      () => useAppStore.getState().openSettings(),
      () => useAppStore.getState().openPlace(WEB_TASK.id, stagePlace("prd")),
    ]) {
      useAppStore.getState().openBoard("board-1");

      navigate();

      expect(useAppStore.getState().openBoardId).toBeNull();
    }
  });

  it("waits for the user to discard an unsaved prompt before opening a board", () => {
    useAppStore.getState().applyState(withBoards());
    useAppStore.getState().openSettings();
    useAppStore.getState().startPromptEdit("prd", "# PRD");
    useAppStore.getState().setPromptEditText("# PRD, edited");

    useAppStore.getState().openBoard("board-1");

    expect(useAppStore.getState().openBoardId).toBeNull();

    useAppStore.getState().confirmLeave();

    expect(useAppStore.getState().openBoardId).toBe("board-1");
  });

  it("takes the view of a board that is gone off the screen", () => {
    useAppStore.getState().applyState(withBoards());
    useAppStore.getState().openBoard("board-2");

    useAppStore.getState().applyState(withBoards([OPS]));
    expect(useAppStore.getState().openBoardId).toBe("board-2");

    useAppStore.getState().applyState(withBoards([ROADMAP]));
    expect(useAppStore.getState().openBoardId).toBeNull();
  });

  it("keeps the screen while a board is registered without any repository", () => {
    useAppStore.getState().applyState(makeState({ repositories: [], boards: [OPS] }));
    useAppStore.getState().openBoard("board-2");

    useAppStore.getState().applyState(makeState({ repositories: [], boards: [OPS] }));

    expect(useAppStore.getState().openBoardId).toBe("board-2");
  });

  it("clears the board view once no board and no repository is registered", () => {
    useAppStore.getState().applyState(withBoards());
    useAppStore.getState().openBoard("board-1");
    useAppStore
      .getState()
      .setPendingStart({ boardId: "board-1", key: "dev/web#12", repositoryId: "repo-1" });

    useAppStore.getState().applyState(makeState({ repositories: [], boards: [] }));

    expect(useAppStore.getState().openBoardId).toBeNull();
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
      reviews: useReviews(),
      review: useReview(REVIEW.id),
      missing: useReview("review-gone"),
      history: useReviewHistory(),
      archived: useArchivedReview(ARCHIVED_REVIEW.id),
    }));

    expect(result.current.center.pendingCount).toBe(0);
    expect(result.current.center.pullRequests).toEqual([]);
    expect(result.current.reviews).toEqual([]);
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
    expect(result.current.reviews).toHaveLength(2);
    expect(result.current.review).toEqual(REVIEW);
    expect(result.current.missing).toBeNull();
    expect(result.current.archived).toEqual(ARCHIVED_REVIEW);
  });

  it("falls back to no review when the snapshot carries none", () => {
    const { result } = renderHook(() => ({
      reviews: useReviews(),
      history: useReviewHistory(),
    }));

    act(() => {
      useAppStore.getState().applyState(withTasks({ reviews: null, reviewHistory: null }));
    });

    expect(result.current.reviews).toEqual([]);
    expect(result.current.history).toEqual([]);
  });

  it("opens the Reviews view in place of a task and closes it into a review", () => {
    const { result } = renderHook(() => ({
      open: useReviewsOpen(),
      openId: useOpenReviewId(),
    }));

    act(() => {
      useAppStore.getState().applyState(withReviews());
      useAppStore.getState().openTask(WEB_TASK.id);
      useAppStore.getState().openReviews();
    });
    expect(result.current).toEqual({ open: true, openId: null });
    expect(useAppStore.getState().openTaskId).toBeNull();

    act(() => {
      useAppStore.getState().openReview(REVIEW.id);
    });
    expect(result.current).toEqual({ open: false, openId: REVIEW.id });

    act(() => {
      useAppStore.getState().closeReview();
    });
    expect(result.current).toEqual({ open: true, openId: null });
  });

  it("opens an archived review inside the history and closes it", () => {
    act(() => {
      useAppStore.getState().applyState(withReviews({ reviewHistory: [ARCHIVED_REVIEW] }));
      useAppStore.getState().openReview(REVIEW.id);
      useAppStore.getState().openArchivedReview(ARCHIVED_REVIEW.id);
    });
    expect(useAppStore.getState().openArchivedReviewId).toBe(ARCHIVED_REVIEW.id);
    expect(useAppStore.getState().historyOpen).toBe(true);
    expect(useAppStore.getState().openReviewId).toBeNull();

    act(() => {
      useAppStore.getState().closeArchivedReview();
    });
    expect(useAppStore.getState().openArchivedReviewId).toBeNull();
  });

  it.each([
    ["a task", () => useAppStore.getState().openTask(WEB_TASK.id)],
    ["a board", () => useAppStore.getState().openBoard("board-1")],
    ["the history", () => useAppStore.getState().openHistory()],
    ["an archived task", () => useAppStore.getState().openArchived(ARCHIVED.id)],
    ["the settings", () => useAppStore.getState().openSettings()],
    ["nothing", () => useAppStore.getState().closeTask()],
  ])("leaves the review places behind when %s opens", (_name, navigate) => {
    useAppStore.getState().applyState(withReviews({ history: [ARCHIVED] }));
    useAppStore.getState().openReview(REVIEW.id);

    navigate();

    expect(useAppStore.getState().openReviewId).toBeNull();
    expect(useAppStore.getState().reviewsOpen).toBe(false);
    expect(useAppStore.getState().openArchivedReviewId).toBeNull();
  });

  it("closes the screen of a review that is gone and drops its conversation", () => {
    useAppStore.getState().applyState(withReviews());
    useAppStore.getState().openReview(REVIEW.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: REVIEW.id, stage: "review" }));

    useAppStore.getState().applyState(withReviews({ reviews: [OTHER_REVIEW] }));

    expect(useAppStore.getState().openReviewId).toBeNull();
    expect(useAppStore.getState().openArchivedReviewId).toBeNull();
    expect(useAppStore.getState().transcripts[REVIEW_KEY]).toBeUndefined();
  });

  it("opens the archived review of a review whose pull request was merged", () => {
    useAppStore.getState().applyState(withReviews());
    useAppStore.getState().openReview(REVIEW.id);

    useAppStore
      .getState()
      .applyState(withReviews({ reviews: [OTHER_REVIEW], reviewHistory: [ARCHIVED_REVIEW] }));

    expect(useAppStore.getState().openReviewId).toBeNull();
    expect(useAppStore.getState().openArchivedReviewId).toBe(ARCHIVED_REVIEW.id);
    // Inside the history, so that going back from the archived review lands
    // where every other archived entity is opened from.
    expect(useAppStore.getState().historyOpen).toBe(true);
  });

  it("closes an archived review that is no longer in the history", () => {
    useAppStore.getState().applyState(withReviews({ reviewHistory: [ARCHIVED_REVIEW] }));
    useAppStore.getState().openArchivedReview(ARCHIVED_REVIEW.id);

    useAppStore.getState().applyState(withReviews({ reviewHistory: [] }));

    expect(useAppStore.getState().openArchivedReviewId).toBeNull();
  });

  it("forgets the review screens once no repository is registered", () => {
    useAppStore.getState().applyState(withReviews());
    useAppStore.getState().openReview(REVIEW.id);

    useAppStore.getState().applyState(makeState({ repositories: [], tasks: [] }));

    expect(useAppStore.getState().openReviewId).toBeNull();
    expect(useAppStore.getState().reviewsOpen).toBe(false);
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
    const { result } = renderHook(() => useFindingDraft(key));

    expect(result.current).toBeNull();

    act(() => {
      useAppStore.getState().setFindingDraft(key, "half a note");
    });
    expect(result.current).toBe("half a note");

    act(() => {
      useAppStore.getState().clearFindingDraft(key);
    });
    expect(result.current).toBeNull();
  });

  it("opens the review a situation is in, and ignores one that is gone", () => {
    useAppStore.getState().applyState(withReviews());

    useAppStore.getState().openPlace("review-gone", REVIEW_PLACE);
    expect(useAppStore.getState().openReviewId).toBeNull();

    useAppStore.getState().openPlace(REVIEW.id, REVIEW_PLACE);
    expect(useAppStore.getState().openReviewId).toBe(REVIEW.id);
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
