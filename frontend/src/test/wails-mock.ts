import { vi } from "vitest";
import type {
  CreateTaskRequest,
  Entry,
  EntryKind,
  PermissionDecision,
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
  deleteTask: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  getTranscript: vi.fn<(taskId: string) => Promise<Transcript>>((taskId) =>
    Promise.resolve(makeTranscript({ taskId })),
  ),
  sendMessage: vi.fn<(taskId: string, text: string) => Promise<void>>(() => Promise.resolve()),
  removePending: vi.fn<(taskId: string, entryId: string) => Promise<void>>(() => Promise.resolve()),
  interrupt: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  pause: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  resume: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  retry: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  answerPermission: vi.fn<
    (
      taskId: string,
      requestId: string,
      decision: PermissionDecision,
      message: string,
    ) => Promise<void>
  >(() => Promise.resolve()),
  answerQuestion: vi.fn<
    (taskId: string, requestId: string, answers: Record<string, string>) => Promise<void>
  >(() => Promise.resolve()),
  readArtifact: vi.fn<(taskId: string, name: string) => Promise<string>>(() =>
    Promise.resolve("# PRD\n"),
  ),
  backToStage: vi.fn<(taskId: string, stage: TaskStage) => Promise<void>>(() => Promise.resolve()),
  discardStage: vi.fn<(taskId: string, stage: TaskStage) => Promise<void>>(() => Promise.resolve()),
  continueStage: vi.fn<(taskId: string) => Promise<void>>(() => Promise.resolve()),
  openExternal: vi.fn<(url: string) => Promise<void>>(() => Promise.resolve()),
};

let stateHandlers: ((state: State) => void)[] = [];
let transcriptHandlers: ((event: TranscriptEvent) => void)[] = [];

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
    planProblems: [],
    canContinue: false,
    artifactVersion: 0,
    lastError: "",
    createdAt: "2026-09-05T10:00:00Z",
    updatedAt: "2026-09-05T10:00:00Z",
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
        marker: { type: "prd_written", preTokens: 0, stage: "", step: 0, restarted: false },
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
  entrySeq = 0;
  for (const fn of Object.values(api)) {
    fn.mockClear();
  }
  onStateChanged.mockClear();
  onTranscriptChanged.mockClear();
  api.getState.mockImplementation(() => Promise.resolve(makeState()));
  api.createTask.mockImplementation(() => Promise.resolve("task-1"));
  api.getTranscript.mockImplementation((taskId) => Promise.resolve(makeTranscript({ taskId })));
}
