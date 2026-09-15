import { Browser, Call, Events } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asActionStatus,
  asBlockReason,
  asCloseOutcome,
  asCloseSkipReason,
  asEntryKind,
  asErrorKind,
  asMarkerType,
  asModelStage,
  asNoticeReason,
  asPermissionStatus,
  asPlaceKind,
  asPRState,
  asPromptStage,
  asRepoStatus,
  asReviewFallback,
  asReviewFileKind,
  asReviewMode,
  asSessionStatus,
  asSituationForm,
  asSituationGroup,
  asSituationKind,
  asStepStatus,
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

describe("asNoticeReason", () => {
  it("keeps the known reasons", () => {
    expect(asNoticeReason("not_found")).toBe("not_found");
    expect(asNoticeReason("not_directory")).toBe("not_directory");
    expect(asNoticeReason("not_readable")).toBe("not_readable");
    expect(asNoticeReason("last_recent_missing")).toBe("last_recent_missing");
  });

  it("falls back to not_readable", () => {
    expect(asNoticeReason("whatever")).toBe("not_readable");
  });
});

describe("narrowing", () => {
  it("keeps the values Go sends", () => {
    expect(asTaskStage("tech_spec")).toBe("tech_spec");
    expect(asTaskStage("plan")).toBe("plan");
    expect(asTaskStage("implementation")).toBe("implementation");
    expect(asTaskStage("pr")).toBe("pr");
    expect(asModelStage("prd")).toBe("prd");
    expect(asModelStage("tech_spec")).toBe("tech_spec");
    expect(asModelStage("plan")).toBe("plan");
    expect(asModelStage("implementation")).toBe("implementation");
    expect(asModelStage("pr")).toBe("pr");
    expect(asModelStage("pr_review")).toBe("pr_review");
    expect(asPromptStage("prd")).toBe("prd");
    expect(asPromptStage("tech_spec")).toBe("tech_spec");
    expect(asPromptStage("plan")).toBe("plan");
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
    expect(asMarkerType("stage_started")).toBe("stage_started");
    expect(asMarkerType("step_started")).toBe("step_started");
    expect(asStepStatus("preparing")).toBe("preparing");
    expect(asStepStatus("blocked")).toBe("blocked");
    expect(asStepStatus("implementing")).toBe("implementing");
    expect(asStepStatus("awaiting_review")).toBe("awaiting_review");
    expect(asStepStatus("in_review")).toBe("in_review");
    expect(asStepStatus("ready_to_approve")).toBe("ready_to_approve");
    expect(asStepStatus("nothing_to_commit")).toBe("nothing_to_commit");
    expect(asStepStatus("review_failed")).toBe("review_failed");
    expect(asStepStatus("committing")).toBe("committing");
    expect(asStepStatus("done")).toBe("done");
    expect(asRepoStatus("preparing")).toBe("preparing");
    expect(asRepoStatus("blocked")).toBe("blocked");
    expect(asRepoStatus("drafting")).toBe("drafting");
    expect(asRepoStatus("draft_ready")).toBe("draft_ready");
    expect(asRepoStatus("awaiting_reply")).toBe("awaiting_reply");
    expect(asRepoStatus("opening")).toBe("opening");
    expect(asRepoStatus("reviewing")).toBe("reviewing");
    expect(asRepoStatus("awaiting_decision")).toBe("awaiting_decision");
    expect(asRepoStatus("in_review")).toBe("in_review");
    expect(asRepoStatus("ready_to_approve")).toBe("ready_to_approve");
    expect(asRepoStatus("committing")).toBe("committing");
    expect(asRepoStatus("done")).toBe("done");
    expect(asRepoStatus("merged")).toBe("merged");
    expect(asRepoStatus("pr_closed")).toBe("pr_closed");
    expect(asRepoStatus("closing")).toBe("closing");
    expect(asRepoStatus("closed")).toBe("closed");
    expect(asRepoStatus("skipped")).toBe("skipped");
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
    expect(asBlockReason("no_repository")).toBe("no_repository");
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
    expect(asSituationKind("ready_to_continue")).toBe("ready_to_continue");
    expect(asSituationKind("step_review")).toBe("step_review");
    expect(asSituationKind("step_empty")).toBe("step_empty");
    expect(asSituationKind("draft")).toBe("draft");
    expect(asSituationKind("findings")).toBe("findings");
    expect(asSituationKind("changes_review")).toBe("changes_review");
    expect(asSituationKind("merge")).toBe("merge");
    expect(asSituationKind("nothing_to_publish")).toBe("nothing_to_publish");
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
    expect(asPlaceKind("repo")).toBe("repo");
    expect(asReviewMode("manual")).toBe("manual");
    expect(asReviewMode("agent")).toBe("agent");
    expect(asReviewFallback("")).toBe("");
    expect(asReviewFallback("taken_over")).toBe("taken_over");
    expect(asReviewFallback("rounds_exhausted")).toBe("rounds_exhausted");
    expect(asReviewFallback("commit_failed")).toBe("commit_failed");
  });

  it("falls back on a value a newer backend invented", () => {
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
    expect(asRepoStatus("rebasing")).toBe("preparing");
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
    expect(asSituationGroup("someday")).toBe("waiting");
    expect(asSituationForm("rebase")).toBe("");
    expect(asPlaceKind("workspace")).toBe("stage");
    expect(asReviewMode("auto")).toBe("manual");
    expect(asReviewFallback("paused")).toBe("");
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
    await wails.api.openPath("/home/dev/projects");
    await wails.api.openFolderDialog();
    await wails.api.removeRecent("/home/dev/labs");
    await wails.api.dismissNotice();
    await wails.api.setTheme("dark");
    await wails.api.setModelDefault("pr", "claude-opus-5", "medium");
    await wails.api.setReviewModeDefault("agent");
    await wails.api.getPrompt("prd");
    await wails.api.savePrompt("prd", "# PRD");
    await wails.api.restorePrompt("prd");

    await wails.api.createTask({
      name: "add-login",
      repoPath: "",
      initialContext: "a login",
      models: [],
      reviewMode: "",
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
    await wails.api.openInEditor("task-1", "");
    await wails.api.approveStep("task-1");
    await wails.api.openFileInEditor("task-1", "", "src/login.ts");
    await wails.api.openPR("task-1", "/repo/web", "Log in", "why");
    await wails.api.approveRepo("task-1", "/repo/web");
    await wails.api.reviewAgain("task-1", "/repo/web");
    await wails.api.discardDraft("task-1", "/repo/web");
    await wails.api.retryRepo("task-1", "/repo/web");
    await wails.api.refreshPR("task-1", "/repo/web");
    await wails.api.closeRepo("task-1", "/repo/web");
    await wails.api.previewDelete("task-1");
    await wails.api.viewSituation("situation-1");

    expect(Call.ByID).toHaveBeenCalledTimes(47);
    const ids = vi.mocked(Call.ByID).mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(47);
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
