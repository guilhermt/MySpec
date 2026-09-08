import type {
  CreateTaskRequest,
  PermissionDecision,
  TaskStage,
  ThemePreference,
} from "@/lib/wails";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// No action touches `app`: the new state always arrives through state:changed.
async function run(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    useAppStore.getState().setError(messageOf(error));
  }
}

export function openPath(path: string): Promise<void> {
  return run(() => api.openPath(path));
}

export function openFolderDialog(): Promise<void> {
  return run(() => api.openFolderDialog());
}

export function removeRecent(path: string): Promise<void> {
  return run(() => api.removeRecent(path));
}

export function dismissNotice(): Promise<void> {
  return run(() => api.dismissNotice());
}

export function setTheme(preference: ThemePreference): Promise<void> {
  return run(() => api.setTheme(preference));
}

/**
 * createTask is the one action that does not swallow its failure: the creation
 * dialog stays open and shows the message next to the form instead of the
 * global banner, so the user can fix the name and try again.
 */
export function createTask(req: CreateTaskRequest): Promise<string> {
  return api.createTask(req);
}

export function deleteTask(taskId: string): Promise<void> {
  return run(() => api.deleteTask(taskId));
}

/** loadTranscript fetches a conversation and buffers what arrives meanwhile. */
export function loadTranscript(taskId: string): Promise<void> {
  useAppStore.getState().beginTranscript(taskId);
  return run(async () => {
    const transcript = await api.getTranscript(taskId);
    useAppStore.getState().setTranscript(transcript);
  });
}

export function sendMessage(taskId: string, text: string): Promise<void> {
  return run(() => api.sendMessage(taskId, text));
}

export function removePending(taskId: string, entryId: string): Promise<void> {
  return run(() => api.removePending(taskId, entryId));
}

export function interrupt(taskId: string): Promise<void> {
  return run(() => api.interrupt(taskId));
}

export function pause(taskId: string): Promise<void> {
  return run(() => api.pause(taskId));
}

export function resume(taskId: string): Promise<void> {
  return run(() => api.resume(taskId));
}

export function retry(taskId: string): Promise<void> {
  return run(() => api.retry(taskId));
}

export function answerPermission(
  taskId: string,
  requestId: string,
  decision: PermissionDecision,
  message: string,
): Promise<void> {
  return run(() => api.answerPermission(taskId, requestId, decision, message));
}

export function answerQuestion(
  taskId: string,
  requestId: string,
  answers: Record<string, string>,
): Promise<void> {
  return run(() => api.answerQuestion(taskId, requestId, answers));
}

/** backToStage reopens a stage that is already done. */
export function backToStage(taskId: string, stage: TaskStage): Promise<void> {
  return run(() => api.backToStage(taskId, stage));
}

/** discardStage throws a stage away and starts it over. */
export function discardStage(taskId: string, stage: TaskStage): Promise<void> {
  return run(() => api.discardStage(taskId, stage));
}

/** continueStage moves a task revisiting a stage on to the next one. */
export function continueStage(taskId: string): Promise<void> {
  return run(() => api.continueStage(taskId));
}

/** retryStep starts a blocked step over, from the fetch. */
export function retryStep(taskId: string): Promise<void> {
  return run(() => api.retryStep(taskId));
}

/** cleanAndStartStep throws away every change in the worktree and starts the step. */
export function cleanAndStartStep(taskId: string): Promise<void> {
  return run(() => api.cleanAndStartStep(taskId));
}

/** discardStep deletes the conversation of the step and runs it again from scratch. */
export function discardStep(taskId: string, cleanWorktree: boolean): Promise<void> {
  return run(() => api.discardStep(taskId, cleanWorktree));
}

/** approveStep sends the reviewed step to be committed by the agent that wrote it. */
export function approveStep(taskId: string): Promise<void> {
  return run(() => api.approveStep(taskId));
}

/** openInEditor opens the worktree of the current step in the editor of the user. */
export function openInEditor(taskId: string): Promise<void> {
  return run(() => api.openInEditor(taskId));
}

/** openFileInEditor opens one changed file of the step in the editor of the user. */
export function openFileInEditor(taskId: string, path: string): Promise<void> {
  return run(() => api.openFileInEditor(taskId, path));
}

export function openExternal(url: string): Promise<void> {
  return run(() => api.openExternal(url));
}
