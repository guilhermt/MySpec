import type {
  ActionEntry,
  AssistantEntry,
  CreateTaskRequest,
  Entry,
  ErrorEntry,
  MarkerEntry,
  Notice,
  PermissionEntry,
  PlanProblem,
  Question,
  QuestionEntry,
  QuestionOption,
  Recent,
  Repo,
  State,
  Step,
  StepBlock,
  TaskSummary,
  Transcript,
  TranscriptEvent,
  UserEntry,
  Workspace,
} from "@bindings/models";
import * as SettingsService from "@bindings/settingsservice";
import * as TaskService from "@bindings/taskservice";
import * as WorkspaceService from "@bindings/workspaceservice";
import { Browser, Events } from "@wailsio/runtime";

export type {
  ActionEntry,
  AssistantEntry,
  CreateTaskRequest,
  Entry,
  ErrorEntry,
  MarkerEntry,
  Notice,
  PermissionEntry,
  PlanProblem,
  Question,
  QuestionEntry,
  QuestionOption,
  Recent,
  Repo,
  State,
  Step,
  StepBlock,
  TaskSummary,
  Transcript,
  TranscriptEvent,
  UserEntry,
  Workspace,
};

export type ThemePreference = "system" | "light" | "dark";
export type NoticeReason = "not_found" | "not_directory" | "not_readable" | "last_recent_missing";
export type TaskStage = "prd" | "tech_spec" | "plan" | "implementation";
export type StepStatus =
  | "not_started"
  | "preparing"
  | "blocked"
  | "implementing"
  | "awaiting_review";
export type BlockReason =
  | "dirty_worktree"
  | "fetch_failed"
  | "no_base_branch"
  | "path_exists"
  | "branch_exists"
  | "git_failed"
  | "no_repository";
export type SessionStatus = "working" | "waiting" | "needs_permission" | "paused" | "error";
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
      return value;
    default:
      return "not_started";
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

export const api = {
  getState: (): Promise<State> => WorkspaceService.GetState(),
  openPath: (path: string): Promise<void> => WorkspaceService.OpenPath(path),
  openFolderDialog: (): Promise<void> => WorkspaceService.OpenFolderDialog(),
  removeRecent: (path: string): Promise<void> => WorkspaceService.RemoveRecent(path),
  dismissNotice: (): Promise<void> => WorkspaceService.DismissNotice(),
  setTheme: (preference: ThemePreference): Promise<void> => SettingsService.SetTheme(preference),

  createTask: (req: CreateTaskRequest): Promise<string> => TaskService.CreateTask(req),
  deleteTask: (taskId: string): Promise<void> => TaskService.DeleteTask(taskId),
  getTranscript: (taskId: string): Promise<Transcript> => TaskService.GetTranscript(taskId),
  sendMessage: (taskId: string, text: string): Promise<void> =>
    TaskService.SendMessage(taskId, text),
  removePending: (taskId: string, entryId: string): Promise<void> =>
    TaskService.RemovePending(taskId, entryId),
  interrupt: (taskId: string): Promise<void> => TaskService.Interrupt(taskId),
  pause: (taskId: string): Promise<void> => TaskService.Pause(taskId),
  resume: (taskId: string): Promise<void> => TaskService.Resume(taskId),
  retry: (taskId: string): Promise<void> => TaskService.Retry(taskId),
  answerPermission: (
    taskId: string,
    requestId: string,
    decision: PermissionDecision,
    message: string,
  ): Promise<void> => TaskService.AnswerPermission(taskId, requestId, decision, message),
  answerQuestion: (
    taskId: string,
    requestId: string,
    answers: Record<string, string>,
  ): Promise<void> => TaskService.AnswerQuestion(taskId, requestId, answers),
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
  openInEditor: (taskId: string): Promise<void> => TaskService.OpenInEditor(taskId),
  openExternal: (url: string): Promise<void> => Browser.OpenURL(url),
};

export function onStateChanged(handler: (state: State) => void): () => void {
  return Events.On("state:changed", (event) => handler(event.data));
}

export function onTranscriptChanged(handler: (event: TranscriptEvent) => void): () => void {
  return Events.On("transcript:changed", (event) => handler(event.data));
}
