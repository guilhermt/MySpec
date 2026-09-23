import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/wails";
import {
  addBoard,
  addDraftDependency,
  addRepository,
  addRepositoryToBoard,
  answerPermission,
  answerQuestion,
  applyReview,
  approvePR,
  approveReview,
  approveStep,
  archiveDiscussion,
  askReviewAgain,
  backToStage,
  browseRepository,
  cardContext,
  changeRepositoryPath,
  checkBoardRepository,
  chooseCloneFolder,
  cleanAndStartStep,
  cloneRepository,
  closeTask,
  continueStage,
  createTask,
  decideDraft,
  decideFinding,
  deleteDiscussion,
  deleteReview,
  deleteTask,
  discardDraft,
  discardStage,
  discardStep,
  discussionContext,
  groupIntoEpic,
  interrupt,
  loadTranscript,
  openExternal,
  openFileInEditor,
  openFindingInEditor,
  openInEditor,
  openPR,
  openReviewInEditor,
  pause,
  previewBoard,
  previewEditBoard,
  previewRemoveBoard,
  publishEpic,
  publishReview,
  refreshBoard,
  refreshCard,
  refreshPR,
  refreshPullRequests,
  removeBoard,
  removeDraftDependency,
  removePending,
  removeRepository,
  resume,
  retry,
  retryPR,
  retryPublish,
  retryStep,
  reviewAgain,
  reviewStepMyself,
  saveDraftText,
  saveFindingText,
  saveReviewSummary,
  scanRepositories,
  sendMessage,
  setDraftEpic,
  setDraftModule,
  setDraftRepository,
  setRepositoryFilter,
  setReviewFilters,
  setReviewInstructions,
  setReviewMode,
  setReviewModeDefault,
  setStepReviewMode,
  setTheme,
  startDiscussion,
  startReview,
  updateBoard,
} from "@/store/actions";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import {
  makeBoardPreview,
  makeBoardRepositoryOption,
  makeEntry,
  makeReviewFilters,
  makeTranscript,
} from "@/test/wails-mock";

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

describe("clone actions", () => {
  it("clone a repository and answer whether the clone started", async () => {
    vi.mocked(api.cloneRepository).mockResolvedValueOnce(false);

    expect(await cloneRepository("repo-1")).toBe(false);
    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("reject a clone that could not start instead of using the banner", async () => {
    vi.mocked(api.cloneRepository).mockRejectedValueOnce(new Error("Choose a clone folder first."));

    await expect(cloneRepository("repo-1")).rejects.toThrow("Choose a clone folder first.");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("report a clone folder that could not be chosen in the banner", async () => {
    vi.mocked(api.chooseCloneFolder).mockRejectedValueOnce(new Error("no chooser"));

    await chooseCloneFolder();

    expect(api.chooseCloneFolder).toHaveBeenCalledOnce();
    expect(useAppStore.getState().error).toBe("no chooser");
  });
});

// The dialogs and panels of the boards show the refusal where the user is, so
// these reject instead of filling the banner.
describe("board actions shown in place", () => {
  const req = { finalStatuses: ["done"], newCardStatus: "todo", repositories: [] };
  const choice = { owner: "dev", name: "api", path: "" };

  it("delegate to the matching binding and answer what it says", async () => {
    const preview = makeBoardPreview();
    const option = makeBoardRepositoryOption();
    vi.mocked(api.previewBoard).mockResolvedValueOnce(preview);
    vi.mocked(api.previewEditBoard).mockResolvedValueOnce(preview);
    vi.mocked(api.checkBoardRepository).mockResolvedValueOnce(option);

    expect(await previewBoard("https://github.com/orgs/dev/projects/3")).toBe(preview);
    expect(await previewEditBoard("board-1")).toBe(preview);
    expect(await checkBoardRepository("board-1", "dev/web")).toBe(option);
    await addBoard("https://github.com/orgs/dev/projects/3", req);
    await updateBoard("board-1", req);
    await removeBoard("board-1");
    await refreshCard("board-1", "dev/web#12");
    await addRepositoryToBoard("board-1", choice);

    expect(api.previewBoard).toHaveBeenCalledWith("https://github.com/orgs/dev/projects/3");
    expect(api.previewEditBoard).toHaveBeenCalledWith("board-1");
    expect(api.checkBoardRepository).toHaveBeenCalledWith("board-1", "dev/web");
    expect(api.addBoard).toHaveBeenCalledWith("https://github.com/orgs/dev/projects/3", req);
    expect(api.updateBoard).toHaveBeenCalledWith("board-1", req);
    expect(api.removeBoard).toHaveBeenCalledWith("board-1");
    expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");
    expect(api.addRepositoryToBoard).toHaveBeenCalledWith("board-1", choice);
  });

  it("reject instead of using the banner", async () => {
    vi.mocked(api.previewBoard).mockRejectedValueOnce(new Error("This board doesn't exist."));

    await expect(previewBoard("https://github.com/orgs/dev/projects/9")).rejects.toThrow(
      "This board doesn't exist.",
    );
    expect(useAppStore.getState().error).toBeNull();
  });
});

describe("board actions reported in the banner", () => {
  it("start a reading of a board", async () => {
    await refreshBoard("board-1");

    expect(api.refreshBoard).toHaveBeenCalledWith("board-1");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("answer what removing a board takes with it", async () => {
    vi.mocked(api.previewRemoveBoard).mockResolvedValueOnce({ toNoBoard: 2, removed: 1 });

    expect(await previewRemoveBoard("board-1")).toEqual({ toNoBoard: 2, removed: 1 });
  });

  it("answer null when the removal could not be previewed", async () => {
    vi.mocked(api.previewRemoveBoard).mockRejectedValueOnce(new Error("board gone"));

    expect(await previewRemoveBoard("board-1")).toBeNull();
    expect(useAppStore.getState().error).toBe("board gone");
  });

  it("answer the context of a card", async () => {
    vi.mocked(api.cardContext).mockResolvedValueOnce("### Card: Add the login screen");

    expect(await cardContext("board-1", "dev/web#12")).toBe("### Card: Add the login screen");
    expect(api.cardContext).toHaveBeenCalledWith("board-1", "dev/web#12");
  });

  it("answer an empty context when the card could not be read", async () => {
    vi.mocked(api.cardContext).mockRejectedValueOnce(new Error("card gone"));

    expect(await cardContext("board-1", "dev/web#12")).toBe("");
    expect(useAppStore.getState().error).toBe("card gone");
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
      card: null,
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
        card: null,
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

describe("review actions reported in the banner", () => {
  it("delegate to the matching binding", async () => {
    const filters = makeReviewFilters({ pendingOnly: true });

    await refreshPullRequests();
    await setReviewFilters(filters);
    await decideFinding("review-1", 1, 2, "approved");
    await saveFindingText("review-1", 1, 2, "The token is never cleared.");
    await saveReviewSummary("review-1", 1, "Two things to fix.");
    await applyReview("review-1");
    await approveReview("review-1");
    await openReviewInEditor("review-1");
    await openFindingInEditor("review-1", 1, 2);

    expect(api.refreshPullRequests).toHaveBeenCalledOnce();
    expect(api.setReviewFilters).toHaveBeenCalledWith(filters);
    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 2, "approved");
    expect(api.setFindingText).toHaveBeenCalledWith(
      "review-1",
      1,
      2,
      "The token is never cleared.",
    );
    expect(api.setReviewSummary).toHaveBeenCalledWith("review-1", 1, "Two things to fix.");
    expect(api.applyReview).toHaveBeenCalledWith("review-1");
    expect(api.approveReview).toHaveBeenCalledWith("review-1");
    expect(api.openReviewInEditor).toHaveBeenCalledWith("review-1");
    expect(api.openFindingInEditor).toHaveBeenCalledWith("review-1", 1, 2);
    expect(useAppStore.getState().error).toBeNull();
  });

  it("report a failed review action in the banner", async () => {
    vi.mocked(api.applyReview).mockRejectedValueOnce(new Error("the worktree is dirty"));

    await applyReview("review-1");

    expect(useAppStore.getState().error).toBe("the worktree is dirty");
  });

  it("answer whether the filters were stored", async () => {
    const filters = makeReviewFilters({ pendingOnly: true });

    expect(await setReviewFilters(filters)).toBe(true);

    vi.mocked(api.setReviewFilters).mockRejectedValueOnce(new Error("disk full"));

    expect(await setReviewFilters(filters)).toBe(false);
    expect(useAppStore.getState().error).toBe("disk full");
  });

  it("say what the deletion of a review left behind", async () => {
    const leftover = {
      path: "/home/dev/worktrees/dev/web/pr_31",
      branch: "",
      error: "the worktree is busy",
    };
    vi.mocked(api.deleteReview).mockResolvedValueOnce({ leftover });

    await deleteReview("review-1");

    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
    expect(useAppStore.getState().leftover).toEqual(leftover);
  });

  it("say nothing when the deletion of a review left nothing behind", async () => {
    await deleteReview("review-1");

    expect(useAppStore.getState().leftover).toBeNull();
  });
});

// The dialog or the panel that asked shows the refusal where the user is, so
// these reject instead of filling the banner.
describe("review actions shown in place", () => {
  const request = {
    repositoryId: "repo-1",
    number: 31,
    instructions: "",
    model: "claude-opus-5-5[1m]",
    effort: "high",
    mode: "publish",
  };

  it("delegate to the matching binding and answer what it says", async () => {
    vi.mocked(api.startReview).mockResolvedValueOnce("review-9");

    expect(await startReview(request)).toBe("review-9");
    await askReviewAgain("review-1", "look at the tests");
    await publishReview("review-1", "request_changes");
    await setReviewInstructions("repo-1", "Look at the migrations.");

    expect(api.startReview).toHaveBeenCalledWith(request);
    expect(api.askReviewAgain).toHaveBeenCalledWith("review-1", "look at the tests");
    expect(api.publishReview).toHaveBeenCalledWith("review-1", "request_changes");
    expect(api.setReviewInstructions).toHaveBeenCalledWith("repo-1", "Look at the migrations.");
  });

  it("reject instead of using the banner", async () => {
    vi.mocked(api.publishReview).mockRejectedValueOnce(new Error("gh is not authenticated"));

    await expect(publishReview("review-1", "approve")).rejects.toThrow("gh is not authenticated");
    expect(useAppStore.getState().error).toBeNull();
  });
});

describe("discussion actions reported in the banner", () => {
  it("delegate to the matching binding", async () => {
    await saveDraftText("discussion-1", "draft-1", "Export the invoices", "A button.");
    await setDraftRepository("discussion-1", "draft-1", "repo-2");
    await setDraftModule("discussion-1", "draft-1", "Billing");
    await setDraftEpic("discussion-1", "draft-1", "draft-2");
    await removeDraftDependency("discussion-1", "draft-1", "draft-3");
    await decideDraft("discussion-1", "draft-1", "approved");
    await retryPublish("discussion-1", "draft-1");
    await archiveDiscussion("discussion-1");
    await deleteDiscussion("discussion-1");

    expect(api.setDraftText).toHaveBeenCalledWith(
      "discussion-1",
      "draft-1",
      "Export the invoices",
      "A button.",
    );
    expect(api.setDraftRepository).toHaveBeenCalledWith("discussion-1", "draft-1", "repo-2");
    expect(api.setDraftModule).toHaveBeenCalledWith("discussion-1", "draft-1", "Billing");
    expect(api.setDraftEpic).toHaveBeenCalledWith("discussion-1", "draft-1", "draft-2");
    expect(api.removeDraftDependency).toHaveBeenCalledWith("discussion-1", "draft-1", "draft-3");
    expect(api.decideDraft).toHaveBeenCalledWith("discussion-1", "draft-1", "approved");
    expect(api.retryPublish).toHaveBeenCalledWith("discussion-1", "draft-1");
    expect(api.archiveDiscussion).toHaveBeenCalledWith("discussion-1");
    expect(api.deleteDiscussion).toHaveBeenCalledWith("discussion-1");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("report a failed discussion action in the banner", async () => {
    vi.mocked(api.archiveDiscussion).mockRejectedValueOnce(
      new Error("a draft is still publishing"),
    );

    await archiveDiscussion("discussion-1");

    expect(useAppStore.getState().error).toBe("a draft is still publishing");
  });

  it("answer the id of the epic the drafts were grouped into", async () => {
    vi.mocked(api.groupIntoEpic).mockResolvedValueOnce("draft-epic");

    expect(await groupIntoEpic("discussion-1", ["draft-1", "draft-2"])).toBe("draft-epic");
    expect(api.groupIntoEpic).toHaveBeenCalledWith("discussion-1", ["draft-1", "draft-2"]);
  });

  it("answer an empty id when the drafts could not be grouped", async () => {
    vi.mocked(api.groupIntoEpic).mockRejectedValueOnce(new Error("a draft is published"));

    expect(await groupIntoEpic("discussion-1", ["draft-1"])).toBe("");
    expect(useAppStore.getState().error).toBe("a draft is published");
  });
});

// The dialog and the cards of the drafts show the refusal where the user is, so
// these reject instead of filling the banner.
describe("discussion actions shown in place", () => {
  const request = {
    boardId: "board-1",
    title: "Invoices",
    text: "Split the invoices screen.",
    cards: ["dev/web#12"],
    model: "claude-opus-5-5[1m]",
    effort: "high",
  };

  it("delegate to the matching binding and answer what it says", async () => {
    vi.mocked(api.startDiscussion).mockResolvedValueOnce("discussion-9");
    vi.mocked(api.discussionContext).mockResolvedValueOnce("## Board\nRoadmap");
    const context = { boardId: "board-1", text: "Split it.", cards: ["dev/web#12"] };

    expect(await startDiscussion(request)).toBe("discussion-9");
    expect(await discussionContext(context)).toBe("## Board\nRoadmap");
    await addDraftDependency("discussion-1", "draft-1", "draft-2");
    await publishEpic("discussion-1", "draft-epic");

    expect(api.startDiscussion).toHaveBeenCalledWith(request);
    expect(api.discussionContext).toHaveBeenCalledWith(context);
    expect(api.addDraftDependency).toHaveBeenCalledWith("discussion-1", "draft-1", "draft-2");
    expect(api.publishEpic).toHaveBeenCalledWith("discussion-1", "draft-epic");
  });

  it("reject instead of using the banner", async () => {
    vi.mocked(api.startDiscussion).mockRejectedValueOnce(new Error("This board has no clone."));
    vi.mocked(api.addDraftDependency).mockRejectedValueOnce(new Error("This draft doesn't exist."));

    await expect(startDiscussion(request)).rejects.toThrow("This board has no clone.");
    await expect(addDraftDependency("discussion-1", "draft-1", "draft-9")).rejects.toThrow(
      "This draft doesn't exist.",
    );
    expect(useAppStore.getState().error).toBeNull();
  });
});
