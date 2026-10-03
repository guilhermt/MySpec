import { draftTitle } from "@/lib/drafts";
import { messageOf, noticeDetail, type Remedy } from "@/lib/errors";
import { locationTitle } from "@/lib/locations";
import type { ModelChoice } from "@/lib/models";
import { stageName } from "@/lib/situations";
import type {
  ActionOutput,
  BoardPreview,
  BoardRemoval,
  BoardRepositoryChoice,
  BoardRepositoryOption,
  CreateTaskRequest,
  DiscussionContextRequest,
  DraftDecision,
  FindingDecision,
  Machine,
  ModelStage,
  PermissionDecision,
  Prompt,
  PromptListing,
  PromptStage,
  RepositoryCandidate,
  ReviewFilters,
  ReviewMode,
  ReviewVerdict,
  SaveBoardRequest,
  StartDiscussionRequest,
  StartReviewRequest,
  TaskStage,
  ThemePreference,
} from "@/lib/wails";
import { api } from "@/lib/wails";
import { storedDraft, useAppStore } from "@/store/app-store";

/** Failure is how the app notice names an action that failed: the action with its item, and what to do. */
interface Failure {
  label: string;
  remedy: Remedy | null;
}

/** TRY and GH are the ways out most actions have: trying again, and signing gh in. */
const TRY: Remedy = "Try again.";
const GH: Remedy = "Check that gh is signed in.";

function fail(label: string, remedy: Remedy | null): Failure {
  return { label, remedy };
}

// No action touches `app`: the new state always arrives through state:changed. run answers whether
// the operation went through, for the actions whose caller goes on only then; the others ignore it.
async function run(failure: Failure, operation: () => Promise<void>): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    useAppStore.getState().setError({
      label: failure.label,
      detail: noticeDetail(messageOf(error), failure.remedy),
    });
    return false;
  }
}

// inPlace runs an action whose failure has a place of its own on screen: it answers the message of
// the failure, or null, instead of raising the app notice.
async function inPlace(operation: () => Promise<void>): Promise<string | null> {
  try {
    await operation();
    return null;
  } catch (error) {
    return messageOf(error);
  }
}

// itemName is the name of a task, active or archived, or the title of a review or a discussion, as
// the tree calls it; "" when the item is gone.
function itemName(id: string): string {
  const { app } = useAppStore.getState();
  const kinds = ["task", "archived-task", "review", "discussion"] as const;
  for (const kind of kinds) {
    const title = locationTitle(app, { kind, id });
    if (title !== "") {
      return title;
    }
  }
  return "";
}

// withItem ends a label with the name of its item, or leaves the label bare when the item is gone:
// "Couldn't pause".
function withItem(label: string, name: string): string {
  return name === "" ? label : `${label} ${name}`;
}

// theItem is the name of an item inside a label, "the item" once it is gone.
function theItem(id: string): string {
  return itemName(id) || "the item";
}

function boardTitle(id: string): string {
  return locationTitle(useAppStore.getState().app, { kind: "board", id });
}

function repositoryName(id: string): string {
  const repositories = useAppStore.getState().app?.repositories ?? [];
  return repositories.find((repository) => repository.id === id)?.fullName ?? "";
}

// cardName is how a label names a card of a board: its number.
function cardName(boardId: string, key: string): string {
  const boards = useAppStore.getState().app?.boards ?? [];
  const card = boards.find((board) => board.id === boardId)?.cards?.find((c) => c.key === key);
  return card === undefined ? "" : `#${card.number}`;
}

// cloneRemedy is what to do when an action on a task fails: change the path of its clone when the
// clone is missing, since nothing else works until then.
function cloneRemedy(taskId: string, fallback: Remedy): Remedy {
  const app = useAppStore.getState().app;
  const task = (app?.tasks ?? []).find((candidate) => candidate.id === taskId);
  const repository = (app?.repositories ?? []).find((repo) => repo.id === task?.repositoryId);
  return repository?.missing === true ? "Change the path of the clone in Settings." : fallback;
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

/** changeRepositoryPath answers false when the user cancelled choosing the folder. */
export function changeRepositoryPath(id: string): Promise<boolean> {
  return api.changeRepositoryPath(id);
}

/** changeClonePath is changeRepositoryPath for a bar, which has no place for the failure: the app notice says it. */
export async function changeClonePath(id: string): Promise<void> {
  await run(fail("Couldn't change the path of the clone", TRY), async () => {
    await api.changeRepositoryPath(id);
  });
}

/**
 * cloneRepository does not swallow its failure either: the row or the card that
 * asked shows it. It answers false when the user cancelled choosing the clone
 * folder; the clone itself runs in the background.
 */
export function cloneRepository(id: string): Promise<boolean> {
  return api.cloneRepository(id);
}

/** chooseCloneFolder asks for the folder new clones go to; it answers the message of a failure, which the page shows under its row. */
export function chooseCloneFolder(): Promise<string | null> {
  return inPlace(() => api.chooseCloneFolder());
}

/**
 * previewBoard, previewEditBoard, checkBoardRepository, addBoard, updateBoard,
 * previewRemoveBoard, removeBoard, refreshCard and addRepositoryToBoard do not swallow their
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
 * previewRemoveBoard says what removing a board takes with it; the dialog that asked tells it when
 * the reading fails.
 */
export function previewRemoveBoard(id: string): Promise<BoardRemoval> {
  return api.previewRemoveBoard(id);
}

/** refreshBoard starts a reading of a board; the result arrives with the state. */
export async function refreshBoard(id: string): Promise<void> {
  await run(fail(withItem("Couldn't refresh the board", boardTitle(id)), GH), () =>
    api.refreshBoard(id),
  );
}

/** cardContext is the context a task created from a card starts with; "" when it could not be read. */
export async function cardContext(boardId: string, key: string): Promise<string> {
  let context = "";
  await run(fail(withItem("Couldn't read the card", cardName(boardId, key)), GH), async () => {
    context = await api.cardContext(boardId, key);
  });
  return context;
}

/** removeRepository removes a repository that has no task; the dialog that asked shows a failure in its footer. */
export function removeRepository(id: string): Promise<void> {
  return api.removeRepository(id);
}

/** setRepositoryFilter chooses the repository the task list and the history show. */
export async function setRepositoryFilter(id: string): Promise<void> {
  await run(
    fail(
      id === ""
        ? "Couldn't show every repository"
        : `Couldn't show the tasks of ${repositoryName(id) || "the repository"}`,
      TRY,
    ),
    () => api.setRepositoryFilter(id),
  );
}

/** tryStartupAgain runs the startup again from its first step, after it failed. */
export async function tryStartupAgain(): Promise<void> {
  await run(fail("Couldn't try again", TRY), () => api.tryStartupAgain());
}

export async function setTheme(preference: ThemePreference): Promise<void> {
  await run(fail("Couldn't change the theme", TRY), () => api.setTheme(preference));
}

/**
 * setModelDefaultInPlace changes what the app gives a stage of the tasks created next, from a row of
 * Defaults that shows its own failure under it: it answers the message of the failure, or null.
 */
export function setModelDefaultInPlace(
  stage: ModelStage,
  choice: ModelChoice,
): Promise<string | null> {
  return inPlace(() => api.setModelDefault(stage, choice.model, choice.effort));
}

/**
 * setReviewModeDefaultInPlace changes who reviews the steps of the tasks created next, from the
 * options of Defaults, which show their own failure under them: it answers the message, or null.
 */
export function setReviewModeDefaultInPlace(mode: ReviewMode): Promise<string | null> {
  return inPlace(() => api.setReviewModeDefault(mode));
}

/** setStageModel changes what a stage of a task runs with, before it starts. */
export async function setStageModel(
  taskId: string,
  stage: ModelStage,
  choice: ModelChoice,
): Promise<void> {
  await run(fail(`Couldn't change the model of ${theItem(taskId)}`, TRY), () =>
    api.setStageModel(taskId, stage, choice.model, choice.effort),
  );
}

/**
 * setStageModelInPlace is setStageModel for a popover that shows its own failure under the row: it
 * answers the message of the failure, or null, and leaves the app notice alone.
 */
export function setStageModelInPlace(
  taskId: string,
  stage: ModelStage,
  choice: ModelChoice,
): Promise<string | null> {
  return inPlace(() => api.setStageModel(taskId, stage, choice.model, choice.effort));
}

/** setStepModel gives one step a choice of its own, apart from the implementation. */
export async function setStepModel(
  taskId: string,
  step: number,
  choice: ModelChoice,
): Promise<void> {
  await run(fail(`Couldn't change the model of step ${step} of ${theItem(taskId)}`, TRY), () =>
    api.setStepModel(taskId, step, choice.model, choice.effort),
  );
}

/** setSessionModel changes what a session runs with from its next message on. */
export async function setSessionModel(
  taskId: string,
  stage: string,
  choice: ModelChoice,
): Promise<void> {
  await run(fail(`Couldn't change the model of ${theItem(taskId)}`, TRY), () =>
    api.setSessionModel(taskId, stage, choice.model, choice.effort),
  );
}

/** setReviewMode changes who reviews the steps of a task that are still to start. */
export async function setReviewMode(taskId: string, mode: ReviewMode): Promise<void> {
  await run(fail(`Couldn't change the review mode of ${theItem(taskId)}`, TRY), () =>
    api.setReviewMode(taskId, mode),
  );
}

/**
 * setReviewModeInPlace is setReviewMode for a popover that shows its own failure in its note: it
 * answers the message of the failure, or null, and leaves the app notice alone.
 */
export function setReviewModeInPlace(taskId: string, mode: ReviewMode): Promise<string | null> {
  return inPlace(() => api.setReviewMode(taskId, mode));
}

/** setStepReviewMode gives one step a review mode of its own, apart from the task. */
export async function setStepReviewMode(
  taskId: string,
  step: number,
  mode: ReviewMode,
): Promise<void> {
  await run(
    fail(`Couldn't change the review mode of step ${step} of ${theItem(taskId)}`, TRY),
    () => api.setStepReviewMode(taskId, step, mode),
  );
}

/** followTaskReviewMode drops the review mode of a step, which follows the task again. */
export async function followTaskReviewMode(taskId: string, step: number): Promise<void> {
  await run(fail(`Couldn't change the review mode of ${theItem(taskId)}`, TRY), () =>
    api.clearStepReviewMode(taskId, step),
  );
}

/**
 * getPrompt, savePrompt and restorePrompt do not swallow their failure: the
 * prompt screen shows it where the user is, and the editor keeps the text.
 */
export function getPrompt(stage: PromptStage): Promise<Prompt> {
  return api.getPrompt(stage);
}

/** checkMachine reads what the machine lacks; a call that fails says nothing, and null is "unknown". */
export async function checkMachine(): Promise<Machine | null> {
  try {
    return await api.checkMachine();
  } catch {
    return null;
  }
}

/** listPrompts reads which prompts are edited; the list shows its own failure. */
export function listPrompts(): Promise<PromptListing[]> {
  return api.listPrompts();
}

export function savePrompt(stage: PromptStage, text: string): Promise<Prompt> {
  return api.savePrompt(stage, text);
}

export function restorePrompt(stage: PromptStage): Promise<Prompt> {
  return api.restorePrompt(stage);
}

/**
 * createTask does not swallow its failure either: the creation dialog stays
 * open and shows the message next to the form instead of the app notice, so
 * the user can fix the name and try again.
 */
export function createTask(req: CreateTaskRequest): Promise<string> {
  return api.createTask(req);
}

// runRemoval runs the removal of an item the user asked for, marking the item
// first: when it leaves, its page is not announced, since the user knows. A
// removal that fails leaves the item in place, so the mark goes with it.
async function runRemoval(
  id: string,
  failure: Failure,
  operation: () => Promise<void>,
): Promise<void> {
  useAppStore.setState({ expectGone: id });
  await run(failure, () =>
    operation().catch((error: unknown) => {
      if (useAppStore.getState().expectGone === id) {
        useAppStore.setState({ expectGone: null });
      }
      throw error;
    }),
  );
}

/** deleteTask removes the task for good and reports what stayed on disk. */
export function deleteTask(taskId: string): Promise<void> {
  return runRemoval(taskId, fail(withItem("Couldn't delete", itemName(taskId)), TRY), async () => {
    const result = await api.deleteTask(taskId);
    if (result.leftover !== null) {
      useAppStore.getState().setLeftover(result.leftover);
    }
  });
}

/** loadTranscript fetches a conversation and buffers what arrives meanwhile. */
export async function loadTranscript(taskId: string, stage: string): Promise<void> {
  useAppStore.getState().beginTranscript(taskId, stage);
  await run(fail(`Couldn't load the conversation of ${theItem(taskId)}`, TRY), async () => {
    const transcript = await api.getTranscript(taskId, stage);
    useAppStore.getState().setTranscript(transcript);
  });
}

/**
 * readEarlierConversation reads a conversation of a task that is not the one of its place. A failure
 * is kept on the conversation, where the row of Details that asked for it says so, and never raises
 * the app notice.
 */
export async function readEarlierConversation(taskId: string, stage: string): Promise<void> {
  const store = useAppStore.getState();
  store.beginTranscript(taskId, stage);
  try {
    store.setTranscript(await api.getTranscript(taskId, stage));
  } catch (error) {
    store.failTranscript(taskId, stage, messageOf(error));
  }
}

/**
 * readActionOutput reads the whole output of a command. Its failure has a place of its own, the
 * output that asked for it, and never raises the app notice.
 */
export function readActionOutput(
  taskId: string,
  stage: string,
  entryId: string,
): Promise<ActionOutput> {
  return api.getActionOutput(taskId, stage, entryId);
}

/**
 * sendMessageInPlace sends a message from the composer, whose failure has a place of its own under
 * the field: "" when it is sent, the reason when it is not.
 */
export async function sendMessageInPlace(
  taskId: string,
  stage: string,
  text: string,
): Promise<string> {
  return (await inPlace(() => api.sendMessage(taskId, stage, text))) ?? "";
}

export async function removePending(taskId: string, stage: string, entryId: string): Promise<void> {
  await run(fail(`Couldn't remove the queued message of ${theItem(taskId)}`, TRY), () =>
    api.removePending(taskId, stage, entryId),
  );
}

export async function interrupt(taskId: string, stage: string): Promise<void> {
  await run(fail(`Couldn't stop the agent of ${theItem(taskId)}`, TRY), () =>
    api.interrupt(taskId, stage),
  );
}

export async function pause(taskId: string, stage: string): Promise<void> {
  await run(fail(withItem("Couldn't pause", itemName(taskId)), TRY), () =>
    api.pause(taskId, stage),
  );
}

export async function resume(taskId: string, stage: string): Promise<void> {
  await run(fail(withItem("Couldn't resume", itemName(taskId)), TRY), () =>
    api.resume(taskId, stage),
  );
}

/**
 * resumeInPlace resumes a paused session from the composer, which sends right after it and shows
 * the failure under the field: "" when it resumed, the reason when it did not.
 */
export async function resumeInPlace(taskId: string, stage: string): Promise<string> {
  return (await inPlace(() => api.resume(taskId, stage))) ?? "";
}

export async function retry(taskId: string, stage: string): Promise<void> {
  await run(fail(withItem("Couldn't retry", itemName(taskId)), TRY), () =>
    api.retry(taskId, stage),
  );
}

/**
 * answerPermissionInPlace answers a permission from its card, whose failure has a place of its own
 * at the foot of the card: "" when it is sent, the reason when it is not.
 */
export async function answerPermissionInPlace(
  taskId: string,
  stage: string,
  requestId: string,
  decision: PermissionDecision,
  message: string,
): Promise<string> {
  return (
    (await inPlace(() => api.answerPermission(taskId, stage, requestId, decision, message))) ?? ""
  );
}

/**
 * answerQuestionInPlace answers a question from its card or from the composer, whose failure has a
 * place of its own: "" when it is sent, the reason when it is not. The question is marked as
 * sending while the answer is on its way, for the card and the composer alike; sent, it stays
 * marked, with its choices, until the conversation marks it answered.
 */
export async function answerQuestionInPlace(
  taskId: string,
  stage: string,
  requestId: string,
  answers: Record<string, string>,
): Promise<string> {
  useAppStore.getState().setQuestionSending(requestId, true);
  const failure = await inPlace(() => api.answerQuestion(taskId, stage, requestId, answers));
  if (failure !== null) {
    useAppStore.getState().setQuestionSending(requestId, false);
    return failure;
  }
  return "";
}

/** backToStage reopens a stage that is already done. */
export async function backToStage(taskId: string, stage: TaskStage): Promise<void> {
  await run(fail(`Couldn't go back to the ${stageName(stage)} of ${theItem(taskId)}`, TRY), () =>
    api.backToStage(taskId, stage),
  );
}

/** discardStage throws a stage away and starts it over. */
export async function discardStage(taskId: string, stage: TaskStage): Promise<void> {
  await run(fail(`Couldn't discard the ${stageName(stage)} of ${theItem(taskId)}`, TRY), () =>
    api.discardStage(taskId, stage),
  );
}

/** continueStage moves a task revisiting a stage on to the next one. */
export async function continueStage(taskId: string): Promise<void> {
  await run(fail(withItem("Couldn't continue", itemName(taskId)), TRY), () =>
    api.continueStage(taskId),
  );
}

/** retryStep starts a blocked step over, from the fetch. */
export async function retryStep(taskId: string): Promise<void> {
  await run(fail(`Couldn't retry the step of ${theItem(taskId)}`, cloneRemedy(taskId, TRY)), () =>
    api.retryStep(taskId),
  );
}

/**
 * cleanAndStartStep throws away every change in the worktree and starts the step. Its dialog shows
 * the failure: it answers the message of the failure, or null, and leaves the app notice alone.
 */
export function cleanAndStartStep(taskId: string): Promise<string | null> {
  return inPlace(() => api.cleanAndStartStep(taskId));
}

/** discardStep deletes the conversation of the step and runs it again from scratch. */
export async function discardStep(taskId: string, cleanWorktree: boolean): Promise<void> {
  await run(fail(`Couldn't discard the step of ${theItem(taskId)}`, cloneRemedy(taskId, TRY)), () =>
    api.discardStep(taskId, cleanWorktree),
  );
}

/** approveStep sends the reviewed step to be committed by the agent that wrote it. */
export async function approveStep(taskId: string): Promise<void> {
  await run(fail(`Couldn't approve the step of ${theItem(taskId)}`, TRY), () =>
    api.approveStep(taskId),
  );
}

/** reviewStepMyself takes the review of the current step back from the agent. */
export async function reviewStepMyself(taskId: string): Promise<void> {
  await run(fail(`Couldn't take over the review of the step of ${theItem(taskId)}`, TRY), () =>
    api.reviewStepMyself(taskId),
  );
}

/** openPR sends the draft the user approved to the agent, which opens the PR. */
export async function openPR(taskId: string, title: string, body: string): Promise<void> {
  await run(fail(`Couldn't open the pull request of ${theItem(taskId)}`, GH), async () => {
    await api.openPR(taskId, title, body);
    useAppStore.getState().clearPrDraft(taskId);
  });
}

/** approvePR sends the reviewed pull request to be committed and pushed. */
export async function approvePR(taskId: string): Promise<void> {
  await run(fail(`Couldn't approve the changes of ${theItem(taskId)}`, TRY), () =>
    api.approvePR(taskId),
  );
}

/** reviewAgain runs another review pass over an open pull request. */
export async function reviewAgain(taskId: string): Promise<void> {
  await run(fail(`Couldn't review the pull request of ${theItem(taskId)} again`, TRY), () =>
    api.reviewAgain(taskId),
  );
}

/** discardDraft throws away the draft of the pull request and writes it again. */
export async function discardDraft(taskId: string): Promise<void> {
  await run(
    fail(`Couldn't discard the draft of the pull request of ${theItem(taskId)}`, TRY),
    async () => {
      await api.discardDraft(taskId);
      useAppStore.getState().clearPrDraft(taskId);
    },
  );
}

/** retryPR starts the blocked PR stage of a task over. */
export async function retryPR(taskId: string): Promise<void> {
  await run(fail(`Couldn't retry the pull request of ${theItem(taskId)}`, GH), () =>
    api.retryPR(taskId),
  );
}

/** refreshPR asks GitHub again what became of the pull request. */
export async function refreshPR(taskId: string): Promise<void> {
  await run(fail(`Couldn't check the pull request of ${theItem(taskId)}`, GH), () =>
    api.refreshPR(taskId),
  );
}

/** closeTask removes the worktree of a merged task and updates its base branch. */
export function closeTask(taskId: string): Promise<void> {
  return runRemoval(
    taskId,
    fail(withItem("Couldn't close", itemName(taskId)), cloneRemedy(taskId, TRY)),
    () => api.closeTask(taskId),
  );
}

/** openInEditor opens the worktree of the task in the editor of the user. */
export async function openInEditor(taskId: string): Promise<void> {
  await run(fail(`Couldn't open ${theItem(taskId)} in the editor`, null), () =>
    api.openInEditor(taskId),
  );
}

/** openFileInEditor opens one changed file of the worktree in the editor of the user. */
export async function openFileInEditor(taskId: string, path: string): Promise<void> {
  await run(fail(`Couldn't open ${path} in the editor`, null), () =>
    api.openFileInEditor(taskId, path),
  );
}

export async function openExternal(url: string): Promise<void> {
  await run(fail("Couldn't open the link", null), () => api.openExternal(url));
}

/** refreshPullRequests reads the open pull requests again; the result arrives with the state. */
export async function refreshPullRequests(): Promise<void> {
  await run(fail("Couldn't refresh the pull requests", GH), () => api.refreshPullRequests());
}

/**
 * setReviewFilters chooses what the Reviews view shows. It answers whether Go
 * stored the filters, so the filter bar lets go of a choice that failed.
 */
export async function setReviewFilters(filters: ReviewFilters): Promise<boolean> {
  let stored = false;
  await run(fail("Couldn't change the filters of Reviews", TRY), async () => {
    await api.setReviewFilters(filters);
    stored = true;
  });
  return stored;
}

/**
 * startReview, askReviewAgain, publishReview and setReviewInstructions do not
 * swallow their failure: the dialog or the panel that asked shows it where the
 * user is.
 */
export function startReview(req: StartReviewRequest): Promise<string> {
  return api.startReview(req);
}

/** askReviewAgain asks the agent for another pass over the pull request as it is now. */
export function askReviewAgain(id: string, instructions: string): Promise<void> {
  return api.askReviewAgain(id, instructions);
}

/** publishReview sends the review to GitHub; the summary goes in the body only with withSummary. */
export function publishReview(
  id: string,
  verdict: ReviewVerdict,
  withSummary: boolean,
): Promise<void> {
  return api.publishReview(id, verdict, withSummary);
}

/** refreshReviewPR reads the pull request of a review now, out of the minute. */
export async function refreshReviewPR(id: string): Promise<void> {
  await run(fail(`Couldn't check the pull request of ${theItem(id)}`, GH), () =>
    api.refreshReviewPR(id),
  );
}

/** setReviewInstructions changes what every review of a repository is told to look at. */
export function setReviewInstructions(id: string, text: string): Promise<void> {
  return api.setReviewInstructions(id, text);
}

/**
 * decideFindingInPlace records what the user decided about one finding, on the finding itself: a
 * failure answers its message and is told where the decision was, not in the app notice.
 */
export function decideFindingInPlace(
  id: string,
  pass: number,
  number: number,
  decision: FindingDecision,
): Promise<string | null> {
  return inPlace(() => api.decideFinding(id, pass, number, decision));
}

/**
 * saveFindingTextInPlace records the text of a finding as the user left it, on the finding itself:
 * a failure answers its message, not the app notice.
 */
export function saveFindingTextInPlace(
  id: string,
  pass: number,
  number: number,
  text: string,
): Promise<string | null> {
  return inPlace(() => api.setFindingText(id, pass, number, text));
}

/**
 * decidePRFindingInPlace records what the user decided about one finding of the review of the pull
 * request of a task, on the finding itself: a failure answers its message, not the app notice.
 */
export function decidePRFindingInPlace(
  taskId: string,
  pass: number,
  number: number,
  decision: FindingDecision,
): Promise<string | null> {
  return inPlace(() => api.decidePRFinding(taskId, pass, number, decision));
}

/**
 * savePRFindingTextInPlace records the text of a finding of the review of the pull request of a
 * task as the user left it, on the finding itself: a failure answers its message, not the app notice.
 */
export function savePRFindingTextInPlace(
  taskId: string,
  pass: number,
  number: number,
  text: string,
): Promise<string | null> {
  return inPlace(() => api.setPRFindingText(taskId, pass, number, text));
}

/**
 * saveReviewSummaryInPlace is saveReviewSummary for the publish dialog, which saves the summary
 * right before publishing and shows its failure in its own footer: it answers the message, or null.
 */
export function saveReviewSummaryInPlace(
  id: string,
  pass: number,
  text: string,
): Promise<string | null> {
  return inPlace(() => api.setReviewSummary(id, pass, text));
}

/** saveReviewSummary records the summary of a pass as the user left it. */
export async function saveReviewSummary(id: string, pass: number, text: string): Promise<void> {
  await run(fail(`Couldn't save the summary of ${theItem(id)}`, TRY), () =>
    api.setReviewSummary(id, pass, text),
  );
}

/** applyReview asks the agent to fix the findings the user approved. */
export async function applyReview(id: string): Promise<void> {
  await run(fail(`Couldn't apply the approved findings of ${theItem(id)}`, TRY), () =>
    api.applyReview(id),
  );
}

/** approveReview sends the changes the agent made to be committed and pushed. */
export async function approveReview(id: string): Promise<void> {
  await run(fail(`Couldn't approve the changes of ${theItem(id)}`, TRY), () =>
    api.approveReview(id),
  );
}

/** openReviewInEditor opens the worktree of a review in the editor of the user. */
export async function openReviewInEditor(id: string): Promise<void> {
  await run(fail(`Couldn't open ${theItem(id)} in the editor`, null), () =>
    api.openReviewInEditor(id),
  );
}

/** openFindingInEditor opens the line a finding points at, in the editor of the user. */
export async function openFindingInEditor(id: string, pass: number, number: number): Promise<void> {
  await run(fail(`Couldn't open finding ${number} of ${theItem(id)} in the editor`, null), () =>
    api.openFindingInEditor(id, pass, number),
  );
}

/** openPRFindingInEditor opens the line a finding of the review of the pull request of a task points at, in the editor of the user. */
export async function openPRFindingInEditor(
  taskId: string,
  pass: number,
  number: number,
): Promise<void> {
  await run(fail(`Couldn't open finding ${number} of ${theItem(taskId)} in the editor`, null), () =>
    api.openPRFindingInEditor(taskId, pass, number),
  );
}

/** approveRestOfPRFindings approves every finding of the pass of the pull request of a task that has no decision; it answers whether it did. */
export function approveRestOfPRFindings(taskId: string, pass: number): Promise<boolean> {
  return run(fail(`Couldn't approve the rest of the findings of ${theItem(taskId)}`, TRY), () =>
    api.approveRestOfPRFindings(taskId, pass),
  );
}

/** applyPRFindings sends the agent the findings of the pull request of a task the user approved. */
export async function applyPRFindings(taskId: string): Promise<void> {
  await run(fail(`Couldn't apply the approved findings of ${theItem(taskId)}`, TRY), () =>
    api.applyPRFindings(taskId),
  );
}

/** approveRestOfFindings approves every finding of the pass of a review that has no decision; it answers whether it did. */
export function approveRestOfFindings(id: string, pass: number): Promise<boolean> {
  return run(fail(`Couldn't approve the rest of the findings of ${theItem(id)}`, TRY), () =>
    api.approveRestOfFindings(id, pass),
  );
}

/** deleteReview removes the review for good and reports what stayed on disk. */
export function deleteReview(id: string): Promise<void> {
  return runRemoval(id, fail(withItem("Couldn't delete", itemName(id)), TRY), async () => {
    const result = await api.deleteReview(id);
    if (result.leftover !== null) {
      useAppStore.getState().setLeftover(result.leftover);
    }
  });
}

/**
 * startDiscussion and discussionContext do not swallow their failure: the
 * dialog that creates a discussion shows it next to the form.
 */
export function startDiscussion(req: StartDiscussionRequest): Promise<string> {
  return api.startDiscussion(req);
}

export function discussionContext(req: DiscussionContextRequest): Promise<string> {
  return api.discussionContext(req);
}

/** saveDraftText records the title and the body of a draft as the user left them. */
export async function saveDraftText(
  id: string,
  draftId: string,
  title: string,
  body: string,
): Promise<void> {
  await run(fail(`Couldn't save a draft of ${theItem(id)}`, TRY), () =>
    api.setDraftText(id, draftId, title, body),
  );
}

/** setDraftRepository chooses the repository a draft is published to. */
export async function setDraftRepository(
  id: string,
  draftId: string,
  repositoryId: string,
): Promise<void> {
  await run(fail(`Couldn't change the repository of a draft of ${theItem(id)}`, TRY), () =>
    api.setDraftRepository(id, draftId, repositoryId),
  );
}

/** setDraftModule chooses the module of the card a draft writes. */
export async function setDraftModule(id: string, draftId: string, module: string): Promise<void> {
  await run(fail(`Couldn't change the module of a draft of ${theItem(id)}`, TRY), () =>
    api.setDraftModule(id, draftId, module),
  );
}

/** setDraftEpic puts a draft under an epic, another draft or an issue of GitHub; "" takes it out. */
export async function setDraftEpic(id: string, draftId: string, ref: string): Promise<void> {
  await run(fail(`Couldn't change the epic of a draft of ${theItem(id)}`, TRY), () =>
    api.setDraftEpic(id, draftId, ref),
  );
}

/**
 * setDraftEpicInPlace is setDraftEpic for the field of an existing issue: the refusal has its place
 * under the field, so it is answered, or null, instead of raised in the app notice.
 */
export function setDraftEpicInPlace(
  id: string,
  draftId: string,
  ref: string,
): Promise<string | null> {
  return inPlace(() => api.setDraftEpic(id, draftId, ref));
}

/**
 * addDraftDependency does not swallow its failure: the card of the draft shows
 * the refusal next to the field.
 */
export function addDraftDependency(id: string, draftId: string, ref: string): Promise<void> {
  return api.addDraftDependency(id, draftId, ref);
}

/** removeDraftDependency takes one dependency off a draft. */
export async function removeDraftDependency(
  id: string,
  draftId: string,
  ref: string,
): Promise<void> {
  await run(fail(`Couldn't remove the dependency ${ref} of a draft of ${theItem(id)}`, TRY), () =>
    api.removeDraftDependency(id, draftId, ref),
  );
}

/**
 * decideDraft records what the user decided about one draft and answers whether it went through;
 * the notice names the draft by its title.
 */
export function decideDraft(
  id: string,
  draftId: string,
  decision: DraftDecision,
): Promise<boolean> {
  const draft = storedDraft(id, draftId);
  const label =
    draft === null
      ? `Couldn't decide a draft of ${theItem(id)}`
      : `Couldn't decide ${draftTitle(draft)}`;
  return run(fail(label, TRY), () => api.decideDraft(id, draftId, decision));
}

/**
 * groupIntoEpicInPlace puts the drafts under a new epic: it answers the id of the epic, or the
 * refusal for the footer of the dialog.
 */
export async function groupIntoEpicInPlace(
  id: string,
  draftIds: string[],
  title: string,
  repositoryId: string,
): Promise<{ epicId: string } | { error: string }> {
  let epicId = "";
  const error = await inPlace(async () => {
    epicId = await api.groupIntoEpic(id, draftIds, title, repositoryId);
  });
  return error === null ? { epicId } : { error };
}

/** retryPublish publishes a draft again, after a failure. */
export async function retryPublish(id: string, draftId: string): Promise<void> {
  await run(fail(`Couldn't publish a draft of ${theItem(id)} again`, GH), () =>
    api.retryPublish(id, draftId),
  );
}

// removalInPlace runs the removal of an item whose refusal has a place of its own on screen: it
// marks the item as runRemoval does, and answers the message of the failure, or null.
async function removalInPlace(id: string, operation: () => Promise<void>): Promise<string | null> {
  useAppStore.setState({ expectGone: id });
  const error = await inPlace(operation);
  if (error !== null && useAppStore.getState().expectGone === id) {
    useAppStore.setState({ expectGone: null });
  }
  return error;
}

/** archiveDiscussionInPlace ends the conversation and sends the discussion to the history; it answers the refusal, or null. */
export function archiveDiscussionInPlace(id: string): Promise<string | null> {
  return removalInPlace(id, () => api.archiveDiscussion(id));
}

/** deleteDiscussionInPlace removes the discussion for good; it answers the refusal, or null. */
export function deleteDiscussionInPlace(id: string): Promise<string | null> {
  return removalInPlace(id, () => api.deleteDiscussion(id));
}
