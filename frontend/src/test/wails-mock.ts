import { vi } from "vitest";
import type {
  ArchivedDiscussion,
  ArchivedReview,
  ArchivedTask,
  Board,
  BoardCard,
  BoardPreview,
  BoardRemoval,
  BoardRepositoryChoice,
  BoardRepositoryOption,
  CloseResult,
  CreateTaskRequest,
  DeletePreview,
  DeleteResult,
  DiscussionCard,
  DiscussionContextRequest,
  DiscussionSummary,
  Draft,
  DraftDecision,
  DraftRef,
  Entry,
  EntryKind,
  FindingDecision,
  Migration,
  ModelCatalog,
  ModelStage,
  PermissionDecision,
  Prompt,
  PromptStage,
  PullRequest,
  PullRequestRow,
  Repository,
  RepositoryCandidate,
  Review,
  ReviewCenter,
  ReviewFilters,
  ReviewFinding,
  ReviewMode,
  ReviewPass,
  ReviewSummary,
  ReviewVerdict,
  SaveBoardRequest,
  Situation,
  SituationOpen,
  SituationStarted,
  StageModel,
  StartDiscussionRequest,
  StartReviewRequest,
  State,
  Step,
  StepReviewer,
  TaskCard,
  TaskStage,
  TaskStageModel,
  TaskSummary,
  ThemePreference,
  Transcript,
  TranscriptEvent,
} from "@/lib/wails";

export const api = {
  getState: vi.fn<() => Promise<State>>(() => Promise.resolve(makeState())),
  scanRepositories: vi.fn<() => Promise<RepositoryCandidate[]>>(() => Promise.resolve([])),
  addRepository: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  browseRepository: vi.fn<() => Promise<boolean>>(() => Promise.resolve(false)),
  changeRepositoryPath: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  removeRepository: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  setRepositoryFilter: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  cloneRepository: vi.fn<(id: string) => Promise<boolean>>(() => Promise.resolve(true)),
  chooseCloneFolder: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  setReviewInstructions: vi.fn<(id: string, text: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),

  previewBoard: vi.fn<(url: string) => Promise<BoardPreview>>(() =>
    Promise.resolve(makeBoardPreview()),
  ),
  previewEditBoard: vi.fn<(id: string) => Promise<BoardPreview>>(() =>
    Promise.resolve(makeBoardPreview()),
  ),
  checkBoardRepository: vi.fn<
    (boardId: string, fullName: string) => Promise<BoardRepositoryOption>
  >(() => Promise.resolve(makeBoardRepositoryOption())),
  addBoard: vi.fn<(url: string, req: SaveBoardRequest) => Promise<void>>(() => Promise.resolve()),
  updateBoard: vi.fn<(id: string, req: SaveBoardRequest) => Promise<void>>(() => Promise.resolve()),
  previewRemoveBoard: vi.fn<(id: string) => Promise<BoardRemoval>>(() =>
    Promise.resolve({ toNoBoard: 0, removed: 0 }),
  ),
  removeBoard: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  refreshBoard: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  refreshCard: vi.fn<(boardId: string, key: string) => Promise<void>>(() => Promise.resolve()),
  cardContext: vi.fn<(boardId: string, key: string) => Promise<string>>(() =>
    Promise.resolve("### Card: Add the login screen\n"),
  ),
  addRepositoryToBoard: vi.fn<(boardId: string, choice: BoardRepositoryChoice) => Promise<void>>(
    () => Promise.resolve(),
  ),
  setTheme: vi.fn<(preference: ThemePreference) => Promise<void>>(() => Promise.resolve()),
  setModelDefault: vi.fn<(stage: ModelStage, model: string, effort: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  setReviewModeDefault: vi.fn<(mode: ReviewMode) => Promise<void>>(() => Promise.resolve()),
  getPrompt: vi.fn<(stage: PromptStage) => Promise<Prompt>>((stage) =>
    Promise.resolve(makePrompt({ stage })),
  ),
  savePrompt: vi.fn<(stage: PromptStage, text: string) => Promise<Prompt>>((stage, text) =>
    Promise.resolve(makePrompt({ stage, text, modified: true })),
  ),
  restorePrompt: vi.fn<(stage: PromptStage) => Promise<Prompt>>((stage) =>
    Promise.resolve(makePrompt({ stage })),
  ),

  createTask: vi.fn<(req: CreateTaskRequest) => Promise<string>>(() => Promise.resolve("task-1")),
  deleteTask: vi.fn<(taskId: string) => Promise<DeleteResult>>(() =>
    Promise.resolve({ leftover: null }),
  ),
  previewDelete: vi.fn<(taskId: string) => Promise<DeletePreview>>(() =>
    Promise.resolve(makeDeletePreview()),
  ),
  getTranscript: vi.fn<(taskId: string, stage: string) => Promise<Transcript>>((taskId, stage) =>
    Promise.resolve(makeTranscript({ taskId, stage })),
  ),
  sendMessage: vi.fn<(taskId: string, stage: string, text: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  removePending: vi.fn<(taskId: string, stage: string, entryId: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  interrupt: vi.fn<(taskId: string, stage: string) => Promise<void>>(() => Promise.resolve()),
  pause: vi.fn<(taskId: string, stage: string) => Promise<void>>(() => Promise.resolve()),
  resume: vi.fn<(taskId: string, stage: string) => Promise<void>>(() => Promise.resolve()),
  retry: vi.fn<(taskId: string, stage: string) => Promise<void>>(() => Promise.resolve()),
  answerPermission: vi.fn<
    (
      taskId: string,
      stage: string,
      requestId: string,
      decision: PermissionDecision,
      message: string,
    ) => Promise<void>
  >(() => Promise.resolve()),
  answerQuestion: vi.fn<
    (
      taskId: string,
      stage: string,
      requestId: string,
      answers: Record<string, string>,
    ) => Promise<void>
  >(() => Promise.resolve()),
  readArtifact: vi.fn<(taskId: string, name: string) => Promise<string>>(() =>
    Promise.resolve("# PRD\n"),
  ),
  backToStage: vi.fn<(taskId: string, stage: TaskStage) => Promise<void>>(() => Promise.resolve()),
  discardStage: vi.fn<(taskId: string, stage: TaskStage) => Promise<void>>(() => Promise.resolve()),
  continueStage: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  retryStep: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  cleanAndStartStep: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  discardStep: vi.fn<(taskId: string, cleanWorktree: boolean) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  setStageModel: vi.fn<
    (taskId: string, stage: ModelStage, model: string, effort: string) => Promise<void>
  >(() => Promise.resolve()),
  setStepModel: vi.fn<
    (taskId: string, step: number, model: string, effort: string) => Promise<void>
  >(() => Promise.resolve()),
  setSessionModel: vi.fn<
    (taskId: string, stage: string, model: string, effort: string) => Promise<void>
  >(() => Promise.resolve()),
  setReviewMode: vi.fn<(taskId: string, mode: ReviewMode) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  setStepReviewMode: vi.fn<(taskId: string, step: number, mode: ReviewMode) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  reviewStepMyself: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  approveStep: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  openPR: vi.fn<(taskId: string, title: string, body: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  approvePR: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  reviewAgain: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  discardDraft: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  retryPR: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  refreshPR: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  closeTask: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  openInEditor: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  openFileInEditor: vi.fn<(taskId: string, path: string) => Promise<void>>(() => Promise.resolve()),
  openExternal: vi.fn<(url: string) => Promise<void>>(() => Promise.resolve()),

  refreshPullRequests: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  setReviewFilters: vi.fn<(filters: ReviewFilters) => Promise<void>>(() => Promise.resolve()),
  startReview: vi.fn<(req: StartReviewRequest) => Promise<string>>(() =>
    Promise.resolve("review-1"),
  ),
  askReviewAgain: vi.fn<(id: string, instructions: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  decideFinding: vi.fn<
    (id: string, pass: number, number: number, decision: FindingDecision) => Promise<void>
  >(() => Promise.resolve()),
  setFindingText: vi.fn<(id: string, pass: number, number: number, text: string) => Promise<void>>(
    () => Promise.resolve(),
  ),
  setReviewSummary: vi.fn<(id: string, pass: number, text: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  publishReview: vi.fn<(id: string, verdict: ReviewVerdict) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  applyReview: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  approveReview: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  deleteReview: vi.fn<(id: string) => Promise<DeleteResult>>(() =>
    Promise.resolve({ leftover: null }),
  ),
  readReviewArtifact: vi.fn<(id: string, name: string) => Promise<string>>(() =>
    Promise.resolve("## Findings\n"),
  ),
  openReviewInEditor: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  openFindingInEditor: vi.fn<(id: string, pass: number, number: number) => Promise<void>>(() =>
    Promise.resolve(),
  ),

  startDiscussion: vi.fn<(req: StartDiscussionRequest) => Promise<string>>(() =>
    Promise.resolve("discussion-1"),
  ),
  discussionContext: vi.fn<(req: DiscussionContextRequest) => Promise<string>>(() =>
    Promise.resolve("## Board\n"),
  ),
  setDraftText: vi.fn<(id: string, draftId: string, title: string, body: string) => Promise<void>>(
    () => Promise.resolve(),
  ),
  setDraftRepository: vi.fn<(id: string, draftId: string, repositoryId: string) => Promise<void>>(
    () => Promise.resolve(),
  ),
  setDraftModule: vi.fn<(id: string, draftId: string, module: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  setDraftEpic: vi.fn<(id: string, draftId: string, ref: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  addDraftDependency: vi.fn<(id: string, draftId: string, ref: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  removeDraftDependency: vi.fn<(id: string, draftId: string, ref: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  decideDraft: vi.fn<(id: string, draftId: string, decision: DraftDecision) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  groupIntoEpic: vi.fn<(id: string, draftIds: string[]) => Promise<string>>(() =>
    Promise.resolve("draft-epic"),
  ),
  publishEpic: vi.fn<(id: string, draftId: string) => Promise<void>>(() => Promise.resolve()),
  retryPublish: vi.fn<(id: string, draftId: string) => Promise<void>>(() => Promise.resolve()),
  archiveDiscussion: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  deleteDiscussion: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
  readDiscussionArtifact: vi.fn<(id: string, name: string) => Promise<string>>(() =>
    Promise.resolve("# Discussion\n"),
  ),

  viewSituation: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
};

let stateHandlers: ((state: State) => void)[] = [];
let transcriptHandlers: ((event: TranscriptEvent) => void)[] = [];
let situationStartedHandlers: ((event: SituationStarted) => void)[] = [];
let situationOpenHandlers: ((event: SituationOpen) => void)[] = [];

export const onStateChanged = vi.fn((handler: (state: State) => void): (() => void) => {
  stateHandlers.push(handler);
  return () => {
    stateHandlers = stateHandlers.filter((registered) => registered !== handler);
  };
});

export const onTranscriptChanged = vi.fn(
  (handler: (event: TranscriptEvent) => void): (() => void) => {
    transcriptHandlers.push(handler);
    return () => {
      transcriptHandlers = transcriptHandlers.filter((registered) => registered !== handler);
    };
  },
);

export const onSituationStarted = vi.fn(
  (handler: (event: SituationStarted) => void): (() => void) => {
    situationStartedHandlers.push(handler);
    return () => {
      situationStartedHandlers = situationStartedHandlers.filter(
        (registered) => registered !== handler,
      );
    };
  },
);

export const onSituationOpen = vi.fn((handler: (event: SituationOpen) => void): (() => void) => {
  situationOpenHandlers.push(handler);
  return () => {
    situationOpenHandlers = situationOpenHandlers.filter((registered) => registered !== handler);
  };
});

/** emitState delivers a state:changed event to everything currently subscribed. */
export function emitState(state: State): void {
  for (const handler of [...stateHandlers]) {
    handler(state);
  }
}

/** emitTranscript delivers a transcript:changed event to every subscriber. */
export function emitTranscript(event: TranscriptEvent): void {
  for (const handler of [...transcriptHandlers]) {
    handler(event);
  }
}

/** emitSituationStarted delivers a situation:started event to every subscriber. */
export function emitSituationStarted(event: SituationStarted): void {
  for (const handler of [...situationStartedHandlers]) {
    handler(event);
  }
}

/** emitSituationOpen delivers a situation:open event to every subscriber. */
export function emitSituationOpen(event: SituationOpen): void {
  for (const handler of [...situationOpenHandlers]) {
    handler(event);
  }
}

export function subscriberCount(): number {
  return stateHandlers.length;
}

export function transcriptSubscriberCount(): number {
  return transcriptHandlers.length;
}

export function makeState(overrides: Partial<State> = {}): State {
  return {
    migration: null,
    repositories: [makeRepository()],
    repositoryFilter: "",
    theme: "system",
    systemDark: false,
    modelDefaults: makeModelDefaults(),
    modelCatalog: makeModelCatalog(),
    reviewModeDefault: "manual",
    tasks: [],
    history: [],
    boards: [],
    reviewCenter: makeReviewCenter(),
    reviews: [],
    reviewHistory: [],
    discussions: [],
    discussionHistory: [],
    cloneFolder: "",
    ...overrides,
  };
}

export function makeRepository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: "repo-1",
    owner: "dev",
    name: "web",
    fullName: "dev/web",
    path: "/home/dev/projects/web",
    missing: false,
    activeTasks: 0,
    archivedTasks: 0,
    cloned: true,
    boardId: "",
    cloning: false,
    cloneError: "",
    reviewInstructions: "",
    activeReviews: 0,
    archivedReviews: 0,
    ...overrides,
  };
}

export function makeRepositoryCandidate(
  overrides: Partial<RepositoryCandidate> = {},
): RepositoryCandidate {
  return {
    owner: "dev",
    name: "web",
    fullName: "dev/web",
    path: "/home/dev/projects/web",
    registered: false,
    ...overrides,
  };
}

export function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: "board-1",
    owner: "dev",
    ownerType: "organization",
    number: 3,
    title: "Roadmap",
    url: "https://github.com/orgs/dev/projects/3",
    hasStatus: true,
    statuses: [
      { id: "todo", name: "Todo", final: false },
      { id: "in-progress", name: "In progress", final: false },
      { id: "done", name: "Done", final: true },
    ],
    repositoryIds: ["repo-1"],
    readAt: "2026-09-16T12:00:00Z",
    reading: false,
    failure: null,
    viewer: "dev",
    cards: [],
    newCardStatus: "",
    ...overrides,
  };
}

export function makeBoardCard(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    key: "dev/web#12",
    repository: "dev/web",
    number: 12,
    title: "Add the login screen",
    url: "https://github.com/dev/web/issues/12",
    state: "open",
    body: "Email and password.",
    statusId: "todo",
    status: "Todo",
    final: false,
    assignees: [],
    fields: [],
    pullRequests: [],
    epic: null,
    epicBody: "",
    siblings: [],
    dependencies: [],
    readAt: "2026-09-16T12:00:00Z",
    suggestedName: "12-add-the-login-screen",
    repositoryId: "repo-1",
    activeTaskId: "",
    archivedTaskId: "",
    action: "start",
    otherBoard: "",
    ...overrides,
  };
}

export function makeTaskCard(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    boardId: "board-1",
    key: "dev/web#12",
    repository: "dev/web",
    number: 12,
    title: "Add the login screen",
    url: "https://github.com/dev/web/issues/12",
    status: "In progress",
    state: "open",
    epic: null,
    ...overrides,
  };
}

export function makeBoardRepositoryOption(
  overrides: Partial<BoardRepositoryOption> = {},
): BoardRepositoryOption {
  return {
    owner: "dev",
    name: "web",
    fullName: "dev/web",
    cards: 4,
    checked: true,
    link: "registered",
    repositoryId: "repo-1",
    path: "/home/dev/projects/web",
    clones: [],
    otherBoard: "",
    ...overrides,
  };
}

export function makeBoardPreview(overrides: Partial<BoardPreview> = {}): BoardPreview {
  return {
    url: "https://github.com/orgs/dev/projects/3",
    owner: "dev",
    ownerType: "organization",
    number: 3,
    title: "Roadmap",
    hasStatus: true,
    statuses: [
      { id: "todo", name: "Todo", final: false },
      { id: "done", name: "Done", final: true },
    ],
    repositories: [makeBoardRepositoryOption()],
    newCardStatus: "",
    ...overrides,
  };
}

export function makeMigration(overrides: Partial<Migration> = {}): Migration {
  return {
    cases: [
      {
        kind: "root_task",
        repository: "",
        detail: "",
        tasks: [{ name: "add-login", workspace: "/home/dev/projects", path: "" }],
      },
    ],
    ...overrides,
  };
}

export function makeTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: "task-1",
    name: "add-login",
    repositoryId: "repo-1",
    repository: "dev/web",
    card: null,
    mode: "structured",
    stage: "prd",
    revisiting: false,
    reviewMode: "manual",
    reviewModeEditable: true,
    sessionStatus: "waiting",
    sessionModel: "claude-fable-5-1",
    sessionEffort: "high",
    turnRunning: false,
    processRunning: false,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    corrections: 0,
    hasPrd: false,
    hasTechSpec: false,
    hasOneShot: false,
    steps: [],
    currentStep: 0,
    pr: null,
    planProblems: [],
    situations: [],
    models: makeTaskModels(),
    canContinue: false,
    artifactVersion: 0,
    lastError: "",
    createdAt: "2026-09-05T10:00:00Z",
    updatedAt: "2026-09-05T10:00:00Z",
    ...overrides,
  };
}

export function makeSituation(overrides: Partial<Situation> = {}): Situation {
  return {
    id: "situation-1",
    taskId: "task-1",
    kind: "reply",
    group: "waiting",
    form: "",
    percent: 0,
    place: { kind: "stage", stage: "prd", step: 0 },
    startedAt: "2026-09-05T10:00:00Z",
    ...overrides,
  };
}

export function makeArchivedTask(overrides: Partial<ArchivedTask> = {}): ArchivedTask {
  return {
    id: "task-1",
    name: "add-login",
    repositoryId: "repo-1",
    repository: "dev/web",
    card: null,
    mode: "structured",
    hasPrd: true,
    hasTechSpec: true,
    hasOneShot: false,
    steps: [
      {
        number: 1,
        file: "1-add-the-login-form.md",
        title: "Add the login form",
        reports: [],
      },
    ],
    pr: { number: 12, url: "https://github.com/dev/web/pull/12", state: "merged" },
    artifactVersion: 3,
    createdAt: "2026-09-05T10:00:00Z",
    archivedAt: "2026-09-08T10:00:00Z",
    ...overrides,
  };
}

export function makeDeletePreview(overrides: Partial<DeletePreview> = {}): DeletePreview {
  return { sessionRunning: false, worktree: null, branch: null, pr: null, ...overrides };
}

export function makeCloseResult(overrides: Partial<CloseResult> = {}): CloseResult {
  return {
    worktree: { outcome: "done", reason: "", detail: "" },
    branch: { outcome: "done", reason: "", detail: "" },
    base: { outcome: "done", reason: "", detail: "" },
    worktreePath: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
    branchName: "add-login",
    baseBranch: "dev",
    baseCommits: 3,
    closedAt: "2026-09-08T10:00:00Z",
    ...overrides,
  };
}

export function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    number: 1,
    file: "1-add-the-login-form.md",
    title: "Add the login form",
    status: "not_started",
    phase: "",
    block: null,
    worktreePath: "",
    review: null,
    commitSha: "",
    commitSubject: "",
    commitFailed: false,
    model: "claude-opus-5",
    effort: "high",
    adjusted: false,
    modelEditable: true,
    reviewMode: "manual",
    reviewModeAdjusted: false,
    reviewModeEditable: true,
    reviewFallback: "",
    reviewPass: 0,
    reviewRound: 0,
    reportMissing: false,
    reports: [],
    reviewer: null,
    ...overrides,
  };
}

export function makeStepReviewer(overrides: Partial<StepReviewer> = {}): StepReviewer {
  return {
    sessionStage: "step_review:1",
    sessionStatus: "waiting",
    sessionModel: "claude-opus-5",
    sessionEffort: "high",
    turnRunning: false,
    processRunning: false,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    lastError: "",
    ...overrides,
  };
}

export function makePullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    status: "preparing",
    block: null,
    worktreePath: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
    branch: "add-login",
    baseBranch: "origin/dev",
    draft: null,
    reports: [],
    review: null,
    commitFailed: false,
    prNumber: 0,
    prUrl: "",
    prState: "",
    checkedAt: "",
    prBase: "",
    checkError: "",
    canClose: false,
    cloneMissing: false,
    close: null,
    sessionStage: "pr",
    sessionStatus: "waiting",
    sessionModel: "claude-opus-5",
    sessionEffort: "medium",
    turnRunning: false,
    processRunning: false,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    lastError: "",
    ...overrides,
  };
}

// factoryChoices is the model and the effort the app ships each stage with, in
// workflow order.
const factoryChoices: { stage: ModelStage; model: string; effort: string }[] = [
  { stage: "prd", model: "claude-fable-5-1", effort: "high" },
  { stage: "tech_spec", model: "claude-fable-5-1", effort: "high" },
  { stage: "plan", model: "claude-fable-5-1", effort: "high" },
  { stage: "one_shot", model: "claude-fable-5-1", effort: "high" },
  { stage: "implementation", model: "claude-opus-5", effort: "high" },
  { stage: "step_review", model: "claude-opus-5", effort: "high" },
  { stage: "pr", model: "claude-opus-5", effort: "medium" },
  { stage: "pr_review", model: "claude-opus-5", effort: "high" },
  { stage: "discussion", model: "claude-fable-5-1", effort: "high" },
];

/**
 * makeModelCatalog is what the installed Claude Code offers: the models of the
 * reference machine, the last of which takes no effort.
 */
export function makeModelCatalog(overrides: Partial<ModelCatalog> = {}): ModelCatalog {
  const efforts = ["low", "medium", "high", "xhigh", "max"];
  return {
    models: [
      { name: "claude-opus-5-5[1m]", efforts: [...efforts] },
      { name: "claude-fable-5-1", efforts: [...efforts] },
      { name: "claude-sonnet-5", efforts: [...efforts] },
      { name: "claude-haiku-4-5-20251001", efforts: [] },
    ],
    failure: "",
    ...overrides,
  };
}

/** makeModelDefaults are the factory choices of the nine stages of the app. */
export function makeModelDefaults(): StageModel[] {
  return factoryChoices.map((choice) => ({ ...choice }));
}

/**
 * makeTaskModels are the models of the seven stages of a Structured task in the
 * PRD, whose session runs while every other stage is still to start, with what
 * overrides says of each line.
 */
export function makeTaskModels(
  overrides: Partial<Record<ModelStage, Partial<TaskStageModel>>> = {},
): TaskStageModel[] {
  return (
    factoryChoices
      // A task has neither the One-Shot planning nor the discussion, which is no
      // stage of a task at all.
      .filter((choice) => choice.stage !== "one_shot" && choice.stage !== "discussion")
      .map((choice) => ({
        ...choice,
        editable: choice.stage !== "prd",
        live: choice.stage === "prd",
        ...overrides[choice.stage],
      }))
  );
}

export function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    stage: "prd",
    text: "# PRD Creator\n\nWrite the PRD of {{task_name}}.\n",
    modified: false,
    placeholders: ["{{task_name}}", "{{artifacts_dir}}", "{{prd_path}}", "{{initial_context}}"],
    ...overrides,
  };
}

export function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    files: [
      { path: "src/LoginForm.tsx", kind: "modified", staged: true },
      { path: "src/api/login.ts", kind: "added", staged: false },
    ],
    staged: 1,
    total: 2,
    percent: 50,
    error: "",
    ...overrides,
  };
}

export function makeReviewCenter(overrides: Partial<ReviewCenter> = {}): ReviewCenter {
  return {
    pullRequests: [],
    failures: [],
    readAt: "",
    reading: false,
    filters: makeReviewFilters(),
    pendingCount: 0,
    authors: [],
    labels: [],
    ...overrides,
  };
}

export function makeReviewFilters(overrides: Partial<ReviewFilters> = {}): ReviewFilters {
  return {
    boardId: "",
    repositoryId: "",
    authorsInclude: [],
    authorsExclude: [],
    labelsInclude: [],
    labelsExclude: [],
    pendingOnly: false,
    ...overrides,
  };
}

export function makePullRequestRow(overrides: Partial<PullRequestRow> = {}): PullRequestRow {
  return {
    key: "dev/web#31",
    repositoryId: "repo-1",
    repository: "dev/web",
    boardId: "",
    number: 31,
    title: "Add the login screen",
    url: "https://github.com/dev/web/pull/31",
    author: "alice",
    labels: [],
    draft: false,
    own: false,
    card: null,
    reviewed: false,
    newCommits: false,
    pending: true,
    filtered: false,
    taskId: "",
    reviewId: "",
    action: "review",
    updatedAt: "2026-09-16T12:00:00Z",
    ...overrides,
  };
}

export function makeReviewSummary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    id: "review-1",
    repositoryId: "repo-1",
    repository: "dev/web",
    number: 31,
    title: "Add the login screen",
    author: "alice",
    url: "https://github.com/dev/web/pull/31",
    headBranch: "add-login",
    baseBranch: "dev",
    own: false,
    mode: "publish",
    status: "reviewing",
    card: null,
    worktreePath: "/home/dev/.local/share/myspec/worktrees/dev/web/pr_31",
    passes: [],
    stalePass: false,
    checkError: "",
    publishError: "",
    passBlocked: "",
    unreadableReport: "",
    commitFailed: false,
    review: null,
    verdicts: ["approve", "request_changes", "comment"],
    canPublish: false,
    canApply: false,
    canApprove: false,
    canReviewAgain: false,
    sessionStage: "review",
    sessionStatus: "working",
    sessionModel: "claude-opus-5",
    sessionEffort: "high",
    turnRunning: true,
    processRunning: true,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    lastError: "",
    situations: [],
    createdAt: "2026-09-16T12:00:00Z",
    ...overrides,
  };
}

export function makeReviewPass(overrides: Partial<ReviewPass> = {}): ReviewPass {
  return {
    pass: 1,
    file: "review-1.md",
    recorded: true,
    clean: false,
    instructions: "",
    summary: "Two things to fix.",
    findings: [makeReviewFinding()],
    revision: 1,
    published: false,
    publishedAt: "",
    publishedUrl: "",
    verdict: "",
    edited: false,
    ...overrides,
  };
}

export function makeReviewFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    number: 1,
    path: "src/login.ts",
    line: 12,
    text: "The token is never cleared.",
    decision: "",
    placement: "",
    ...overrides,
  };
}

export function makeArchivedReview(overrides: Partial<ArchivedReview> = {}): ArchivedReview {
  return {
    id: "review-1",
    repositoryId: "repo-1",
    repository: "dev/web",
    number: 31,
    title: "Add the login screen",
    author: "alice",
    url: "https://github.com/dev/web/pull/31",
    mode: "publish",
    outcome: "merged",
    card: null,
    passes: [makeReviewPass()],
    createdAt: "2026-09-16T12:00:00Z",
    archivedAt: "2026-09-17T12:00:00Z",
    ...overrides,
  };
}

export function makeDiscussion(overrides: Partial<DiscussionSummary> = {}): DiscussionSummary {
  return {
    id: "discussion-1",
    boardId: "board-1",
    board: "Roadmap",
    title: "Invoices",
    text: "Split the invoices screen.",
    status: "discussing",
    cards: [makeDiscussionCard()],
    drafts: [],
    draftsRead: false,
    draftsRevision: 0,
    unreadableDrafts: "",
    hasDocument: false,
    documentRevision: 0,
    moduleField: "Module",
    moduleOptions: ["Billing", "Invoices"],
    repositories: [{ id: "repo-1", fullName: "dev/web", cloned: true, missing: false }],
    canArchive: true,
    archiveHint: "",
    sessionStage: "discussion",
    sessionStatus: "working",
    sessionModel: "claude-opus-5",
    sessionEffort: "high",
    turnRunning: true,
    processRunning: true,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    lastError: "",
    situations: [],
    createdAt: "2026-09-16T12:00:00Z",
    ...overrides,
  };
}

export function makeDiscussionCard(overrides: Partial<DiscussionCard> = {}): DiscussionCard {
  return {
    key: "dev/web#12",
    repository: "dev/web",
    number: 12,
    title: "Add the login screen",
    url: "https://github.com/dev/web/issues/12",
    ...overrides,
  };
}

export function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "draft-1",
    position: 1,
    kind: "new",
    source: "agent",
    repository: "dev/web",
    repositoryId: "repo-1",
    card: null,
    title: "Export the invoices",
    body: "A button that exports the list.",
    module: "",
    epic: null,
    dependencies: [],
    current: null,
    decision: "",
    revision: 1,
    warnings: [],
    outcome: "",
    number: 0,
    url: "",
    published: false,
    publishedAt: "",
    publishError: "",
    publishing: false,
    waits: "",
    canPublish: false,
    hint: "",
    ...overrides,
  };
}

export function makeDraftRef(overrides: Partial<DraftRef> = {}): DraftRef {
  return {
    draft: "draft-2",
    key: "",
    reference: "",
    title: "Group the invoices",
    url: "",
    ...overrides,
  };
}

export function makeArchivedDiscussion(
  overrides: Partial<ArchivedDiscussion> = {},
): ArchivedDiscussion {
  return {
    id: "discussion-1",
    boardId: "board-1",
    board: "Roadmap",
    title: "Invoices",
    cards: [makeDiscussionCard()],
    drafts: [makeDraft()],
    publishedCount: 1,
    repositoryIds: ["repo-1"],
    createdAt: "2026-09-16T12:00:00Z",
    archivedAt: "2026-09-17T12:00:00Z",
    ...overrides,
  };
}

let entrySeq = 0;

// Every entry carries exactly the payload of its kind, like the Go side.
function payloadOf(kind: EntryKind): Omit<Entry, "id" | "seq" | "turnId" | "kind" | "createdAt"> {
  const empty = {
    user: null,
    assistant: null,
    action: null,
    permission: null,
    question: null,
    marker: null,
    error: null,
  };
  switch (kind) {
    case "user":
      return {
        ...empty,
        user: { text: "Add a login screen", pending: false, prompt: false, app: false },
      };
    case "assistant":
      return {
        ...empty,
        assistant: {
          messageId: "msg_1",
          blockIndex: 0,
          text: "On it.",
          complete: true,
          interrupted: false,
        },
      };
    case "action":
      return {
        ...empty,
        action: {
          toolUseId: "toolu_1",
          tool: "Read",
          label: "Read",
          target: "src/main.tsx",
          status: "done",
        },
      };
    case "permission":
      return {
        ...empty,
        permission: {
          requestId: "req-1",
          toolUseId: "toolu_1",
          tool: "Bash",
          displayName: "Bash",
          description: "List the working directory",
          input: '{"command":"ls"}',
          suggestions: "",
          blockedPath: "",
          decisionReason: "",
          suppressAlwaysAllow: false,
          defaultToNo: false,
          status: "pending",
          denyMessage: "",
          answeredAt: "",
        },
      };
    case "question":
      return {
        ...empty,
        question: {
          requestId: "req-1",
          toolUseId: "toolu_1",
          questions: [
            {
              question: "Which database?",
              header: "Database",
              options: [
                { label: "SQLite", description: "One file, no server" },
                { label: "Postgres", description: "A server to run" },
              ],
              multiSelect: false,
            },
          ],
          answers: null,
          status: "pending",
        },
      };
    case "marker":
      return {
        ...empty,
        marker: {
          type: "prd_written",
          preTokens: 0,
          stage: "",
          step: 0,
          pass: 0,
          clean: false,
          restarted: false,
        },
      };
    case "error":
      return {
        ...empty,
        error: { kind: "turn_error", message: "the agent stopped", retryable: true },
      };
  }
}

export function makeEntry(kind: EntryKind, overrides: Partial<Entry> = {}): Entry {
  entrySeq += 1;
  return {
    id: `entry-${entrySeq}`,
    seq: entrySeq,
    turnId: "entry-1",
    kind,
    createdAt: "2026-09-05T10:00:00Z",
    ...payloadOf(kind),
    ...overrides,
  };
}

export function makeTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    taskId: "task-1",
    sessionId: "session-1",
    stage: "prd",
    entries: [],
    pending: [],
    ...overrides,
  };
}

export function resetWailsMock(): void {
  stateHandlers = [];
  transcriptHandlers = [];
  situationStartedHandlers = [];
  situationOpenHandlers = [];
  entrySeq = 0;
  for (const fn of Object.values(api)) {
    fn.mockClear();
  }
  onStateChanged.mockClear();
  onTranscriptChanged.mockClear();
  onSituationStarted.mockClear();
  onSituationOpen.mockClear();
  api.getState.mockImplementation(() => Promise.resolve(makeState()));
  api.scanRepositories.mockImplementation(() => Promise.resolve([]));
  api.addRepository.mockImplementation(() => Promise.resolve());
  api.cloneRepository.mockImplementation(() => Promise.resolve(true));
  api.previewBoard.mockImplementation(() => Promise.resolve(makeBoardPreview()));
  api.previewEditBoard.mockImplementation(() => Promise.resolve(makeBoardPreview()));
  api.checkBoardRepository.mockImplementation(() => Promise.resolve(makeBoardRepositoryOption()));
  api.previewRemoveBoard.mockImplementation(() => Promise.resolve({ toNoBoard: 0, removed: 0 }));
  api.cardContext.mockImplementation(() => Promise.resolve("### Card: Add the login screen\n"));
  api.createTask.mockImplementation(() => Promise.resolve("task-1"));
  api.startReview.mockImplementation(() => Promise.resolve("review-1"));
  api.startDiscussion.mockImplementation(() => Promise.resolve("discussion-1"));
  api.discussionContext.mockImplementation(() => Promise.resolve("## Board\n"));
  api.groupIntoEpic.mockImplementation(() => Promise.resolve("draft-epic"));
  api.readDiscussionArtifact.mockImplementation(() => Promise.resolve("# Discussion\n"));
  api.deleteReview.mockImplementation(() => Promise.resolve({ leftover: null }));
  api.readReviewArtifact.mockImplementation(() => Promise.resolve("## Findings\n"));
  api.getTranscript.mockImplementation((taskId, stage) =>
    Promise.resolve(makeTranscript({ taskId, stage })),
  );
  api.getPrompt.mockImplementation((stage) => Promise.resolve(makePrompt({ stage })));
  api.savePrompt.mockImplementation((stage, text) =>
    Promise.resolve(makePrompt({ stage, text, modified: true })),
  );
  api.restorePrompt.mockImplementation((stage) => Promise.resolve(makePrompt({ stage })));
}
