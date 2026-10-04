/**
 * measure-board times the list of a board at the size that decides whether it is virtualized
 * (docs/product/features.md, Visão do board): 2,000 cards in ten statuses, with epics, dependencies
 * and tasks in the proportion of Platform Roadmap, every section expanded. It measures three things,
 * each once cold and five times warm: the first paint of BoardView, from before the render to the
 * frame after the commit with its layout; a key in the search, from the input to the frame with the
 * new list; and ↓ in the list, from the keydown to the frame after it. The targets are 300 ms, 50 ms
 * and 16 ms.
 *
 * A tool of the development build: main.tsx mounts it in place of the app only with ?measure=board
 * under the Vite dev server (task dev), and the production bundle never has it. The numbers go to
 * the console and to the page.
 */

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { boardViewKey } from "@/lib/ui-storage";
import {
  api,
  type Board,
  type BoardCard,
  type CardDependency,
  type Repository,
  type State,
  type TaskSummary,
} from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

/** CARDS is how many cards the measured board has. */
const CARDS = 2000;

/** WARM_RUNS is how many times each measure runs after the cold one. */
const WARM_RUNS = 5;

const BOARD_ID = "board-measure";

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
    title: `Card ${number} of the measured board`,
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
    title: isEpic ? `Epic ${i} of the measured board` : `Card ${i} of the measured board`,
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
          title: `Epic ${epicNumber} of the measured board`,
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

// The state the measured board lives in: the board, its repositories and the tasks of its cards.
function measuredState(): State {
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

// nextFrame is the time of the frame after now, with the layout of what was committed done.
function nextFrame(): Promise<number> {
  return new Promise((done) =>
    requestAnimationFrame(() => {
      void document.body.offsetHeight;
      done(performance.now());
    }),
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// ms rounds milliseconds to a tenth.
const ms = (value: number) => Number(value.toFixed(1));

// paint mounts the board and returns the milliseconds to the frame after its commit.
async function paint(root: Root): Promise<number> {
  const started = performance.now();
  flushSync(() => root.render(<BoardView boardId={BOARD_ID} />));
  return (await nextFrame()) - started;
}

// type writes a text in the search as the user does, and returns the milliseconds to the frame with
// the list it filtered.
async function type(search: HTMLInputElement, text: string): Promise<number> {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  const started = performance.now();
  setValue?.call(search, text);
  search.dispatchEvent(new Event("input", { bubbles: true }));
  return (await nextFrame()) - started;
}

// arrowDown presses ↓ on the row in focus, and returns the milliseconds to the frame after it.
async function arrowDown(row: HTMLElement): Promise<number> {
  const started = performance.now();
  row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  return (await nextFrame()) - started;
}

/** Measure is what one measure says: the cold run, and the median and the maximum of the warm ones. */
interface Measure {
  coldMs: number;
  medianMs: number;
  maxMs: number;
}

function measureOf(cold: number, warm: readonly number[]): Measure {
  return { coldMs: ms(cold), medianMs: ms(median(warm)), maxMs: ms(Math.max(...warm)) };
}

/** measureBoard mounts the measured board in the element and times it. */
export async function measureBoard(container: HTMLElement): Promise<void> {
  // The reading the view asks for on opening goes nowhere here: there is no runtime to ask.
  api.refreshBoard = () => Promise.resolve();
  document.documentElement.dataset.theme = "light";
  container.style.cssText =
    "container:main/inline-size;display:flex;flex-direction:column;width:1566px;height:900px";
  // Every section expanded, so every card is mounted.
  localStorage.setItem(
    boardViewKey(BOARD_ID),
    JSON.stringify({ filters: EMPTY_FILTERS, collapsed: [] }),
  );
  useAppStore.setState({ app: measuredState(), location: { kind: "board", id: BOARD_ID } });

  const root = createRoot(container);
  const coldPaint = await paint(root);
  const warmPaint: number[] = [];
  for (let run = 0; run < WARM_RUNS; run++) {
    flushSync(() => root.render(null));
    await nextFrame();
    warmPaint.push(await paint(root));
  }
  const mountedRows = container.querySelectorAll("[data-row-key]").length;

  const search = container.querySelector<HTMLInputElement>('[role="searchbox"]');
  if (search === null) {
    throw new Error("the search of the board is not drawn");
  }
  // One more character, from an empty search to the first letter, which keeps most of the cards.
  const keys: number[] = [];
  for (let run = 0; run <= WARM_RUNS; run++) {
    keys.push(await type(search, "c"));
    await type(search, "");
  }

  const firstRow = container.querySelector<HTMLElement>("[data-row-key]");
  if (firstRow === null) {
    throw new Error("the list of the board has no row");
  }
  firstRow.focus();
  const downs: number[] = [];
  for (let run = 0; run <= WARM_RUNS; run++) {
    const focused = document.activeElement;
    downs.push(await arrowDown(focused instanceof HTMLElement ? focused : firstRow));
  }

  const [coldKey, ...warmKeys] = keys;
  const [coldDown, ...warmDowns] = downs;
  const result = {
    cards: CARDS,
    mountedRows,
    firstPaint: measureOf(coldPaint, warmPaint),
    searchKey: measureOf(coldKey ?? 0, warmKeys),
    arrowDown: measureOf(coldDown ?? 0, warmDowns),
    targetsMs: { firstPaint: 300, searchKey: 50, arrowDown: 16 },
    userAgent: navigator.userAgent,
  };
  console.info("measure-board", result);
  const out = document.createElement("pre");
  out.id = "measure-board";
  out.textContent = JSON.stringify(result, null, 2);
  document.body.prepend(out);
}
