import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/wails";
import {
  addRepository,
  answerPermission,
  answerQuestion,
  approvePR,
  approveStep,
  backToStage,
  browseRepository,
  changeRepositoryPath,
  cleanAndStartStep,
  closeTask,
  continueStage,
  createTask,
  deleteTask,
  discardDraft,
  discardStage,
  discardStep,
  interrupt,
  loadTranscript,
  openExternal,
  openFileInEditor,
  openInEditor,
  openPR,
  pause,
  refreshPR,
  removePending,
  removeRepository,
  resume,
  retry,
  retryPR,
  retryStep,
  reviewAgain,
  reviewStepMyself,
  scanRepositories,
  sendMessage,
  setRepositoryFilter,
  setReviewMode,
  setReviewModeDefault,
  setStepReviewMode,
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
    await removeRepository("repo-1");
    await setRepositoryFilter("repo-2");
    await setTheme("dark");
    await setReviewModeDefault("agent");

    expect(api.removeRepository).toHaveBeenCalledWith("repo-1");
    expect(api.setRepositoryFilter).toHaveBeenCalledWith("repo-2");
    expect(api.setTheme).toHaveBeenCalledWith("dark");
    expect(api.setReviewModeDefault).toHaveBeenCalledWith("agent");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("stores the message of a rejected binding", async () => {
    vi.mocked(api.removeRepository).mockRejectedValueOnce(new Error("remove failed"));

    await removeRepository("repo-1");

    expect(useAppStore.getState().error).toBe("remove failed");
  });

  it("stores a rejection that is not an Error", async () => {
    vi.mocked(api.setRepositoryFilter).mockRejectedValueOnce("boom");

    await setRepositoryFilter("repo-1");

    expect(useAppStore.getState().error).toBe("boom");
  });

  it("leaves the snapshot untouched", async () => {
    await setRepositoryFilter("repo-1");

    expect(useAppStore.getState().app).toBeNull();
  });
});

// The screen that asked shows the refusal where the user is, so these
// reject instead of filling the banner.
describe("scanning, adding and moving a repository", () => {
  it("delegate to the matching binding", async () => {
    await scanRepositories();
    await addRepository("/home/dev/web");
    await browseRepository();
    await changeRepositoryPath("repo-1");

    expect(api.scanRepositories).toHaveBeenCalledOnce();
    expect(api.addRepository).toHaveBeenCalledWith("/home/dev/web");
    expect(api.browseRepository).toHaveBeenCalledOnce();
    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("reject instead of using the banner", async () => {
    vi.mocked(api.addRepository).mockRejectedValueOnce(new Error("not a git repository"));

    await expect(addRepository("/home/dev/web")).rejects.toThrow("not a git repository");
    expect(useAppStore.getState().error).toBeNull();
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
    await setReviewMode("task-1", "agent");
    await setStepReviewMode("task-1", 2, "manual");
    await reviewStepMyself("task-1");
    await openFileInEditor("task-1", "src/login.ts");
    await approvePR("task-1");
    await reviewAgain("task-1");
    await retryPR("task-1");
    await refreshPR("task-1");
    await closeTask("task-1");

    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
    expect(api.closeTask).toHaveBeenCalledWith("task-1");
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
    expect(api.setReviewMode).toHaveBeenCalledWith("task-1", "agent");
    expect(api.setStepReviewMode).toHaveBeenCalledWith("task-1", 2, "manual");
    expect(api.reviewStepMyself).toHaveBeenCalledWith("task-1");
    expect(api.openFileInEditor).toHaveBeenCalledWith("task-1", "src/login.ts");
    expect(api.approvePR).toHaveBeenCalledWith("task-1");
    expect(api.reviewAgain).toHaveBeenCalledWith("task-1");
    expect(api.retryPR).toHaveBeenCalledWith("task-1");
    expect(api.refreshPR).toHaveBeenCalledWith("task-1");
    expect(useAppStore.getState().error).toBeNull();
  });

  // The draft is the text of the user; it goes away once it has been sent, or
  // when the user throws it away.
  it("clear the pull request draft once it is out of the hands of the user", async () => {
    useAppStore.getState().setPrDraft("task-1", { title: "Log in", body: "why" });
    useAppStore.getState().setPrDraft("task-2", { title: "Log in", body: "why" });

    await openPR("task-1", "Log in", "why");

    expect(api.openPR).toHaveBeenCalledWith("task-1", "Log in", "why");
    expect(useAppStore.getState().prDrafts["task-1"]).toBeUndefined();

    await discardDraft("task-2");

    expect(api.discardDraft).toHaveBeenCalledWith("task-2");
    expect(useAppStore.getState().prDrafts["task-2"]).toBeUndefined();
  });

  it("keeps the draft when opening the pull request fails", async () => {
    const draft = { title: "Log in", body: "why" };
    useAppStore.getState().setPrDraft("task-1", draft);
    vi.mocked(api.openPR).mockRejectedValueOnce(new Error("the draft is empty"));

    await openPR("task-1", "Log in", "why");

    expect(useAppStore.getState().error).toBe("the draft is empty");
    expect(useAppStore.getState().prDrafts["task-1"]).toEqual(draft);
  });

  it("keeps what the deletion could not remove from disk", async () => {
    const leftover = {
      path: "/worktrees/dev/web/add-login",
      branch: "add-login",
      error: "permission denied",
    };
    vi.mocked(api.deleteTask).mockResolvedValueOnce({ leftover });

    await deleteTask("task-1");

    expect(useAppStore.getState().leftover).toEqual(leftover);
  });

  it("says nothing when the deletion left nothing behind", async () => {
    vi.mocked(api.deleteTask).mockResolvedValueOnce({ leftover: null });

    await deleteTask("task-1");

    expect(useAppStore.getState().leftover).toBeNull();
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

    const id = await createTask({
      name: "add-login",
      repositoryId: "repo-1",
      initialContext: "a login",
      mode: "",
      models: [],
      reviewMode: "",
    });

    expect(id).toBe("task-9");
  });

  it("rejects instead of using the banner, so the dialog can show the message", async () => {
    vi.mocked(api.createTask).mockRejectedValueOnce(new Error("claude is not logged in"));

    await expect(
      createTask({
        name: "add-login",
        repositoryId: "repo-1",
        initialContext: "a login",
        mode: "",
        models: [],
        reviewMode: "",
      }),
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
