import { Browser, Call, Events } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asActionStatus,
  asBlockReason,
  asBoardFailureReason,
  asCardAction,
  asCloseOutcome,
  asCloseSkipReason,
  asEntryKind,
  asErrorKind,
  asFindingDecision,
  asFindingPlacement,
  asIssueState,
  asMarkerType,
  asMigrationCaseKind,
  asModelStage,
  asPermissionStatus,
  asPlaceKind,
  asPRState,
  asPRStatus,
  asPromptStage,
  asPullRequestAction,
  asPullRequestOutcome,
  asPullRequestState,
  asPullReviewMode,
  asPullReviewStatus,
  asRepositoryLinkKind,
  asReviewFallback,
  asReviewFileKind,
  asReviewMode,
  asReviewVerdict,
  asSessionStatus,
  asSituationForm,
  asSituationGroup,
  asSituationKind,
  asStepStatus,
  asTaskMode,
  asTaskStage,
  asThemePreference,
  asTranscriptEventKind,
} from "@/lib/wails";
import { makeSituation, makeState } from "@/test/wails-mock";

// The mock of @/lib/wails replaces the boundary; these cases exercise the real
// module against a fake runtime.
const wails = await vi.importActual<typeof import("@/lib/wails")>("@/lib/wails");

beforeEach(() => {
  vi.mocked(Call.ByID).mockClear();
  vi.mocked(Events.On).mockClear();
  vi.mocked(Browser.OpenURL).mockClear();
});

describe("asThemePreference", () => {
  it("keeps the known preferences", () => {
    expect(asThemePreference("light")).toBe("light");
    expect(asThemePreference("dark")).toBe("dark");
    expect(asThemePreference("system")).toBe("system");
  });

  it("falls back to system", () => {
    expect(asThemePreference("sepia")).toBe("system");
  });
});

describe("narrowing", () => {
  it("keeps the values Go sends", () => {
    expect(asTaskMode("structured")).toBe("structured");
    expect(asTaskMode("one_shot")).toBe("one_shot");
    expect(asTaskStage("tech_spec")).toBe("tech_spec");
    expect(asTaskStage("plan")).toBe("plan");
    expect(asTaskStage("one_shot")).toBe("one_shot");
    expect(asTaskStage("implementation")).toBe("implementation");
    expect(asTaskStage("pr")).toBe("pr");
    expect(asModelStage("prd")).toBe("prd");
    expect(asModelStage("tech_spec")).toBe("tech_spec");
    expect(asModelStage("plan")).toBe("plan");
    expect(asModelStage("one_shot")).toBe("one_shot");
    expect(asModelStage("implementation")).toBe("implementation");
    expect(asModelStage("step_review")).toBe("step_review");
    expect(asModelStage("pr")).toBe("pr");
    expect(asModelStage("pr_review")).toBe("pr_review");
    expect(asPromptStage("prd")).toBe("prd");
    expect(asPromptStage("tech_spec")).toBe("tech_spec");
    expect(asPromptStage("plan")).toBe("plan");
    expect(asPromptStage("one_shot")).toBe("one_shot");
    expect(asPromptStage("step_review")).toBe("step_review");
    expect(asPromptStage("commit")).toBe("commit");
    expect(asPromptStage("pr")).toBe("pr");
    expect(asPromptStage("pr_review")).toBe("pr_review");
    expect(asSessionStatus("needs_permission")).toBe("needs_permission");
    expect(asSessionStatus("needs_answer")).toBe("needs_answer");
    expect(asEntryKind("permission")).toBe("permission");
    expect(asActionStatus("interrupted")).toBe("interrupted");
    expect(asPermissionStatus("allowed_session")).toBe("allowed_session");
    expect(asMarkerType("prd_updated")).toBe("prd_updated");
    expect(asMarkerType("tech_spec_written")).toBe("tech_spec_written");
    expect(asMarkerType("tech_spec_updated")).toBe("tech_spec_updated");
    expect(asMarkerType("plan_written")).toBe("plan_written");
    expect(asMarkerType("plan_updated")).toBe("plan_updated");
    expect(asMarkerType("one_shot_written")).toBe("one_shot_written");
    expect(asMarkerType("one_shot_updated")).toBe("one_shot_updated");
    expect(asMarkerType("pr_review_written")).toBe("pr_review_written");
    expect(asMarkerType("step_review_started")).toBe("step_review_started");
    expect(asMarkerType("step_review_written")).toBe("step_review_written");
    expect(asMarkerType("stage_started")).toBe("stage_started");
    expect(asMarkerType("step_started")).toBe("step_started");
    expect(asStepStatus("preparing")).toBe("preparing");
    expect(asStepStatus("blocked")).toBe("blocked");
    expect(asStepStatus("implementing")).toBe("implementing");
    expect(asStepStatus("agent_review")).toBe("agent_review");
    expect(asStepStatus("addressing_review")).toBe("addressing_review");
    expect(asStepStatus("awaiting_review")).toBe("awaiting_review");
    expect(asStepStatus("in_review")).toBe("in_review");
    expect(asStepStatus("ready_to_approve")).toBe("ready_to_approve");
    expect(asStepStatus("nothing_to_commit")).toBe("nothing_to_commit");
    expect(asStepStatus("review_failed")).toBe("review_failed");
    expect(asStepStatus("committing")).toBe("committing");
    expect(asStepStatus("done")).toBe("done");
    expect(asPRStatus("preparing")).toBe("preparing");
    expect(asPRStatus("blocked")).toBe("blocked");
    expect(asPRStatus("drafting")).toBe("drafting");
    expect(asPRStatus("draft_ready")).toBe("draft_ready");
    expect(asPRStatus("awaiting_reply")).toBe("awaiting_reply");
    expect(asPRStatus("opening")).toBe("opening");
    expect(asPRStatus("reviewing")).toBe("reviewing");
    expect(asPRStatus("awaiting_decision")).toBe("awaiting_decision");
    expect(asPRStatus("in_review")).toBe("in_review");
    expect(asPRStatus("ready_to_approve")).toBe("ready_to_approve");
    expect(asPRStatus("committing")).toBe("committing");
    expect(asPRStatus("done")).toBe("done");
    expect(asPRStatus("merged")).toBe("merged");
    expect(asPRStatus("pr_closed")).toBe("pr_closed");
    expect(asPRStatus("closing")).toBe("closing");
    expect(asPRStatus("closed")).toBe("closed");
    expect(asCloseOutcome("done")).toBe("done");
    expect(asCloseOutcome("skipped")).toBe("skipped");
    expect(asCloseOutcome("failed")).toBe("failed");
    expect(asCloseSkipReason("missing")).toBe("missing");
    expect(asCloseSkipReason("not_merged")).toBe("not_merged");
    expect(asCloseSkipReason("not_checked_out")).toBe("not_checked_out");
    expect(asCloseSkipReason("dirty")).toBe("dirty");
    expect(asCloseSkipReason("no_upstream")).toBe("no_upstream");
    expect(asCloseSkipReason("diverged")).toBe("diverged");
    expect(asCloseSkipReason("up_to_date")).toBe("up_to_date");
    expect(asPRState("open")).toBe("open");
    expect(asPRState("merged")).toBe("merged");
    expect(asPRState("closed")).toBe("closed");
    expect(asReviewFileKind("added")).toBe("added");
    expect(asReviewFileKind("modified")).toBe("modified");
    expect(asReviewFileKind("deleted")).toBe("deleted");
    expect(asReviewFileKind("renamed")).toBe("renamed");
    expect(asReviewFileKind("untracked")).toBe("untracked");
    expect(asBlockReason("dirty_worktree")).toBe("dirty_worktree");
    expect(asBlockReason("fetch_failed")).toBe("fetch_failed");
    expect(asBlockReason("no_base_branch")).toBe("no_base_branch");
    expect(asBlockReason("path_exists")).toBe("path_exists");
    expect(asBlockReason("branch_exists")).toBe("branch_exists");
    expect(asBlockReason("clone_missing")).toBe("clone_missing");
    expect(asErrorKind("not_logged_in")).toBe("not_logged_in");
    expect(asTranscriptEventKind("text")).toBe("text");
    expect(asSituationKind("session_error")).toBe("session_error");
    expect(asSituationKind("step_blocked")).toBe("step_blocked");
    expect(asSituationKind("worktree_unreadable")).toBe("worktree_unreadable");
    expect(asSituationKind("pr_blocked")).toBe("pr_blocked");
    expect(asSituationKind("plan_invalid")).toBe("plan_invalid");
    expect(asSituationKind("pr_closed")).toBe("pr_closed");
    expect(asSituationKind("permission")).toBe("permission");
    expect(asSituationKind("question")).toBe("question");
    expect(asSituationKind("reply")).toBe("reply");
    for (const action of [
      "start",
      "clone",
      "clone_missing",
      "add_to_board",
      "other_board",
      "has_task",
      "closed",
    ]) {
      expect(asCardAction(action)).toBe(action);
    }
    for (const reason of [
      "gh_missing",
      "gh_unauthenticated",
      "missing_scope",
      "not_found",
      "rate_limited",
      "failed",
    ]) {
      expect(asBoardFailureReason(reason)).toBe(reason);
    }
    for (const link of ["registered", "clone", "uncloned", "other_board"]) {
      expect(asRepositoryLinkKind(link)).toBe(link);
    }
    expect(asIssueState("closed")).toBe("closed");
    expect(asPullRequestState("merged")).toBe("merged");
    expect(asPullRequestState("closed")).toBe("closed");
    expect(asSituationKind("ready_to_continue")).toBe("ready_to_continue");
    expect(asSituationKind("step_review")).toBe("step_review");
    expect(asSituationKind("step_empty")).toBe("step_empty");
    expect(asSituationKind("draft")).toBe("draft");
    expect(asSituationKind("findings")).toBe("findings");
    expect(asSituationKind("changes_review")).toBe("changes_review");
    expect(asSituationKind("merge")).toBe("merge");
    expect(asSituationGroup("error")).toBe("error");
    expect(asSituationGroup("waiting")).toBe("waiting");
    expect(asSituationGroup("closing")).toBe("closing");
    expect(asSituationForm("")).toBe("");
    expect(asSituationForm("review")).toBe("review");
    expect(asSituationForm("staged")).toBe("staged");
    expect(asSituationForm("approve")).toBe("approve");
    expect(asSituationForm("merge")).toBe("merge");
    expect(asSituationForm("close")).toBe("close");
    expect(asPlaceKind("stage")).toBe("stage");
    expect(asPlaceKind("step")).toBe("step");
    expect(asPlaceKind("step_review")).toBe("step_review");
    expect(asPlaceKind("pr")).toBe("pr");
    expect(asReviewMode("manual")).toBe("manual");
    expect(asReviewMode("agent")).toBe("agent");
    expect(asReviewFallback("")).toBe("");
    expect(asReviewFallback("taken_over")).toBe("taken_over");
    expect(asReviewFallback("rounds_exhausted")).toBe("rounds_exhausted");
    expect(asReviewFallback("commit_failed")).toBe("commit_failed");
    expect(asMigrationCaseKind("root_task")).toBe("root_task");
    expect(asMigrationCaseKind("no_origin")).toBe("no_origin");
    expect(asMigrationCaseKind("name_conflict")).toBe("name_conflict");
    expect(asMarkerType("review_started")).toBe("review_started");
    expect(asSituationKind("review_report")).toBe("review_report");
    expect(asSituationKind("new_commits")).toBe("new_commits");
    expect(asSituationKind("publish_failed")).toBe("publish_failed");
    expect(asSituationForm("decide")).toBe("decide");
    expect(asSituationForm("publish")).toBe("publish");
    expect(asSituationForm("apply")).toBe("apply");
    expect(asPlaceKind("review")).toBe("review");
    expect(asPullReviewMode("publish")).toBe("publish");
    expect(asPullReviewMode("apply")).toBe("apply");
    for (const status of [
      "reviewing",
      "awaiting_reply",
      "awaiting_decision",
      "ready_to_publish",
      "publish_failed",
      "published",
      "new_commits",
      "ready_to_apply",
      "applying",
      "in_review",
      "ready_to_approve",
      "committing",
      "ready_to_merge",
    ]) {
      expect(asPullReviewStatus(status)).toBe(status);
    }
    expect(asReviewVerdict("approve")).toBe("approve");
    expect(asReviewVerdict("request_changes")).toBe("request_changes");
    expect(asReviewVerdict("comment")).toBe("comment");
    expect(asFindingDecision("")).toBe("");
    expect(asFindingDecision("approved")).toBe("approved");
    expect(asFindingDecision("discarded")).toBe("discarded");
    expect(asFindingPlacement("")).toBe("");
    expect(asFindingPlacement("inline")).toBe("inline");
    expect(asFindingPlacement("body")).toBe("body");
    for (const action of ["review", "open_review", "open_task", "clone", "clone_missing", "fork"]) {
      expect(asPullRequestAction(action)).toBe(action);
    }
    expect(asPullRequestOutcome("merged")).toBe("merged");
    expect(asPullRequestOutcome("closed")).toBe("closed");
  });

  it("falls back on a value a newer backend invented", () => {
    expect(asTaskMode("guided")).toBe("structured");
    expect(asTaskStage("archived")).toBe("prd");
    // The commit has no model of its own, and a step has no editable prompt.
    expect(asModelStage("commit")).toBe("prd");
    expect(asPromptStage("implementation")).toBe("prd");
    expect(asSessionStatus("hibernating")).toBe("waiting");
    expect(asEntryKind("diagram")).toBe("marker");
    expect(asActionStatus("queued")).toBe("done");
    expect(asPermissionStatus("expired")).toBe("cancelled");
    expect(asMarkerType("branched")).toBe("compacted");
    expect(asStepStatus("rebasing")).toBe("not_started");
    expect(asPRStatus("rebasing")).toBe("preparing");
    expect(asCloseOutcome("pending")).toBe("failed");
    expect(asCloseSkipReason("detached")).toBe("missing");
    // "" is what the app carries before gh has said anything.
    expect(asPRState("draft")).toBe("");
    expect(asPRState("")).toBe("");
    expect(asReviewFileKind("copied")).toBe("modified");
    expect(asBlockReason("rebase_in_progress")).toBe("git_failed");
    expect(asErrorKind("out_of_quota")).toBe("turn_error");
    expect(asTranscriptEventKind("patch")).toBe("reset");
    expect(asSituationKind("reminder")).toBe("reply");
    expect(asCardAction("archive")).toBe("add_to_board");
    expect(asBoardFailureReason("timeout")).toBe("failed");
    expect(asRepositoryLinkKind("fork")).toBe("uncloned");
    expect(asIssueState("draft")).toBe("open");
    expect(asPullRequestState("draft")).toBe("open");
    expect(asSituationGroup("someday")).toBe("waiting");
    expect(asSituationForm("rebase")).toBe("");
    expect(asPlaceKind("workspace")).toBe("stage");
    expect(asReviewMode("auto")).toBe("manual");
    expect(asReviewFallback("paused")).toBe("");
    expect(asMigrationCaseKind("multi_repository")).toBe("root_task");
    expect(asPullReviewMode("suggest")).toBe("publish");
    expect(asPullReviewStatus("rebasing")).toBe("reviewing");
    // Comment judges nothing, and a fork is the action that does nothing.
    expect(asReviewVerdict("reject")).toBe("comment");
    expect(asPullRequestAction("merge")).toBe("fork");
    expect(asPullRequestOutcome("open")).toBe("closed");
    expect(asFindingDecision("deferred")).toBe("");
    expect(asFindingPlacement("thread")).toBe("");
  });
});

describe("REVIEW_STAGE", () => {
  it("is the stage of the conversation of a review", () => {
    expect(wails.REVIEW_STAGE).toBe("review");
  });
});

describe("sessionKey", () => {
  it("names a conversation by its task and stage", () => {
    expect(wails.sessionKey("task-1", "prd")).toBe("task-1|prd");
    expect(wails.sessionKey("task-1", "step:2")).toBe("task-1|step:2");
  });

  it("tells the stages of one task apart", () => {
    expect(wails.sessionKey("task-1", "prd")).not.toBe(wails.sessionKey("task-1", "tech_spec"));
  });
});

describe("api", () => {
  it("calls one binding per method", async () => {
    await wails.api.getState();
    await wails.api.scanRepositories();
    await wails.api.addRepository("/home/dev/web");
    await wails.api.browseRepository();
    await wails.api.changeRepositoryPath("repo-1");
    await wails.api.removeRepository("repo-1");
    await wails.api.setRepositoryFilter("repo-1");
    await wails.api.setTheme("dark");
    await wails.api.setModelDefault("pr", "claude-opus-5", "medium");
    await wails.api.setReviewModeDefault("agent");
    await wails.api.getPrompt("prd");
    await wails.api.savePrompt("prd", "# PRD");
    await wails.api.restorePrompt("prd");

    await wails.api.createTask({
      name: "add-login",
      repositoryId: "repo-1",
      initialContext: "a login",
      mode: "",
      models: [],
      reviewMode: "",
      card: null,
    });
    await wails.api.deleteTask("task-1");
    await wails.api.getTranscript("task-1", "prd");
    await wails.api.sendMessage("task-1", "prd", "go on");
    await wails.api.removePending("task-1", "prd", "entry-1");
    await wails.api.interrupt("task-1", "prd");
    await wails.api.pause("task-1", "prd");
    await wails.api.resume("task-1", "prd");
    await wails.api.retry("task-1", "prd");
    await wails.api.answerPermission("task-1", "prd", "req-1", "allow", "");
    await wails.api.answerQuestion("task-1", "prd", "req-1", { "Which database?": "SQLite" });
    await wails.api.readArtifact("task-1", "PRD.md");
    await wails.api.backToStage("task-1", "prd");
    await wails.api.discardStage("task-1", "tech_spec");
    await wails.api.continueStage("task-1");
    await wails.api.retryStep("task-1");
    await wails.api.cleanAndStartStep("task-1");
    await wails.api.discardStep("task-1", true);
    await wails.api.setStageModel("task-1", "plan", "claude-fable-5-1", "high");
    await wails.api.setStepModel("task-1", 2, "claude-opus-5", "xhigh");
    await wails.api.setSessionModel("task-1", "prd", "claude-sonnet-5", "low");
    await wails.api.setReviewMode("task-1", "agent");
    await wails.api.setStepReviewMode("task-1", 2, "manual");
    await wails.api.reviewStepMyself("task-1");
    await wails.api.openInEditor("task-1");
    await wails.api.approveStep("task-1");
    await wails.api.openFileInEditor("task-1", "src/login.ts");
    await wails.api.openPR("task-1", "Log in", "why");
    await wails.api.approvePR("task-1");
    await wails.api.reviewAgain("task-1");
    await wails.api.discardDraft("task-1");
    await wails.api.retryPR("task-1");
    await wails.api.refreshPR("task-1");
    await wails.api.closeTask("task-1");
    await wails.api.previewDelete("task-1");
    await wails.api.viewSituation("situation-1");
    await wails.api.cloneRepository("repo-1");
    await wails.api.chooseCloneFolder();
    const request = { finalStatuses: ["done"], repositories: [] };
    const choice = { owner: "dev", name: "web", path: "" };
    await wails.api.previewBoard("https://github.com/orgs/dev/projects/3");
    await wails.api.previewEditBoard("board-1");
    await wails.api.checkBoardRepository("board-1", "dev/web");
    await wails.api.addBoard("https://github.com/orgs/dev/projects/3", request);
    await wails.api.updateBoard("board-1", request);
    await wails.api.previewRemoveBoard("board-1");
    await wails.api.removeBoard("board-1");
    await wails.api.refreshBoard("board-1");
    await wails.api.refreshCard("board-1", "dev/web#12");
    await wails.api.cardContext("board-1", "dev/web#12");
    await wails.api.addRepositoryToBoard("board-1", choice);
    await wails.api.setReviewInstructions("repo-1", "Look at the migrations.");
    await wails.api.refreshPullRequests();
    await wails.api.setReviewFilters({
      boardId: "",
      repositoryId: "repo-1",
      authorsInclude: [],
      authorsExclude: ["dependabot"],
      labelsInclude: [],
      labelsExclude: [],
      pendingOnly: true,
    });
    await wails.api.startReview({
      repositoryId: "repo-1",
      number: 31,
      instructions: "",
      model: "claude-opus-5",
      effort: "high",
      mode: "publish",
    });
    await wails.api.askReviewAgain("review-1", "look at the tests");
    await wails.api.decideFinding("review-1", 1, 2, "approved");
    await wails.api.setFindingText("review-1", 1, 2, "The token is never cleared.");
    await wails.api.setReviewSummary("review-1", 1, "Two things to fix.");
    await wails.api.publishReview("review-1", "request_changes");
    await wails.api.applyReview("review-1");
    await wails.api.approveReview("review-1");
    await wails.api.deleteReview("review-1");
    await wails.api.readReviewArtifact("review-1", "review-1.md");
    await wails.api.openReviewInEditor("review-1");
    await wails.api.openFindingInEditor("review-1", 1, 2);

    expect(Call.ByID).toHaveBeenCalledTimes(77);
    const ids = vi.mocked(Call.ByID).mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(77);
  });

  it("opens a link in the browser of the desktop, never in the webview", async () => {
    await wails.api.openExternal("https://anthropic.com");

    expect(Browser.OpenURL).toHaveBeenCalledWith("https://anthropic.com");
    expect(Call.ByID).not.toHaveBeenCalled();
  });
});

describe("onTranscriptChanged", () => {
  it("hands the event payload to the handler", () => {
    const handler = vi.fn();
    const event = { taskId: "task-1", kind: "reset", entry: null, entryId: "", text: "" };

    wails.onTranscriptChanged(handler);
    const registered = vi.mocked(Events.On).mock.calls[0]?.[1];
    registered?.({ name: "transcript:changed", data: event });

    expect(vi.mocked(Events.On).mock.calls[0]?.[0]).toBe("transcript:changed");
    expect(handler).toHaveBeenCalledWith(event);
  });
});

describe("onStateChanged", () => {
  it("hands the event payload to the handler and returns the unsubscribe", () => {
    const unsubscribe = vi.fn();
    vi.mocked(Events.On).mockReturnValueOnce(unsubscribe);
    const handler = vi.fn();
    const state = makeState();

    const stop = wails.onStateChanged(handler);
    const registered = vi.mocked(Events.On).mock.calls[0]?.[1];
    registered?.({ name: "state:changed", data: state });

    expect(vi.mocked(Events.On).mock.calls[0]?.[0]).toBe("state:changed");
    expect(handler).toHaveBeenCalledWith(state);
    expect(stop).toBe(unsubscribe);
  });
});

describe("onSituationStarted", () => {
  it("hands the event payload to the handler and returns the unsubscribe", () => {
    const unsubscribe = vi.fn();
    vi.mocked(Events.On).mockReturnValueOnce(unsubscribe);
    const handler = vi.fn();
    const event = { situation: makeSituation(), focused: false };

    const stop = wails.onSituationStarted(handler);
    const registered = vi.mocked(Events.On).mock.calls[0]?.[1];
    registered?.({ name: "situation:started", data: event });

    expect(vi.mocked(Events.On).mock.calls[0]?.[0]).toBe("situation:started");
    expect(handler).toHaveBeenCalledWith(event);
    expect(stop).toBe(unsubscribe);
  });
});

describe("onSituationOpen", () => {
  it("hands the event payload to the handler and returns the unsubscribe", () => {
    const unsubscribe = vi.fn();
    vi.mocked(Events.On).mockReturnValueOnce(unsubscribe);
    const handler = vi.fn();
    const event = { taskId: "task-1", place: makeSituation().place };

    const stop = wails.onSituationOpen(handler);
    const registered = vi.mocked(Events.On).mock.calls[0]?.[1];
    registered?.({ name: "situation:open", data: event });

    expect(vi.mocked(Events.On).mock.calls[0]?.[0]).toBe("situation:open");
    expect(handler).toHaveBeenCalledWith(event);
    expect(stop).toBe(unsubscribe);
  });
});
