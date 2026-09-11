import { vi } from "vitest";
import type {
  ArchivedTask,
  CloseResult,
  CreateTaskRequest,
  DeletePreview,
  DeleteResult,
  Entry,
  EntryKind,
  PermissionDecision,
  RepoPR,
  Review,
  Situation,
  SituationOpen,
  SituationStarted,
  State,
  Step,
  TaskStage,
  TaskSummary,
  ThemePreference,
  Transcript,
  TranscriptEvent,
} from "@/lib/wails";

export const api = {
  getState: vi.fn<() => Promise<State>>(() => Promise.resolve(makeState())),
  openPath: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  openFolderDialog: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  removeRecent: vi.fn<(path: string) => Promise<void>>(() => Promise.resolve()),
  dismissNotice: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  setTheme: vi.fn<(preference: ThemePreference) => Promise<void>>(() => Promise.resolve()),

  createTask: vi.fn<(req: CreateTaskRequest) => Promise<string>>(() => Promise.resolve("task-1")),
  deleteTask: vi.fn<(taskId: string) => Promise<DeleteResult>>(() =>
    Promise.resolve({ leftovers: [] }),
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
  approveStep: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  openPR: vi.fn<(taskId: string, repoPath: string, title: string, body: string) => Promise<void>>(
    () => Promise.resolve(),
  ),
  approveRepo: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  reviewAgain: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  discardDraft: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  retryRepo: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  refreshPR: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  closeRepo: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  openInEditor: vi.fn<(taskId: string, repoPath: string) => Promise<void>>(() => Promise.resolve()),
  openFileInEditor: vi.fn<(taskId: string, repoPath: string, path: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  openExternal: vi.fn<(url: string) => Promise<void>>(() => Promise.resolve()),

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
    workspace: {
      name: "projects",
      path: "/home/dev/projects",
      repos: [
        { name: "api", path: "/home/dev/projects/api" },
        { name: "web", path: "/home/dev/projects/web" },
      ],
    },
    recents: [
      { name: "projects", path: "/home/dev/projects" },
      { name: "labs", path: "/home/dev/labs" },
      { name: "scratch", path: "/home/dev/scratch" },
    ],
    theme: "system",
    systemDark: false,
    notice: null,
    tasks: [],
    history: [],
    ...overrides,
  };
}

export function makeTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: "task-1",
    name: "add-login",
    repoPath: "",
    dir: "/home/dev/.local/share/myspec/workspaces/projects-1a2b3c4d/tasks/add-login",
    stage: "prd",
    revisiting: false,
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    corrections: 0,
    hasPrd: false,
    hasTechSpec: false,
    steps: [],
    currentStep: 0,
    repos: [],
    planProblems: [],
    situations: [],
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
    place: { kind: "stage", stage: "prd", step: 0, repoPath: "", repository: "" },
    startedAt: "2026-09-05T10:00:00Z",
    ...overrides,
  };
}

export function makeArchivedTask(overrides: Partial<ArchivedTask> = {}): ArchivedTask {
  return {
    id: "task-1",
    name: "add-login",
    repoPath: "",
    hasPrd: true,
    hasTechSpec: true,
    steps: [
      {
        number: 1,
        file: "1-add-the-login-form.md",
        title: "Add the login form",
        repository: "web",
      },
    ],
    repos: [
      {
        repository: "web",
        repoPath: "/home/dev/projects/web",
        prNumber: 12,
        prUrl: "https://github.com/dev/web/pull/12",
        prState: "merged",
      },
    ],
    artifactVersion: 3,
    createdAt: "2026-09-05T10:00:00Z",
    archivedAt: "2026-09-08T10:00:00Z",
    ...overrides,
  };
}

export function makeDeletePreview(overrides: Partial<DeletePreview> = {}): DeletePreview {
  return { sessionRunning: false, worktrees: [], branches: [], prs: [], ...overrides };
}

export function makeCloseResult(overrides: Partial<CloseResult> = {}): CloseResult {
  return {
    worktree: { outcome: "done", reason: "", detail: "" },
    branch: { outcome: "done", reason: "", detail: "" },
    base: { outcome: "done", reason: "", detail: "" },
    worktreePath: "/home/dev/.local/share/myspec/worktrees/add-login-web",
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
    repository: "web",
    repoPath: "/home/dev/projects/web",
    status: "not_started",
    phase: "",
    block: null,
    worktreePath: "",
    review: null,
    commitSha: "",
    commitSubject: "",
    commitFailed: false,
    ...overrides,
  };
}

export function makeRepoPR(overrides: Partial<RepoPR> = {}): RepoPR {
  return {
    repository: "web",
    repoPath: "/home/dev/projects/web",
    slug: "web",
    status: "preparing",
    block: null,
    worktreePath: "/home/dev/.local/share/myspec/worktrees/add-login-web",
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
    close: null,
    sessionStage: "pr:web",
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    retryAttempt: 0,
    contextPercent: 0,
    pendingCount: 0,
    lastError: "",
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
  api.createTask.mockImplementation(() => Promise.resolve("task-1"));
  api.getTranscript.mockImplementation((taskId, stage) =>
    Promise.resolve(makeTranscript({ taskId, stage })),
  );
}
