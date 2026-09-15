import type { ModelChoice } from "@/lib/models";
import type {
  CreateTaskRequest,
  ModelStage,
  PermissionDecision,
  Prompt,
  PromptStage,
  ReviewMode,
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

/** setModelDefault changes what the app gives a stage of the tasks created next. */
export function setModelDefault(stage: ModelStage, choice: ModelChoice): Promise<void> {
  return run(() => api.setModelDefault(stage, choice.model, choice.effort));
}

/** setReviewModeDefault changes who reviews the steps of the tasks created next. */
export function setReviewModeDefault(mode: ReviewMode): Promise<void> {
  return run(() => api.setReviewModeDefault(mode));
}

/** setStageModel changes what a stage of a task runs with, before it starts. */
export function setStageModel(
  taskId: string,
  stage: ModelStage,
  choice: ModelChoice,
): Promise<void> {
  return run(() => api.setStageModel(taskId, stage, choice.model, choice.effort));
}

/** setStepModel gives one step a choice of its own, apart from the implementation. */
export function setStepModel(taskId: string, step: number, choice: ModelChoice): Promise<void> {
  return run(() => api.setStepModel(taskId, step, choice.model, choice.effort));
}

/** setSessionModel changes what a session runs with from its next message on. */
export function setSessionModel(taskId: string, stage: string, choice: ModelChoice): Promise<void> {
  return run(() => api.setSessionModel(taskId, stage, choice.model, choice.effort));
}

/** setReviewMode changes who reviews the steps of a task that are still to start. */
export function setReviewMode(taskId: string, mode: ReviewMode): Promise<void> {
  return run(() => api.setReviewMode(taskId, mode));
}

/** setStepReviewMode gives one step a review mode of its own, apart from the task. */
export function setStepReviewMode(taskId: string, step: number, mode: ReviewMode): Promise<void> {
  return run(() => api.setStepReviewMode(taskId, step, mode));
}

/**
 * getPrompt, savePrompt and restorePrompt do not swallow their failure: the
 * prompt screen shows it where the user is, and the editor keeps the text.
 */
export function getPrompt(stage: PromptStage): Promise<Prompt> {
  return api.getPrompt(stage);
}

export function savePrompt(stage: PromptStage, text: string): Promise<Prompt> {
  return api.savePrompt(stage, text);
}

export function restorePrompt(stage: PromptStage): Promise<Prompt> {
  return api.restorePrompt(stage);
}

/**
 * createTask does not swallow its failure either: the creation dialog stays
 * open and shows the message next to the form instead of the global banner, so
 * the user can fix the name and try again.
 */
export function createTask(req: CreateTaskRequest): Promise<string> {
  return api.createTask(req);
}

/** deleteTask removes the task for good and reports what stayed on disk. */
export function deleteTask(taskId: string): Promise<void> {
  return run(async () => {
    const result = await api.deleteTask(taskId);
    const leftovers = result.leftovers ?? [];
    if (leftovers.length > 0) {
      useAppStore.getState().setLeftovers(leftovers);
    }
  });
}

/** loadTranscript fetches a conversation and buffers what arrives meanwhile. */
export function loadTranscript(taskId: string, stage: string): Promise<void> {
  useAppStore.getState().beginTranscript(taskId, stage);
  return run(async () => {
    const transcript = await api.getTranscript(taskId, stage);
    useAppStore.getState().setTranscript(transcript);
  });
}

export function sendMessage(taskId: string, stage: string, text: string): Promise<void> {
  return run(() => api.sendMessage(taskId, stage, text));
}

export function removePending(taskId: string, stage: string, entryId: string): Promise<void> {
  return run(() => api.removePending(taskId, stage, entryId));
}

export function interrupt(taskId: string, stage: string): Promise<void> {
  return run(() => api.interrupt(taskId, stage));
}

export function pause(taskId: string, stage: string): Promise<void> {
  return run(() => api.pause(taskId, stage));
}

export function resume(taskId: string, stage: string): Promise<void> {
  return run(() => api.resume(taskId, stage));
}

export function retry(taskId: string, stage: string): Promise<void> {
  return run(() => api.retry(taskId, stage));
}

export function answerPermission(
  taskId: string,
  stage: string,
  requestId: string,
  decision: PermissionDecision,
  message: string,
): Promise<void> {
  return run(() => api.answerPermission(taskId, stage, requestId, decision, message));
}

export function answerQuestion(
  taskId: string,
  stage: string,
  requestId: string,
  answers: Record<string, string>,
): Promise<void> {
  return run(() => api.answerQuestion(taskId, stage, requestId, answers));
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

/** reviewStepMyself takes the review of the current step back from the agent. */
export function reviewStepMyself(taskId: string): Promise<void> {
  return run(() => api.reviewStepMyself(taskId));
}

/** openPR sends the draft the user approved to the agent, which opens the PR. */
export function openPR(
  taskId: string,
  repoPath: string,
  title: string,
  body: string,
): Promise<void> {
  return run(async () => {
    await api.openPR(taskId, repoPath, title, body);
    useAppStore.getState().clearPrDraft(taskId, repoPath);
  });
}

/** approveRepo sends the reviewed pull request to be committed and pushed. */
export function approveRepo(taskId: string, repoPath: string): Promise<void> {
  return run(() => api.approveRepo(taskId, repoPath));
}

/** reviewAgain runs another review pass over an open pull request. */
export function reviewAgain(taskId: string, repoPath: string): Promise<void> {
  return run(() => api.reviewAgain(taskId, repoPath));
}

/** discardDraft throws away the draft of a repository and writes it again. */
export function discardDraft(taskId: string, repoPath: string): Promise<void> {
  return run(async () => {
    await api.discardDraft(taskId, repoPath);
    useAppStore.getState().clearPrDraft(taskId, repoPath);
  });
}

/** retryRepo starts the PR stage of a blocked repository over. */
export function retryRepo(taskId: string, repoPath: string): Promise<void> {
  return run(() => api.retryRepo(taskId, repoPath));
}

/** refreshPR asks GitHub again what became of the pull request. */
export function refreshPR(taskId: string, repoPath: string): Promise<void> {
  return run(() => api.refreshPR(taskId, repoPath));
}

/** closeRepo removes the worktree of a merged repository and updates its base branch. */
export function closeRepo(taskId: string, repoPath: string): Promise<void> {
  return run(() => api.closeRepo(taskId, repoPath));
}

/**
 * openInEditor opens a worktree of the task in the editor of the user: the one
 * of the given repository, or the one of the current step when none is given.
 */
export function openInEditor(taskId: string, repoPath = ""): Promise<void> {
  return run(() => api.openInEditor(taskId, repoPath));
}

/** openFileInEditor opens one changed file of a worktree in the editor of the user. */
export function openFileInEditor(taskId: string, path: string, repoPath = ""): Promise<void> {
  return run(() => api.openFileInEditor(taskId, repoPath, path));
}

export function openExternal(url: string): Promise<void> {
  return run(() => api.openExternal(url));
}
