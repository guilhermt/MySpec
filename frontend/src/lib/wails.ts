import * as AttentionService from "@bindings/attentionservice";
import type {
  ActionEntry,
  ArchivedRepo,
  ArchivedStep,
  ArchivedTask,
  AssistantEntry,
  BranchPreview,
  CloseResult,
  CloseStep,
  CreateTaskRequest,
  DeletePreview,
  DeleteResult,
  Entry,
  ErrorEntry,
  Leftover,
  MarkerEntry,
  Notice,
  PermissionEntry,
  Place,
  PlanProblem,
  PRBlock,
  PRDraft,
  PRPreview,
  PRReport,
  Question,
  QuestionEntry,
  QuestionOption,
  Recent,
  Repo,
  RepoPR,
  Review,
  ReviewFile,
  Situation,
  SituationOpen,
  SituationStarted,
  State,
  Step,
  StepBlock,
  TaskSummary,
  Transcript,
  TranscriptEvent,
  UserEntry,
  Workspace,
  WorktreePreview,
} from "@bindings/models";
import * as SettingsService from "@bindings/settingsservice";
import * as TaskService from "@bindings/taskservice";
import * as WorkspaceService from "@bindings/workspaceservice";
import { Browser, Events } from "@wailsio/runtime";

export type {
  ActionEntry,
  ArchivedRepo,
  ArchivedStep,
  ArchivedTask,
  AssistantEntry,
  BranchPreview,
  CloseResult,
  CloseStep,
  CreateTaskRequest,
  DeletePreview,
  DeleteResult,
  Entry,
  ErrorEntry,
  Leftover,
  MarkerEntry,
  Notice,
  PermissionEntry,
  Place,
  PlanProblem,
  PRBlock,
  PRDraft,
  PRPreview,
  PRReport,
  Question,
  QuestionEntry,
  QuestionOption,
  Recent,
  Repo,
  RepoPR,
  Review,
  ReviewFile,
  Situation,
  SituationOpen,
  SituationStarted,
  State,
  Step,
  StepBlock,
  TaskSummary,
  Transcript,
  TranscriptEvent,
  UserEntry,
  Workspace,
  WorktreePreview,
};

export type ThemePreference = "system" | "light" | "dark";
export type NoticeReason = "not_found" | "not_directory" | "not_readable" | "last_recent_missing";
export type TaskStage = "prd" | "tech_spec" | "plan" | "implementation" | "pr";
export type StepStatus =
  | "not_started"
  | "preparing"
  | "blocked"
  | "implementing"
  | "awaiting_review"
  | "in_review"
  | "ready_to_approve"
  | "nothing_to_commit"
  | "review_failed"
  | "committing"
  | "done";
/** RepoStatus is where one repository of a task stands in the PR stage. */
export type RepoStatus =
  | "preparing"
  | "blocked"
  | "drafting"
  | "draft_ready"
  | "awaiting_reply"
  | "opening"
  | "reviewing"
  | "awaiting_decision"
  | "in_review"
  | "ready_to_approve"
  | "committing"
  | "done"
  | "merged"
  | "pr_closed"
  | "closing"
  | "closed"
  | "skipped";

/** CloseOutcome is what became of one part of the closing of a repository. */
export type CloseOutcome = "done" | "skipped" | "failed";

/** CloseSkipReason is why one part of the closing was left alone. */
export type CloseSkipReason =
  | "missing"
  | "not_merged"
  | "not_checked_out"
  | "dirty"
  | "no_upstream"
  | "diverged"
  | "up_to_date";

/** PRBlockReason is why the PR stage of a repository cannot go on. */
export type PRBlockReason =
  | "gh_missing"
  | "gh_unauthenticated"
  | "gh_failed"
  | "git_failed"
  | "no_worktree";

/** PRState is what GitHub last said about a pull request; "" before it is read. */
export type PRState = "open" | "merged" | "closed" | "";
export type ReviewFileKind = "added" | "modified" | "deleted" | "renamed" | "untracked";
export type BlockReason =
  | "dirty_worktree"
  | "fetch_failed"
  | "no_base_branch"
  | "path_exists"
  | "branch_exists"
  | "git_failed"
  | "no_repository";
export type SessionStatus =
  | "working"
  | "waiting"
  | "needs_permission"
  | "needs_answer"
  | "paused"
  | "error";
export type EntryKind =
  | "user"
  | "assistant"
  | "action"
  | "permission"
  | "question"
  | "marker"
  | "error";
export type ActionStatus = "running" | "done" | "error" | "interrupted";
export type PermissionStatus = "pending" | "allowed" | "allowed_session" | "denied" | "cancelled";
export type MarkerType =
  | "prd_written"
  | "prd_updated"
  | "tech_spec_written"
  | "tech_spec_updated"
  | "plan_written"
  | "plan_updated"
  | "stage_started"
  | "step_started"
  | "compacted"
  | "interrupted";
export type ErrorKind =
  | "process_exit"
  | "start_failed"
  | "not_found"
  | "not_logged_in"
  | "turn_error";
export type PermissionDecision = "allow" | "allow_session" | "deny";
export type TranscriptEventKind = "entry" | "text" | "remove" | "reset";

/** SituationKind is what a situation asks of the user. */
export type SituationKind =
  | "session_error"
  | "step_blocked"
  | "worktree_unreadable"
  | "pr_blocked"
  | "plan_invalid"
  | "pr_closed"
  | "permission"
  | "question"
  | "reply"
  | "ready_to_continue"
  | "step_review"
  | "step_empty"
  | "draft"
  | "findings"
  | "changes_review"
  | "merge"
  | "nothing_to_publish";

/** SituationGroup is how urgent a situation is, from the most urgent. */
export type SituationGroup = "error" | "waiting" | "closing";

/** SituationForm is the shape of the kinds that have more than one. */
export type SituationForm = "" | "review" | "staged" | "approve" | "merge" | "close";

/** PlaceKind is the part of a task a situation is in. */
export type PlaceKind = "stage" | "step" | "repo";

/** sessionKey identifies one conversation: a task and the stage it belongs to. */
export function sessionKey(taskId: string, stage: string): string {
  return `${taskId}|${stage}`;
}

export function asThemePreference(value: string): ThemePreference {
  switch (value) {
    case "light":
    case "dark":
    case "system":
      return value;
    default:
      return "system";
  }
}

export function asNoticeReason(value: string): NoticeReason {
  switch (value) {
    case "not_found":
    case "not_directory":
    case "not_readable":
    case "last_recent_missing":
      return value;
    default:
      return "not_readable";
  }
}

export function asTaskStage(value: string): TaskStage {
  switch (value) {
    case "prd":
    case "tech_spec":
    case "plan":
    case "implementation":
    case "pr":
      return value;
    default:
      return "prd";
  }
}

export function asStepStatus(value: string): StepStatus {
  switch (value) {
    case "not_started":
    case "preparing":
    case "blocked":
    case "implementing":
    case "awaiting_review":
    case "in_review":
    case "ready_to_approve":
    case "nothing_to_commit":
    case "review_failed":
    case "committing":
    case "done":
      return value;
    default:
      return "not_started";
  }
}

export function asRepoStatus(value: string): RepoStatus {
  switch (value) {
    case "preparing":
    case "blocked":
    case "drafting":
    case "draft_ready":
    case "awaiting_reply":
    case "opening":
    case "reviewing":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
    case "committing":
    case "done":
    case "merged":
    case "pr_closed":
    case "closing":
    case "closed":
    case "skipped":
      return value;
    default:
      return "preparing";
  }
}

export function asCloseOutcome(value: string): CloseOutcome {
  switch (value) {
    case "done":
    case "skipped":
    case "failed":
      return value;
    default:
      return "failed";
  }
}

export function asCloseSkipReason(value: string): CloseSkipReason {
  switch (value) {
    case "missing":
    case "not_merged":
    case "not_checked_out":
    case "dirty":
    case "no_upstream":
    case "diverged":
    case "up_to_date":
      return value;
    default:
      return "missing";
  }
}

export function asPRBlockReason(value: string): PRBlockReason {
  switch (value) {
    case "gh_missing":
    case "gh_unauthenticated":
    case "gh_failed":
    case "git_failed":
    case "no_worktree":
      return value;
    default:
      return "gh_failed";
  }
}

export function asPRState(value: string): PRState {
  switch (value) {
    case "open":
    case "merged":
    case "closed":
      return value;
    default:
      return "";
  }
}

export function asReviewFileKind(value: string): ReviewFileKind {
  switch (value) {
    case "added":
    case "modified":
    case "deleted":
    case "renamed":
    case "untracked":
      return value;
    default:
      return "modified";
  }
}

export function asBlockReason(value: string): BlockReason {
  switch (value) {
    case "dirty_worktree":
    case "fetch_failed":
    case "no_base_branch":
    case "path_exists":
    case "branch_exists":
    case "git_failed":
    case "no_repository":
      return value;
    default:
      return "git_failed";
  }
}

export function asSessionStatus(value: string): SessionStatus {
  switch (value) {
    case "working":
    case "waiting":
    case "needs_permission":
    case "needs_answer":
    case "paused":
    case "error":
      return value;
    default:
      return "waiting";
  }
}

export function asEntryKind(value: string): EntryKind {
  switch (value) {
    case "user":
    case "assistant":
    case "action":
    case "permission":
    case "question":
    case "marker":
    case "error":
      return value;
    default:
      return "marker";
  }
}

export function asActionStatus(value: string): ActionStatus {
  switch (value) {
    case "running":
    case "done":
    case "error":
    case "interrupted":
      return value;
    default:
      return "done";
  }
}

export function asPermissionStatus(value: string): PermissionStatus {
  switch (value) {
    case "pending":
    case "allowed":
    case "allowed_session":
    case "denied":
    case "cancelled":
      return value;
    default:
      return "cancelled";
  }
}

export function asMarkerType(value: string): MarkerType {
  switch (value) {
    case "prd_written":
    case "prd_updated":
    case "tech_spec_written":
    case "tech_spec_updated":
    case "plan_written":
    case "plan_updated":
    case "stage_started":
    case "step_started":
    case "compacted":
    case "interrupted":
      return value;
    default:
      return "compacted";
  }
}

export function asErrorKind(value: string): ErrorKind {
  switch (value) {
    case "process_exit":
    case "start_failed":
    case "not_found":
    case "not_logged_in":
    case "turn_error":
      return value;
    default:
      return "turn_error";
  }
}

export function asTranscriptEventKind(value: string): TranscriptEventKind {
  switch (value) {
    case "entry":
    case "text":
    case "remove":
    case "reset":
      return value;
    default:
      return "reset";
  }
}

export function asSituationKind(value: string): SituationKind {
  switch (value) {
    case "session_error":
    case "step_blocked":
    case "worktree_unreadable":
    case "pr_blocked":
    case "plan_invalid":
    case "pr_closed":
    case "permission":
    case "question":
    case "reply":
    case "ready_to_continue":
    case "step_review":
    case "step_empty":
    case "draft":
    case "findings":
    case "changes_review":
    case "merge":
    case "nothing_to_publish":
      return value;
    default:
      return "reply";
  }
}

export function asSituationGroup(value: string): SituationGroup {
  switch (value) {
    case "error":
    case "waiting":
    case "closing":
      return value;
    default:
      return "waiting";
  }
}

export function asSituationForm(value: string): SituationForm {
  switch (value) {
    case "":
    case "review":
    case "staged":
    case "approve":
    case "merge":
    case "close":
      return value;
    default:
      return "";
  }
}

export function asPlaceKind(value: string): PlaceKind {
  switch (value) {
    case "stage":
    case "step":
    case "repo":
      return value;
    default:
      return "stage";
  }
}

export const api = {
  getState: (): Promise<State> => WorkspaceService.GetState(),
  openPath: (path: string): Promise<void> => WorkspaceService.OpenPath(path),
  openFolderDialog: (): Promise<void> => WorkspaceService.OpenFolderDialog(),
  removeRecent: (path: string): Promise<void> => WorkspaceService.RemoveRecent(path),
  dismissNotice: (): Promise<void> => WorkspaceService.DismissNotice(),
  setTheme: (preference: ThemePreference): Promise<void> => SettingsService.SetTheme(preference),

  createTask: (req: CreateTaskRequest): Promise<string> => TaskService.CreateTask(req),
  deleteTask: (taskId: string): Promise<DeleteResult> => TaskService.DeleteTask(taskId),
  previewDelete: (taskId: string): Promise<DeletePreview> => TaskService.PreviewDelete(taskId),
  getTranscript: (taskId: string, stage: string): Promise<Transcript> =>
    TaskService.GetTranscript(taskId, stage),
  sendMessage: (taskId: string, stage: string, text: string): Promise<void> =>
    TaskService.SendMessage(taskId, stage, text),
  removePending: (taskId: string, stage: string, entryId: string): Promise<void> =>
    TaskService.RemovePending(taskId, stage, entryId),
  interrupt: (taskId: string, stage: string): Promise<void> => TaskService.Interrupt(taskId, stage),
  pause: (taskId: string, stage: string): Promise<void> => TaskService.Pause(taskId, stage),
  resume: (taskId: string, stage: string): Promise<void> => TaskService.Resume(taskId, stage),
  retry: (taskId: string, stage: string): Promise<void> => TaskService.Retry(taskId, stage),
  answerPermission: (
    taskId: string,
    stage: string,
    requestId: string,
    decision: PermissionDecision,
    message: string,
  ): Promise<void> => TaskService.AnswerPermission(taskId, stage, requestId, decision, message),
  answerQuestion: (
    taskId: string,
    stage: string,
    requestId: string,
    answers: Record<string, string>,
  ): Promise<void> => TaskService.AnswerQuestion(taskId, stage, requestId, answers),
  readArtifact: (taskId: string, name: string): Promise<string> =>
    TaskService.ReadArtifact(taskId, name),
  backToStage: (taskId: string, stage: TaskStage): Promise<void> =>
    TaskService.BackToStage(taskId, stage),
  discardStage: (taskId: string, stage: TaskStage): Promise<void> =>
    TaskService.DiscardStage(taskId, stage),
  continueStage: (taskId: string): Promise<void> => TaskService.ContinueStage(taskId),
  retryStep: (taskId: string): Promise<void> => TaskService.RetryStep(taskId),
  cleanAndStartStep: (taskId: string): Promise<void> => TaskService.CleanAndStartStep(taskId),
  discardStep: (taskId: string, cleanWorktree: boolean): Promise<void> =>
    TaskService.DiscardStep(taskId, cleanWorktree),
  approveStep: (taskId: string): Promise<void> => TaskService.ApproveStep(taskId),
  openPR: (taskId: string, repoPath: string, title: string, body: string): Promise<void> =>
    TaskService.OpenPR(taskId, repoPath, title, body),
  approveRepo: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.ApproveRepo(taskId, repoPath),
  reviewAgain: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.ReviewAgain(taskId, repoPath),
  discardDraft: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.DiscardDraft(taskId, repoPath),
  retryRepo: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.RetryRepo(taskId, repoPath),
  refreshPR: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.RefreshPR(taskId, repoPath),
  closeRepo: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.CloseRepo(taskId, repoPath),
  openInEditor: (taskId: string, repoPath: string): Promise<void> =>
    TaskService.OpenInEditor(taskId, repoPath),
  openFileInEditor: (taskId: string, repoPath: string, path: string): Promise<void> =>
    TaskService.OpenFileInEditor(taskId, repoPath, path),
  openExternal: (url: string): Promise<void> => Browser.OpenURL(url),

  viewSituation: (id: string): Promise<void> => AttentionService.ViewSituation(id),
};

export function onStateChanged(handler: (state: State) => void): () => void {
  return Events.On("state:changed", (event) => handler(event.data));
}

export function onTranscriptChanged(handler: (event: TranscriptEvent) => void): () => void {
  return Events.On("transcript:changed", (event) => handler(event.data));
}

export function onSituationStarted(handler: (event: SituationStarted) => void): () => void {
  return Events.On("situation:started", (event) => handler(event.data));
}

export function onSituationOpen(handler: (event: SituationOpen) => void): () => void {
  return Events.On("situation:open", (event) => handler(event.data));
}
