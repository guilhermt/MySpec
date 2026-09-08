import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/wails";
import {
  answerPermission,
  answerQuestion,
  approveStep,
  backToStage,
  cleanAndStartStep,
  continueStage,
  createTask,
  deleteTask,
  discardStage,
  discardStep,
  dismissNotice,
  interrupt,
  loadTranscript,
  openExternal,
  openFileInEditor,
  openFolderDialog,
  openInEditor,
  openPath,
  pause,
  removePending,
  removeRecent,
  resume,
  retry,
  retryStep,
  sendMessage,
  setTheme,
} from "@/store/actions";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeEntry, makeTranscript } from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

describe("actions", () => {
  it("delegate to the matching binding", async () => {
    await openPath("/home/dev/projects");
    await openFolderDialog();
    await removeRecent("/home/dev/labs");
    await dismissNotice();
    await setTheme("dark");

    expect(api.openPath).toHaveBeenCalledWith("/home/dev/projects");
    expect(api.openFolderDialog).toHaveBeenCalledOnce();
    expect(api.removeRecent).toHaveBeenCalledWith("/home/dev/labs");
    expect(api.dismissNotice).toHaveBeenCalledOnce();
    expect(api.setTheme).toHaveBeenCalledWith("dark");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("stores the message of a rejected binding", async () => {
    vi.mocked(api.openPath).mockRejectedValueOnce(new Error("open failed"));

    await openPath("/home/dev/gone");

    expect(useAppStore.getState().error).toBe("open failed");
  });

  it("stores a rejection that is not an Error", async () => {
    vi.mocked(api.dismissNotice).mockRejectedValueOnce("boom");

    await dismissNotice();

    expect(useAppStore.getState().error).toBe("boom");
  });

  it("leaves the snapshot untouched", async () => {
    await openPath("/home/dev/projects");

    expect(useAppStore.getState().app).toBeNull();
  });
});

describe("task actions", () => {
  it("delegate to the matching binding", async () => {
    await deleteTask("task-1");
    await sendMessage("task-1", "prd", "go on");
    await removePending("task-1", "prd", "entry-1");
    await interrupt("task-1", "prd");
    await pause("task-1", "prd");
    await resume("task-1", "prd");
    await retry("task-1", "prd");
    await answerPermission("task-1", "prd", "req-1", "allow_session", "");
    await answerQuestion("task-1", "prd", "req-1", { "Which database?": "SQLite" });
    await openExternal("https://anthropic.com");
    await backToStage("task-1", "prd");
    await discardStage("task-1", "tech_spec");
    await continueStage("task-1");
    await retryStep("task-1");
    await cleanAndStartStep("task-1");
    await discardStep("task-1", true);
    await openInEditor("task-1");
    await approveStep("task-1");
    await openFileInEditor("task-1", "src/login.ts");

    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "go on");
    expect(api.removePending).toHaveBeenCalledWith("task-1", "prd", "entry-1");
    expect(api.interrupt).toHaveBeenCalledWith("task-1", "prd");
    expect(api.pause).toHaveBeenCalledWith("task-1", "prd");
    expect(api.resume).toHaveBeenCalledWith("task-1", "prd");
    expect(api.retry).toHaveBeenCalledWith("task-1", "prd");
    expect(api.answerPermission).toHaveBeenCalledWith(
      "task-1",
      "prd",
      "req-1",
      "allow_session",
      "",
    );
    expect(api.answerQuestion).toHaveBeenCalledWith("task-1", "prd", "req-1", {
      "Which database?": "SQLite",
    });
    expect(api.openExternal).toHaveBeenCalledWith("https://anthropic.com");
    expect(api.backToStage).toHaveBeenCalledWith("task-1", "prd");
    expect(api.discardStage).toHaveBeenCalledWith("task-1", "tech_spec");
    expect(api.continueStage).toHaveBeenCalledWith("task-1");
    expect(api.retryStep).toHaveBeenCalledWith("task-1");
    expect(api.cleanAndStartStep).toHaveBeenCalledWith("task-1");
    expect(api.discardStep).toHaveBeenCalledWith("task-1", true);
    expect(api.openInEditor).toHaveBeenCalledWith("task-1");
    expect(api.approveStep).toHaveBeenCalledWith("task-1");
    expect(api.openFileInEditor).toHaveBeenCalledWith("task-1", "src/login.ts");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("reports a failed task action in the banner", async () => {
    vi.mocked(api.pause).mockRejectedValueOnce(new Error("no session"));

    await pause("task-1", "prd");

    expect(useAppStore.getState().error).toBe("no session");
  });
});

describe("createTask", () => {
  it("answers with the id of the new task", async () => {
    vi.mocked(api.createTask).mockResolvedValueOnce("task-9");

    const id = await createTask({ name: "add-login", repoPath: "", initialContext: "a login" });

    expect(id).toBe("task-9");
  });

  it("rejects instead of using the banner, so the dialog can show the message", async () => {
    vi.mocked(api.createTask).mockRejectedValueOnce(new Error("claude is not logged in"));

    await expect(
      createTask({ name: "add-login", repoPath: "", initialContext: "a login" }),
    ).rejects.toThrow("claude is not logged in");
    expect(useAppStore.getState().error).toBeNull();
  });
});

describe("loadTranscript", () => {
  it("marks the conversation loading and fills it with the answer", async () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({ taskId: "task-1", entries: [entry] }),
    );

    const loading = loadTranscript("task-1", "prd");
    expect(useAppStore.getState().transcripts["task-1|prd"]?.status).toBe("loading");
    await loading;

    const transcript = useAppStore.getState().transcripts["task-1|prd"];
    expect(transcript?.status).toBe("ready");
    expect(transcript?.entries).toEqual([entry]);
  });

  it("reports a conversation it could not read", async () => {
    vi.mocked(api.getTranscript).mockRejectedValueOnce(new Error("no such task"));

    await loadTranscript("task-1", "prd");

    expect(useAppStore.getState().error).toBe("no such task");
  });
});
