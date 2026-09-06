import type { CreateTaskRequest, PermissionDecision, ThemePreference } from "@/lib/wails";
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

export function openExternal(url: string): Promise<void> {
  return run(() => api.openExternal(url));
}
