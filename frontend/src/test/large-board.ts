/**
 * A board at the size that decides whether its list is windowed (docs/product/features.md, Visão do
 * board): 2,000 cards in ten statuses, with epics, dependencies and tasks in the proportion of
 * Platform Roadmap. The tests of the window and of the keys of the board list draw it.
 */

import type { Board, BoardCard, CardDependency, Repository, State, TaskSummary } from "@/lib/wails";

/** CARDS is how many cards the large board has. */
const CARDS = 2000;

export const BOARD_ID = "board-large";

// STATUSES are the ten statuses of Platform Roadmap, with the share of the cards each one has, in
// percent; the three final ones hold most of the board, as they do there.
const STATUSES: { name: string; final: boolean; share: number }[] = [
  { name: "Backlog", final: false, share: 20 },
  { name: "Ready", final: false, share: 8 },
  { name: "In progress", final: false, share: 4 },
  { name: "Code review", final: false, share: 3 },
  { name: "Changes requested", final: false, share: 1 },
  { name: "Approved", final: false, share: 1 },
  { name: "In dev", final: true, share: 2 },
  { name: "Ready for release", final: true, share: 3 },
  { name: "Done", final: true, share: 57 },
  { name: "Paused", final: false, share: 1 },
];

const REPOSITORIES = ["api", "web", "billing", "gateway", "docs"];

const slug = (text: string) => text.toLowerCase().replaceAll(" ", "-");

// statusOf is the status of card i: the shares laid over the numbers of the cards.
function statusOf(i: number): (typeof STATUSES)[number] {
  let point = i % 100;
  for (const status of STATUSES) {
    if (point < status.share) {
      return status;
    }
    point -= status.share;
  }
  return STATUSES[0] as (typeof STATUSES)[number];
}

// EPIC_EVERY is how many cards go by between two epics: 167 epics in 2,000 cards, as 10 in 120.
const EPIC_EVERY = 12;

// card is card i of the board: an epic, a card under one, or a plain one, with a dependency, or a
// task, in the proportion of the real board.
function card(i: number, readAt: string): BoardCard {
  const status = statusOf(i);
  const repository = `acme/${REPOSITORIES[i % REPOSITORIES.length]}`;
  const isEpic = i % EPIC_EVERY === 0;
  const epicNumber = Math.floor(i / EPIC_EVERY) * EPIC_EVERY;
  const underEpic = !isEpic && i % 3 === 1 && epicNumber > 0;
  const open = !status.final;
  const dependsOn = open && i % 60 === 7 ? i - 1 : null;
  const hasTask = open && i % 30 === 5;
  const url = (number: number) => `https://github.com/${repository}/issues/${number}`;
  const dependency = (number: number): CardDependency => ({
    key: `${repository}#${number}`,
    repository,
    number,
    title: `Card ${number} of the large board`,
    url: url(number),
    state: "open",
    status: "Backlog",
    onBoard: true,
    pullRequests: [],
    satisfied: false,
  });
  return {
    key: `${repository}#${i}`,
    repository,
    number: i,
    title: isEpic ? `Epic ${i} of the large board` : `Card ${i} of the large board`,
    url: url(i),
    state: open ? "open" : "closed",
    body: `The body of card ${i}.`,
    statusId: slug(status.name),
    status: status.name,
    final: status.final,
    assignees: i % 4 === 0 ? [] : [{ login: `person${i % 5}`, avatarUrl: "" }],
    fields: [{ name: "Module", value: `Module ${i % 8}` }],
    pullRequests: [],
    epic: underEpic
      ? {
          key: `${repository}#${epicNumber}`,
          repository,
          number: epicNumber,
          title: `Epic ${epicNumber} of the large board`,
          url: url(epicNumber),
          state: "open",
        }
      : null,
    epicBody: "",
    siblings: [],
    dependencies: dependsOn === null ? [] : [dependency(dependsOn)],
    readAt,
    suggestedName: `${i}-card`,
    repositoryId: `repo-${REPOSITORIES[i % REPOSITORIES.length]}`,
    activeTaskId: hasTask ? `task-${i}` : "",
    archivedTaskId: "",
    archivedTaskName: "",
    action: hasTask ? "has_task" : open ? "start" : "closed",
    otherBoard: "",
    writtenBy: null,
  };
}

// task is the task of a card, at the step and the wait the row of a card tells.
function task(of: BoardCard): TaskSummary {
  return {
    id: of.activeTaskId,
    name: `card-${of.number}`,
    repositoryId: of.repositoryId,
    repository: of.repository,
    card: {
      boardId: BOARD_ID,
      key: of.key,
      repository: of.repository,
      number: of.number,
      title: of.title,
      url: of.url,
      status: of.status,
      state: of.state,
      epic: of.epic,
    },
    mode: "structured",
    stage: "prd",
    revisiting: false,
    reviewMode: "manual",
    reviewModeEditable: true,
    sessionStatus: "waiting",
    sessionModel: "claude-opus-5-5[1m]",
    sessionEffort: "high",
    turnRunning: false,
    processRunning: false,
    retryAttempt: 0,
    retryMax: 0,
    retryAt: "",
    retryReason: "",
    turnFailed: false,
    turnStartedAt: "",
    pausedAt: "",
    actionLabel: "",
    actionTarget: "",
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
    models: [],
    conversations: [],
    branch: "",
    baseBranch: "",
    worktreePath: "",
    canContinue: false,
    artifactVersion: 0,
    lastError: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// repository is a repository of the board, cloned.
function repository(name: string): Repository {
  return {
    id: `repo-${name}`,
    owner: "acme",
    name,
    fullName: `acme/${name}`,
    path: `/home/dev/code/${name}`,
    missing: false,
    activeTasks: 0,
    archivedTasks: 0,
    cloned: true,
    boardId: BOARD_ID,
    cloning: false,
    cloneError: "",
    reviewInstructions: "",
    activeReviews: 0,
    archivedReviews: 0,
    archivedDiscussions: 0,
  };
}

// largeBoardState is the state the large board lives in: the board, its repositories and the tasks of its cards.
export function largeBoardState(): State {
  const readAt = new Date().toISOString();
  const cards = Array.from({ length: CARDS }, (_, index) => card(index + 1, readAt));
  const board: Board = {
    id: BOARD_ID,
    owner: "acme",
    ownerType: "organization",
    number: 7,
    title: "Platform Roadmap",
    url: "https://github.com/orgs/acme/projects/7",
    hasStatus: true,
    statuses: STATUSES.map(({ name, final }) => ({ id: slug(name), name, final })),
    repositoryIds: REPOSITORIES.map((name) => `repo-${name}`),
    readAt,
    reading: false,
    failure: null,
    viewer: "person0",
    cards,
    newCardStatus: "Backlog",
  };
  return {
    migration: null,
    repositories: REPOSITORIES.map(repository),
    repositoryFilter: "",
    theme: "system",
    systemDark: false,
    modelDefaults: [],
    modelFactory: [],
    modelCatalog: { models: [], failure: "" },
    reviewModeDefault: "manual",
    tasks: cards.filter((each) => each.activeTaskId !== "").map(task),
    history: [],
    boards: [board],
    reviewCenter: {
      pullRequests: [],
      failures: [],
      readAt: "",
      reading: false,
      filters: {
        boardId: "",
        repositoryId: "",
        authorsInclude: [],
        authorsExclude: [],
        labelsInclude: [],
        labelsExclude: [],
        boardName: "",
        repositoryName: "",
      },
      pendingCount: 0,
      authors: [],
      labels: [],
    },
    reviews: [],
    reviewHistory: [],
    discussions: [],
    discussionHistory: [],
    historySummary: { tasks: 0, reviews: 0, discussions: 0, oldest: "", windowStart: "" },
    cloneFolder: "",
  };
}
