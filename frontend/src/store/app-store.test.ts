import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { RepoPR, TranscriptEvent } from "@/lib/wails";
import { sessionKey } from "@/lib/wails";
import {
  ROOT_NODE_ID,
  repoKey,
  repoNodeId,
  useAppStore,
  useDraft,
  useError,
  useNotice,
  useOpenRepo,
  useOpenTask,
  usePrDraft,
  useRecents,
  useRepos,
  useTask,
  useTasks,
  useTasksOf,
  useThemeState,
  useTranscript,
  useTreeUi,
  useWorkspace,
} from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeEntry, makeRepoPR, makeState, makeTask, makeTranscript } from "@/test/wails-mock";

const ROOT_TASK = makeTask({ id: "task-root", name: "add-login" });
const REPO_TASK = makeTask({
  id: "task-web",
  name: "fix-header",
  repoPath: "/home/dev/projects/web",
});

function withTasks() {
  return makeState({ tasks: [ROOT_TASK, REPO_TASK] });
}

// ROOT_KEY is the session of the root task in the stage its fixture is in.
const ROOT_KEY = sessionKey(ROOT_TASK.id, ROOT_TASK.stage);

function transcriptEvent(overrides: Partial<TranscriptEvent> = {}): TranscriptEvent {
  return {
    taskId: ROOT_TASK.id,
    stage: ROOT_TASK.stage,
    kind: "entry",
    entry: null,
    entryId: "",
    text: "",
    ...overrides,
  };
}

const API_NODE = repoNodeId("/home/dev/projects/api");
const WEB_NODE = repoNodeId("/home/dev/projects/web");

beforeEach(() => {
  resetAppStore();
});

describe("applyState", () => {
  it("keeps the tree selection while the workspace path is the same", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(WEB_NODE);
    useAppStore.getState().setNodeExpanded(WEB_NODE, true);

    useAppStore.getState().applyState(makeState({ systemDark: true }));

    expect(useAppStore.getState().selectedNodeId).toBe(WEB_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(WEB_NODE)).toBe(true);
  });

  it("resets the tree selection when the workspace path changes", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(WEB_NODE);
    useAppStore.getState().toggleNode(WEB_NODE);

    useAppStore.getState().applyState(
      makeState({
        workspace: { name: "labs", path: "/home/dev/labs", repos: [] },
      }),
    );

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
    expect([...useAppStore.getState().expandedNodeIds]).toEqual([ROOT_NODE_ID]);
  });

  it("falls back to root when the selected repository is gone", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(WEB_NODE);

    useAppStore.getState().applyState(
      makeState({
        workspace: {
          name: "projects",
          path: "/home/dev/projects",
          repos: [{ name: "api", path: "/home/dev/projects/api" }],
        },
      }),
    );

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
  });

  it("keeps a repository selected when it survives the rescan", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(API_NODE);

    useAppStore.getState().applyState(makeState());

    expect(useAppStore.getState().selectedNodeId).toBe(API_NODE);
  });

  it("treats a workspace without repositories as having no repository nodes", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(API_NODE);

    useAppStore.getState().applyState(
      makeState({
        workspace: { name: "projects", path: "/home/dev/projects", repos: null },
      }),
    );

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
  });
});

describe("tree ui", () => {
  it("toggles a node on and off", () => {
    useAppStore.getState().toggleNode(API_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(API_NODE)).toBe(true);

    useAppStore.getState().toggleNode(API_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(API_NODE)).toBe(false);
  });

  it("collapses a node through setNodeExpanded", () => {
    useAppStore.getState().setNodeExpanded(ROOT_NODE_ID, false);
    expect(useAppStore.getState().expandedNodeIds.has(ROOT_NODE_ID)).toBe(false);
  });
});

describe("selectors", () => {
  it("report an empty state before the first snapshot", () => {
    const { result } = renderHook(() => ({
      workspace: useWorkspace(),
      recents: useRecents(),
      notice: useNotice(),
      error: useError(),
      theme: useThemeState(),
      tree: useTreeUi(),
    }));

    expect(result.current.workspace).toBeNull();
    expect(result.current.recents).toEqual([]);
    expect(result.current.notice).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.theme).toEqual({ preference: "system", systemDark: false });
    expect(result.current.tree.selectedNodeId).toBe(ROOT_NODE_ID);
  });

  it("report the current snapshot", () => {
    const { result } = renderHook(() => ({
      workspace: useWorkspace(),
      recents: useRecents(),
      notice: useNotice(),
      error: useError(),
      theme: useThemeState(),
      tree: useTreeUi(),
    }));

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          theme: "dark",
          systemDark: true,
          notice: { path: "/home/dev/gone", reason: "not_found" },
        }),
      );
      useAppStore.getState().setError("binding failed");
    });

    expect(result.current.workspace?.name).toBe("projects");
    expect(result.current.recents).toHaveLength(3);
    expect(result.current.notice?.reason).toBe("not_found");
    expect(result.current.error).toBe("binding failed");
    expect(result.current.theme).toEqual({ preference: "dark", systemDark: true });
    expect([...result.current.tree.expandedNodeIds]).toEqual([ROOT_NODE_ID]);
  });

  it("falls back to an empty recent list when the snapshot has none", () => {
    const { result } = renderHook(() => useRecents());

    act(() => {
      useAppStore.getState().applyState(makeState({ recents: null }));
    });

    expect(result.current).toEqual([]);
  });
});

describe("open task", () => {
  it("reveals the node of the task it opens", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().openTask(REPO_TASK.id);

    expect(useAppStore.getState().openTaskId).toBe(REPO_TASK.id);
    expect(useAppStore.getState().selectedNodeId).toBe(WEB_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(WEB_NODE)).toBe(true);
  });

  it("selects the root for a task of the workspace root", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().selectNode(WEB_NODE);

    useAppStore.getState().openTask(ROOT_TASK.id);

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
  });

  it("opens a task the snapshot does not have yet without touching the tree", () => {
    useAppStore.getState().applyState(withTasks());

    useAppStore.getState().openTask("task-unknown");

    expect(useAppStore.getState().openTaskId).toBe("task-unknown");
    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
  });

  it("closes the task", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(ROOT_TASK.id);

    useAppStore.getState().closeTask();

    expect(useAppStore.getState().openTaskId).toBeNull();
  });

  it("closes a task that the snapshot no longer has and drops its transcript", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(ROOT_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));

    useAppStore.getState().applyState(makeState({ tasks: [REPO_TASK] }));

    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().transcripts[ROOT_KEY]).toBeUndefined();
  });

  it("forgets tasks, transcripts and drafts when the workspace changes", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(ROOT_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));
    useAppStore.getState().setDraft(ROOT_TASK.id, ROOT_TASK.stage, "half a message");
    useAppStore.getState().openNewTask(ROOT_NODE_ID);

    useAppStore
      .getState()
      .applyState(makeState({ workspace: { name: "labs", path: "/home/dev/labs", repos: [] } }));

    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(useAppStore.getState().transcripts).toEqual({});
    expect(useAppStore.getState().drafts).toEqual({});
    expect(useAppStore.getState().newTaskFor).toBeNull();
  });

  it("remembers which node the creation dialog is open for", () => {
    useAppStore.getState().openNewTask(WEB_NODE);
    expect(useAppStore.getState().newTaskFor).toBe(WEB_NODE);

    useAppStore.getState().closeNewTask();
    expect(useAppStore.getState().newTaskFor).toBeNull();
  });
});

describe("transcripts", () => {
  it("buffers what arrives while loading and applies it once loaded", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore.getState().beginTranscript(ROOT_TASK.id, ROOT_TASK.stage);

    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ entry }));
    expect(useAppStore.getState().transcripts[ROOT_KEY]?.entries).toEqual([]);

    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));

    const transcript = useAppStore.getState().transcripts[ROOT_KEY];
    expect(transcript?.status).toBe("ready");
    expect(transcript?.entries).toEqual([entry]);
    expect(transcript?.buffered).toEqual([]);
  });

  it("applies an event to a conversation it has already loaded", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));

    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ entry }));

    expect(useAppStore.getState().transcripts[ROOT_KEY]?.entries).toEqual([entry]);
  });

  it("ignores an event for a task nobody opened", () => {
    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ taskId: "task-other" }));

    expect(useAppStore.getState().transcripts).toEqual({});
  });

  it("ignores an event that changes nothing", () => {
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));
    const before = useAppStore.getState().transcripts[ROOT_KEY];

    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ kind: "text", entryId: "gone" }));

    expect(useAppStore.getState().transcripts[ROOT_KEY]).toBe(before);
  });

  it("keeps the entries it has while reloading", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    useAppStore
      .getState()
      .setTranscript(makeTranscript({ taskId: ROOT_TASK.id, entries: [entry] }));

    useAppStore.getState().beginTranscript(ROOT_TASK.id, ROOT_TASK.stage);

    const transcript = useAppStore.getState().transcripts[ROOT_KEY];
    expect(transcript?.status).toBe("loading");
    expect(transcript?.entries).toEqual([entry]);
  });

  it("drops a conversation on request", () => {
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));

    useAppStore.getState().dropTranscript(ROOT_TASK.id, ROOT_TASK.stage);

    expect(useAppStore.getState().transcripts[ROOT_KEY]).toBeUndefined();
  });

  it("keeps the conversations of one task apart, one per stage", () => {
    const prd = makeEntry("user", { id: "a", seq: 1 });
    const spec = makeEntry("user", { id: "b", seq: 1 });
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id, entries: [prd] }));
    useAppStore
      .getState()
      .setTranscript(makeTranscript({ taskId: ROOT_TASK.id, stage: "tech_spec", entries: [spec] }));

    // An event of one stage never reaches the conversation of the other.
    const entry = makeEntry("assistant", { id: "c", seq: 2 });
    useAppStore.getState().applyTranscriptEvent(transcriptEvent({ stage: "tech_spec", entry }));

    const specKey = sessionKey(ROOT_TASK.id, "tech_spec");
    expect(useAppStore.getState().transcripts[ROOT_KEY]?.entries).toEqual([prd]);
    expect(useAppStore.getState().transcripts[specKey]?.entries).toEqual([spec, entry]);

    // Dropping one leaves the other alone.
    useAppStore.getState().dropTranscript(ROOT_TASK.id, "tech_spec");
    expect(useAppStore.getState().transcripts[specKey]).toBeUndefined();
    expect(useAppStore.getState().transcripts[ROOT_KEY]?.entries).toEqual([prd]);
  });

  it("forgets every conversation of a task that left the snapshot", () => {
    useAppStore.getState().applyState(withTasks());
    useAppStore.getState().openTask(ROOT_TASK.id);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));
    useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id, stage: "plan" }));
    useAppStore.getState().setTranscript(makeTranscript({ taskId: REPO_TASK.id }));

    useAppStore.getState().applyState(makeState({ tasks: [REPO_TASK] }));

    expect(useAppStore.getState().transcripts).toEqual({
      [sessionKey(REPO_TASK.id, REPO_TASK.stage)]: expect.anything(),
    });
  });

  it("keeps one draft per session, not one per task", () => {
    useAppStore.getState().setDraft(ROOT_TASK.id, ROOT_TASK.stage, "hello");
    useAppStore.getState().setDraft(REPO_TASK.id, REPO_TASK.stage, "there");

    expect(useAppStore.getState().drafts).toEqual({
      [ROOT_KEY]: "hello",
      [sessionKey(REPO_TASK.id, REPO_TASK.stage)]: "there",
    });
  });
});

describe("task selectors", () => {
  it("report the tasks of the snapshot and of each node", () => {
    const { result } = renderHook(() => ({
      tasks: useTasks(),
      root: useTasksOf(ROOT_NODE_ID),
      web: useTasksOf(WEB_NODE),
      api: useTasksOf(API_NODE),
      task: useTask(REPO_TASK.id),
      open: useOpenTask(),
      transcript: useTranscript(ROOT_TASK.id, ROOT_TASK.stage),
      draft: useDraft(ROOT_TASK.id, ROOT_TASK.stage),
    }));

    expect(result.current.tasks).toEqual([]);
    expect(result.current.task).toBeNull();
    expect(result.current.transcript).toBeNull();
    expect(result.current.draft).toBe("");

    act(() => {
      useAppStore.getState().applyState(withTasks());
      useAppStore.getState().openTask(ROOT_TASK.id);
      useAppStore.getState().setDraft(ROOT_TASK.id, ROOT_TASK.stage, "hello");
      useAppStore.getState().setTranscript(makeTranscript({ taskId: ROOT_TASK.id }));
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.root).toEqual([ROOT_TASK]);
    expect(result.current.web).toEqual([REPO_TASK]);
    expect(result.current.api).toEqual([]);
    expect(result.current.task).toEqual(REPO_TASK);
    expect(result.current.open).toEqual(ROOT_TASK);
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

const API_REPO = makeRepoPR({
  repository: "api",
  repoPath: "/home/dev/projects/api",
  slug: "api",
});
const WEB_REPO = makeRepoPR({ status: "drafting" });

function withRepos(...repos: RepoPR[]) {
  return makeState({ tasks: [{ ...ROOT_TASK, stage: "pr", repos }] });
}

describe("repository selection", () => {
  it("opens on the first repository waiting for the user", () => {
    const { result } = renderHook(() => ({
      repos: useRepos(ROOT_TASK.id),
      open: useOpenRepo(ROOT_TASK.id),
    }));

    act(() => {
      useAppStore
        .getState()
        .applyState(withRepos(API_REPO, { ...WEB_REPO, status: "draft_ready" }));
    });

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.open).toBe(WEB_REPO.repoPath);
  });

  it("opens on the first repository when none waits", () => {
    const { result } = renderHook(() => useOpenRepo(ROOT_TASK.id));

    act(() => {
      useAppStore.getState().applyState(withRepos(API_REPO, WEB_REPO));
    });

    expect(result.current).toBe(API_REPO.repoPath);
  });

  it("has no repository outside the PR stage", () => {
    const { result } = renderHook(() => ({
      repos: useRepos(ROOT_TASK.id),
      open: useOpenRepo(ROOT_TASK.id),
    }));

    act(() => {
      useAppStore.getState().applyState(withTasks());
    });

    expect(result.current.repos).toEqual([]);
    expect(result.current.open).toBe("");
  });

  it("keeps the repository the user picked", () => {
    const { result } = renderHook(() => useOpenRepo(ROOT_TASK.id));

    act(() => {
      useAppStore
        .getState()
        .applyState(withRepos(API_REPO, { ...WEB_REPO, status: "draft_ready" }));
      useAppStore.getState().selectRepo(ROOT_TASK.id, API_REPO.repoPath);
    });

    expect(result.current).toBe(API_REPO.repoPath);
  });

  it("falls back to the default when the selection leaves the task", () => {
    const { result } = renderHook(() => useOpenRepo(ROOT_TASK.id));

    act(() => {
      useAppStore.getState().applyState(withRepos(API_REPO, WEB_REPO));
      useAppStore.getState().selectRepo(ROOT_TASK.id, WEB_REPO.repoPath);
    });
    expect(result.current).toBe(WEB_REPO.repoPath);

    act(() => {
      useAppStore.getState().applyState(withRepos(API_REPO));
    });

    expect(result.current).toBe(API_REPO.repoPath);
  });
});

describe("pull request drafts", () => {
  const draft = { title: "Add the login form", body: "Closes #12" };

  it("keeps what the user is editing across state updates", () => {
    const { result } = renderHook(() => usePrDraft(ROOT_TASK.id, WEB_REPO.repoPath));

    act(() => {
      useAppStore.getState().applyState(withRepos(WEB_REPO));
      useAppStore.getState().setPrDraft(ROOT_TASK.id, WEB_REPO.repoPath, draft);
    });
    expect(result.current).toEqual(draft);

    act(() => {
      useAppStore.getState().applyState(withRepos({ ...WEB_REPO, status: "draft_ready" }));
    });

    expect(result.current).toEqual(draft);
  });

  it("keys a draft by task and repository", () => {
    act(() => {
      useAppStore.getState().setPrDraft(ROOT_TASK.id, WEB_REPO.repoPath, draft);
    });

    expect(useAppStore.getState().prDrafts).toEqual({
      [repoKey(ROOT_TASK.id, WEB_REPO.repoPath)]: draft,
    });
  });

  it("clears one draft and leaves the others", () => {
    act(() => {
      useAppStore.getState().setPrDraft(ROOT_TASK.id, WEB_REPO.repoPath, draft);
      useAppStore.getState().setPrDraft(ROOT_TASK.id, API_REPO.repoPath, draft);
      useAppStore.getState().clearPrDraft(ROOT_TASK.id, WEB_REPO.repoPath);
    });

    expect(useAppStore.getState().prDrafts).toEqual({
      [repoKey(ROOT_TASK.id, API_REPO.repoPath)]: draft,
    });
  });

  it("drops the selection and the drafts when the workspace changes", () => {
    act(() => {
      useAppStore.getState().applyState(withRepos(API_REPO, WEB_REPO));
      useAppStore.getState().selectRepo(ROOT_TASK.id, WEB_REPO.repoPath);
      useAppStore.getState().setPrDraft(ROOT_TASK.id, WEB_REPO.repoPath, draft);
    });

    act(() => {
      useAppStore
        .getState()
        .applyState(makeState({ workspace: { name: "labs", path: "/home/dev/labs", repos: [] } }));
    });

    expect(useAppStore.getState().openRepo).toEqual({});
    expect(useAppStore.getState().prDrafts).toEqual({});
  });
});
