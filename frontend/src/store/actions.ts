import { messageOf } from "@/lib/errors";
import type { ModelChoice } from "@/lib/models";
import type {
  BoardPreview,
  BoardRemoval,
  BoardRepositoryChoice,
  BoardRepositoryOption,
  CreateTaskRequest,
  ModelStage,
  PermissionDecision,
  Prompt,
  PromptStage,
  RepositoryCandidate,
  ReviewMode,
  SaveBoardRequest,
  TaskStage,
  ThemePreference,
} from "@/lib/wails";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

// No action touches `app`: the new state always arrives through state:changed.
async function run(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    useAppStore.getState().setError(messageOf(error));
  }
}

/**
 * scanRepositories, addRepository, browseRepository and changeRepositoryPath do
 * not swallow their failure: the screen that asked shows the refusal where the
 * user is.
 */
export function scanRepositories(): Promise<RepositoryCandidate[]> {
  return api.scanRepositories();
}

export function addRepository(path: string): Promise<void> {
  return api.addRepository(path);
}

export function browseRepository(): Promise<boolean> {
  return api.browseRepository();
}

export function changeRepositoryPath(id: string): Promise<void> {
  return api.changeRepositoryPath(id);
}

/**
 * cloneRepository does not swallow its failure either: the row or the card that
 * asked shows it. It answers false when the user cancelled choosing the clone
 * folder; the clone itself runs in the background.
 */
export function cloneRepository(id: string): Promise<boolean> {
  return api.cloneRepository(id);
}

/** chooseCloneFolder asks for the folder new clones go to. */
export function chooseCloneFolder(): Promise<void> {
  return run(() => api.chooseCloneFolder());
}

/**
 * previewBoard, previewEditBoard, checkBoardRepository, addBoard, updateBoard,
 * removeBoard, refreshCard and addRepositoryToBoard do not swallow their
 * failure: the dialog or the panel that asked shows it where the user is.
 */
export function previewBoard(url: string): Promise<BoardPreview> {
  return api.previewBoard(url);
}

export function previewEditBoard(id: string): Promise<BoardPreview> {
  return api.previewEditBoard(id);
}

export function checkBoardRepository(
  boardId: string,
  fullName: string,
): Promise<BoardRepositoryOption> {
  return api.checkBoardRepository(boardId, fullName);
}

export function addBoard(url: string, req: SaveBoardRequest): Promise<void> {
  return api.addBoard(url, req);
}

export function updateBoard(id: string, req: SaveBoardRequest): Promise<void> {
  return api.updateBoard(id, req);
}

export function removeBoard(id: string): Promise<void> {
  return api.removeBoard(id);
}

export function refreshCard(boardId: string, key: string): Promise<void> {
  return api.refreshCard(boardId, key);
}

export function addRepositoryToBoard(
  boardId: string,
  choice: BoardRepositoryChoice,
): Promise<void> {
  return api.addRepositoryToBoard(boardId, choice);
}

/**
 * previewRemoveBoard says what removing a board takes with it; null when it
 * could not tell, with the reason in the banner.
 */
export async function previewRemoveBoard(id: string): Promise<BoardRemoval | null> {
  let removal: BoardRemoval | null = null;
  await run(async () => {
    removal = await api.previewRemoveBoard(id);
  });
  return removal;
}

/** refreshBoard starts a reading of a board; the result arrives with the state. */
export function refreshBoard(id: string): Promise<void> {
  return run(() => api.refreshBoard(id));
}

/** cardContext is the context a task created from a card starts with; "" when it could not be read. */
export async function cardContext(boardId: string, key: string): Promise<string> {
  let context = "";
  await run(async () => {
    context = await api.cardContext(boardId, key);
  });
  return context;
}

/** removeRepository removes a repository that has no task. */
export function removeRepository(id: string): Promise<void> {
  return run(() => api.removeRepository(id));
}

/** setRepositoryFilter chooses the repository the task list and the history show. */
export function setRepositoryFilter(id: string): Promise<void> {
  return run(() => api.setRepositoryFilter(id));
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
    if (result.leftover !== null) {
      useAppStore.getState().setLeftover(result.leftover);
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
export function openPR(taskId: string, title: string, body: string): Promise<void> {
  return run(async () => {
    await api.openPR(taskId, title, body);
    useAppStore.getState().clearPrDraft(taskId);
  });
}

/** approvePR sends the reviewed pull request to be committed and pushed. */
export function approvePR(taskId: string): Promise<void> {
  return run(() => api.approvePR(taskId));
}

/** reviewAgain runs another review pass over an open pull request. */
export function reviewAgain(taskId: string): Promise<void> {
  return run(() => api.reviewAgain(taskId));
}

/** discardDraft throws away the draft of the pull request and writes it again. */
export function discardDraft(taskId: string): Promise<void> {
  return run(async () => {
    await api.discardDraft(taskId);
    useAppStore.getState().clearPrDraft(taskId);
  });
}

/** retryPR starts the blocked PR stage of a task over. */
export function retryPR(taskId: string): Promise<void> {
  return run(() => api.retryPR(taskId));
}

/** refreshPR asks GitHub again what became of the pull request. */
export function refreshPR(taskId: string): Promise<void> {
  return run(() => api.refreshPR(taskId));
}

/** closeTask removes the worktree of a merged task and updates its base branch. */
export function closeTask(taskId: string): Promise<void> {
  return run(() => api.closeTask(taskId));
}

/** openInEditor opens the worktree of the task in the editor of the user. */
export function openInEditor(taskId: string): Promise<void> {
  return run(() => api.openInEditor(taskId));
}

/** openFileInEditor opens one changed file of the worktree in the editor of the user. */
export function openFileInEditor(taskId: string, path: string): Promise<void> {
  return run(() => api.openFileInEditor(taskId, path));
}

export function openExternal(url: string): Promise<void> {
  return run(() => api.openExternal(url));
}
