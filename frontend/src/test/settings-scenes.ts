/**
 * The scenes of Settings (design/lab/14-screen-rest): the acme world of the board scenes with the
 * volume of the real database, 3 boards, 12 repositories, 9 models with 6 changed from the factory and
 * 9 prompts, at the same moment as the other scenes. The data is the one of the mock
 * (design/lab/14-screen-rest/src/data.js), with the corrections of the material of the task: Mobile App
 * is read at 11:30, and Internal Tools yesterday at noon. The scene tests draw the screens from them.
 */

import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, vi } from "vitest";
import type { Location, SettingsSection } from "@/lib/locations";
import type {
  Board,
  BoardPreview,
  BoardRepositoryOption,
  Machine,
  Prompt,
  PromptListing,
  Repository,
  RepositoryCandidate,
  StageModel,
  Startup,
  State,
} from "@/lib/wails";
import { MOBILE_ID, PLATFORM_ID, SCENE_NOW, TOOLS_ID } from "@/test/board-scenes";
import {
  api,
  makeArchivedTask,
  makeBoard,
  makeBoardPreview,
  makeBoardRemoval,
  makeBoardRepositoryOption,
  makeMachine,
  makeMigration,
  makeModelCatalog,
  makeModelDefaults,
  makePrompt,
  makePromptListings,
  makeRepository,
  makeStartup,
  makeStartupFailure,
  makeStartupStep,
  makeState,
} from "@/test/wails-mock";

/** SETTINGS_SCENES are the four pages of Settings. */
export const SETTINGS_SCENES = [
  "settings-defaults",
  "settings-boards",
  "settings-repos",
  "settings-prompts",
] as const;

/** SettingsSceneName is one page of Settings. */
export type SettingsSceneName = (typeof SETTINGS_SCENES)[number];

/** SETTINGS_VARIATIONS are the moments of each page, "" being the page at rest. */
export const SETTINGS_VARIATIONS: Record<SettingsSceneName, readonly string[]> = {
  "settings-defaults": ["", "list", "saving", "reading", "failed"],
  "settings-boards": [
    "",
    "add-1",
    "add-1-reading",
    "add-1-error",
    "add-2",
    "add-3",
    "add-nostatus",
    "edit-reading",
    "edit-1",
    "edit-2",
    "remove",
    "empty",
    "edit-failed",
    "remove-failed",
  ],
  "settings-repos": [
    "",
    "add",
    "add-scanning",
    "add-refused",
    "instructions",
    "menu",
    "change-path",
    "remove",
    "empty",
    "add-failed",
  ],
  "settings-prompts": ["", "view", "edit", "reset", "discard", "list-failed", "view-failed"],
};

/** SettingsSceneSetup is what a test needs to draw a scene: the state, the place, and what the user did. */
export interface SettingsSceneSetup {
  state: State;
  location: Location;
  /** storage is what the screens remember in localStorage, by key. */
  storage: Record<string, string>;
  /** startup is the start of the app, for the scenes of the start. */
  startup?: Startup;
  /** machine is what the check of the machine answers. */
  machine?: Machine;
  /** listings is what the list of prompts answers: the failure of its reading when it is an error. */
  listings?: PromptListing[] | Error;
  /** prompt is what the reading of the prompt of the page answers: the failure of its reading when it is an error. */
  prompt?: Prompt | Error;
  /** after is what the test does once the screen is drawn, to reach the state of the scene. */
  after?: (user: UserEvent) => Promise<void>;
}

/**
 * fixSettingsSceneClock stops the clock of the page at SCENE_NOW for the test that runs next, and
 * gives it back after; only Date is faked, so the timers of the page still run.
 */
export function fixSettingsSceneClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(SCENE_NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
}

const HOME = "/home/guilherme";

// at is a moment minutes before SCENE_NOW.
const at = (minutes: number) => new Date(Date.parse(SCENE_NOW) - minutes * 60_000).toISOString();

// local is a moment of the scene's day, written in the zone of the page like SCENE_NOW.
const local = (moment: string) => new Date(moment).toISOString();

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------- Boards and repositories ----------------

interface SceneBoard {
  id: string;
  title: string;
  owner: string;
  ownerType: "organization" | "user";
  number: number;
  statuses: { name: string; final?: boolean }[];
  fresh: string;
  readAt: string;
  failure?: { message: string; failedAt: string };
}

const BOARDS: SceneBoard[] = [
  {
    id: TOOLS_ID,
    title: "Internal Tools",
    owner: "acme",
    ownerType: "organization",
    number: 12,
    statuses: [{ name: "Backlog" }, { name: "In progress" }, { name: "Done", final: true }],
    fresh: "backlog",
    readAt: local("2026-09-23T12:00:00"),
  },
  {
    id: MOBILE_ID,
    title: "Mobile App",
    owner: "gmartins",
    ownerType: "user",
    number: 3,
    statuses: [{ name: "Todo" }, { name: "Doing" }, { name: "Shipped", final: true }],
    fresh: "",
    readAt: local("2026-09-24T11:30:00"),
    failure: { message: "GitHub's rate limit was reached. It resets at 14:32.", failedAt: at(18) },
  },
  {
    id: PLATFORM_ID,
    title: "Platform Roadmap",
    owner: "acme",
    ownerType: "organization",
    number: 7,
    statuses: [
      { name: "Backlog" },
      { name: "In progress" },
      { name: "Done", final: true },
      { name: "Won't do", final: true },
      { name: "Duplicate", final: true },
    ],
    fresh: "",
    readAt: at(2),
  },
];

const boardOf = (board: SceneBoard, repositoryIds: string[]): Board =>
  makeBoard({
    id: board.id,
    owner: board.owner,
    ownerType: board.ownerType,
    number: board.number,
    title: board.title,
    url: `https://github.com/${board.ownerType === "user" ? "users" : "orgs"}/${board.owner}/projects/${board.number}`,
    statuses: board.statuses.map(({ name, final }) => ({
      id: slug(name),
      name,
      final: final === true,
    })),
    repositoryIds,
    readAt: board.readAt,
    failure:
      board.failure === undefined
        ? null
        : {
            reason: "rate_limited",
            message: board.failure.message,
            failedAt: board.failure.failedAt,
          },
    newCardStatus: board.fresh,
  });

interface SceneRepository {
  fullName: string;
  board: string;
  /** path is where the clone is, null when there is none. */
  path: string | null;
  missing?: boolean;
  active: number;
  activeReviews?: number;
}

const REPOSITORIES: SceneRepository[] = [
  { fullName: "acme/api", board: PLATFORM_ID, path: "code/api", active: 4 },
  { fullName: "acme/billing", board: PLATFORM_ID, path: null, active: 0 },
  { fullName: "acme/docs", board: PLATFORM_ID, path: "code/docs", active: 0 },
  { fullName: "acme/gateway", board: PLATFORM_ID, path: "code/gateway", active: 0 },
  { fullName: "acme/sdk-js", board: PLATFORM_ID, path: "src/sdk-js", active: 0 },
  { fullName: "acme/web", board: PLATFORM_ID, path: "code/web", active: 0, activeReviews: 1 },
  { fullName: "acme/android", board: MOBILE_ID, path: null, active: 0 },
  { fullName: "acme/ios", board: MOBILE_ID, path: "code/ios", active: 3, activeReviews: 1 },
  { fullName: "acme/admin", board: TOOLS_ID, path: "code/admin", active: 0 },
  { fullName: "acme/status-page", board: TOOLS_ID, path: "code/status-page", active: 0 },
  { fullName: "acme/tools", board: TOOLS_ID, path: "code/tools", active: 0 },
  { fullName: "acme/infra", board: "", path: "code/infra", missing: true, active: 1 },
];

/**
 * ARCHIVED are the tasks, One-Shots and reviews the History of the mock holds that belong to a
 * repository, by kind (t task, o One-Shot, r review) and where they ran; the counts of the page come
 * from them, so the page and the History never disagree.
 */
const ARCHIVED: readonly (readonly [kind: "t" | "o" | "r", where: string])[] = [
  ["t", "api#398"],
  ["r", "gateway#88"],
  ["o", "web#2279"],
  ["t", "gateway#84"],
  ["r", "web#2291"],
  ["o", "api"],
  ["r", "admin#77"],
  ["t", "api#415"],
  ["t", "ios#91"],
  ["r", "api#1266"],
  ["o", "web"],
  ["t", "web#2260"],
  ["r", "gateway#86"],
  ["o", "web"],
  ["t", "gateway#79"],
  ["t", "api#463"],
  ["r", "ios#312"],
  ["r", "web#2240"],
  ["o", "web"],
  ["t", "api#441"],
  ["r", "tools#31"],
  ["t", "web#2244"],
  ["r", "gateway#81"],
  ["o", "sdk-js"],
  ["t", "web#2236"],
  ["r", "sdk-js#41"],
  ["t", "infra#12"],
  ["t", "web#2231"],
  ["r", "web#2250"],
  ["o", "api"],
  ["t", "admin#70"],
  ["r", "status-page#19"],
  ["t", "api#470"],
  ["o", "gateway"],
];

const repositoryId = (fullName: string) => `repo-${fullName.split("/")[1]}`;

const repositoryOf = (entry: SceneRepository): Repository => {
  const [owner = "", name = ""] = entry.fullName.split("/");
  const mine = ARCHIVED.filter(([, where]) => where === name || where.startsWith(`${name}#`));
  return makeRepository({
    id: repositoryId(entry.fullName),
    owner,
    name,
    fullName: entry.fullName,
    path: entry.path === null ? "" : `${HOME}/${entry.path}`,
    cloned: entry.path !== null,
    missing: entry.missing === true,
    activeTasks: entry.active,
    archivedTasks: mine.filter(([kind]) => kind !== "r").length,
    activeReviews: entry.activeReviews ?? 0,
    archivedReviews: mine.filter(([kind]) => kind === "r").length,
    boardId: entry.board,
  });
};

// ---------------- Models ----------------

const OPUS = "claude-opus-5-5[1m]";
const FABLE = "claude-fable-5-1";

/** CURRENT are the defaults of the scene: 6 of the 9 stages changed from the factory. */
const CURRENT: Record<string, { model: string; effort: string }> = {
  prd: { model: OPUS, effort: "xhigh" },
  tech_spec: { model: OPUS, effort: "xhigh" },
  plan: { model: OPUS, effort: "medium" },
  one_shot: { model: OPUS, effort: "xhigh" },
  implementation: { model: OPUS, effort: "medium" },
  step_review: { model: OPUS, effort: "high" },
  pr: { model: OPUS, effort: "medium" },
  pr_review: { model: FABLE, effort: "high" },
  discussion: { model: FABLE, effort: "high" },
};

const modelDefaults = (): StageModel[] =>
  makeModelDefaults().map((factory) => ({ ...factory, ...CURRENT[factory.stage] }));

// ---------------- Prompts ----------------

/** PRD_TEXT is the PRD prompt as the user edited it. */
const PRD_TEXT = `# PRD of {{task_name}}

You write the product requirements of **{{task_name}}** with the user, one question at a time, and save them to {{prd_path}}. Everything the task produces lives in {{artifacts_dir}}.

## Where you start

{{initial_context}}

The context above may already answer most of what you need: a card with its epic, its siblings and its dependencies, or a detailed description. Treat it as the main source of the what and the why. Don't ask what it already answers; ask only about the real gaps.

## How you talk

- One question per turn, with two to four options and the trade-off of each.
- Say what you understood before you write, and wait for the user's OK.
- Never propose the solution: the tech spec does that.

## What the PRD has

- Context, problem, goals and what is out of scope.
- The acceptance criteria, each one testable.

## Tone

- Write in the language of the card.
- Keep each acceptance criterion to one line.
`;

const PRD_EDITED_AT = local("2026-09-20T16:20:00");

const editedPrd = (): Prompt =>
  makePrompt({
    stage: "prd",
    text: PRD_TEXT,
    modified: true,
    placeholders: ["{{task_name}}", "{{artifacts_dir}}", "{{prd_path}}", "{{initial_context}}"],
    editedAt: PRD_EDITED_AT,
    lines: 92,
    defaultLines: 87,
  });

const listings = (): PromptListing[] =>
  makePromptListings().map((entry) =>
    entry.stage === "prd" ? { ...entry, modified: true, editedAt: PRD_EDITED_AT } : entry,
  );

// ---------------- The state ----------------

const sceneState = (overrides: Partial<State> = {}): State =>
  makeState({
    repositories: REPOSITORIES.map(repositoryOf),
    boards: BOARDS.map((board) =>
      boardOf(
        board,
        REPOSITORIES.filter((entry) => entry.board === board.id).map((entry) =>
          repositoryId(entry.fullName),
        ),
      ),
    ),
    modelDefaults: modelDefaults(),
    modelFactory: makeModelDefaults(),
    modelCatalog: makeModelCatalog(),
    reviewModeDefault: "agent",
    cloneFolder: "",
    ...overrides,
  });

const settingsAt = (section: SettingsSection): Location => ({
  kind: "settings",
  section,
});

// ---------------- What the user does ----------------

/** forever is an answer that never comes. */
const forever = <T>() => new Promise<T>(() => {});

const button = (name: string | RegExp) => screen.getByRole("button", { name });

/** reachBoard fills the URL of a board and reads it. */
async function readBoard(user: UserEvent) {
  await user.type(
    screen.getByRole("textbox", { name: "URL of the GitHub project" }),
    "https://github.com/orgs/acme/projects/15",
  );
  await user.click(button(/^Continue/));
}

const option = (
  fullName: string,
  cards: number,
  overrides: Partial<BoardRepositoryOption> = {},
): BoardRepositoryOption => {
  const [owner = "", name = ""] = fullName.split("/");
  return makeBoardRepositoryOption({
    owner,
    name,
    fullName,
    cards,
    repositoryId: repositoryId(fullName),
    path: `${HOME}/code/${name}`,
    ...overrides,
  });
};

/** newBoard is the project the add dialog reads: Data Platform, with its statuses and its repositories. */
const newBoard = (overrides: Partial<BoardPreview> = {}): BoardPreview =>
  makeBoardPreview({
    url: "https://github.com/orgs/acme/projects/15",
    owner: "acme",
    number: 15,
    title: "Data Platform",
    statuses: [
      { id: "inbox", name: "Inbox", final: false },
      { id: "to-do", name: "To do", final: false },
      { id: "doing", name: "Doing", final: false },
      { id: "review", name: "Review", final: false },
      { id: "done", name: "Done", final: true },
      { id: "canceled", name: "Canceled", final: false },
    ],
    repositories: [
      option("acme/data-pipelines", 38, {
        link: "clone",
        repositoryId: "",
        path: `${HOME}/code/data-pipelines`,
      }),
      option("acme/warehouse", 21, {
        link: "clone",
        repositoryId: "",
        path: `${HOME}/code/warehouse`,
        clones: [`${HOME}/code/warehouse`, `${HOME}/src/warehouse-old`],
      }),
      option("acme/dbt-models", 9, { link: "uncloned", path: "" }),
      option("acme/api", 4, {
        link: "other_board",
        checked: false,
        otherBoard: "Platform Roadmap",
      }),
    ],
    ...overrides,
  });

/** editedBoard is the board Platform Roadmap as the edit dialog reads it again, with a status gone and a new one. */
const editedBoard = (): BoardPreview =>
  makeBoardPreview({
    url: "https://github.com/orgs/acme/projects/7",
    owner: "acme",
    number: 7,
    title: "Platform Roadmap",
    statuses: [
      "Inbox",
      "Backlog",
      "Ready",
      "In progress",
      "In review",
      "QA",
      "Blocked",
      "Done",
      "Won't do",
      "Duplicate",
    ].map((name) => ({
      id: slug(name),
      name,
      final: ["Done", "Won't do", "Duplicate"].includes(name),
    })),
    goneStatuses: ["Archived"],
    newStatusIds: ["qa"],
    repositories: [
      option("acme/api", 48),
      option("acme/billing", 22, { link: "uncloned", path: "", release: "leave" }),
      option("acme/docs", 9, { release: "no_board" }),
      option("acme/gateway", 17),
      option("acme/sdk-js", 4, { path: `${HOME}/src/sdk-js` }),
      option("acme/web", 31),
      option("acme/marketing-site", 2, {
        checked: false,
        link: "clone",
        repositoryId: "",
        path: `${HOME}/code/marketing-site`,
      }),
      option("acme/ios", 1, { checked: false, link: "other_board", otherBoard: "Mobile App" }),
    ],
  });

const candidates = (): RepositoryCandidate[] => [
  {
    owner: "acme",
    name: "billing",
    fullName: "acme/billing",
    path: `${HOME}/src/billing`,
    registered: false,
  },
  {
    owner: "acme",
    name: "marketing-site",
    fullName: "acme/marketing-site",
    path: `${HOME}/code/marketing-site`,
    registered: false,
  },
  {
    owner: "gmartins",
    name: "dotfiles",
    fullName: "gmartins/dotfiles",
    path: `${HOME}/dotfiles`,
    registered: false,
  },
  {
    owner: "gmartins",
    name: "myspec",
    fullName: "gmartins/myspec",
    path: `${HOME}/pessoal/myspec`,
    registered: false,
  },
  ...REPOSITORIES.filter((entry) => entry.path !== null && entry.missing !== true).map(
    (entry): RepositoryCandidate => {
      const [owner = "", name = ""] = entry.fullName.split("/");
      return {
        owner,
        name,
        fullName: entry.fullName,
        path: `${HOME}/${entry.path}`,
        registered: true,
      };
    },
  ),
];

// ---------------- The scenes ----------------

function defaultsScene(variation: string): SettingsSceneSetup {
  const location = settingsAt("defaults");
  const base = { location, storage: {} };
  switch (variation) {
    case "":
      return { ...base, state: sceneState() };
    case "list":
      return {
        ...base,
        state: sceneState(),
        after: async (user) => {
          await user.click(
            button(
              "Plan: Opus 5.5 (1M) · medium, changed from the factory default Fable 5.1 · high",
            ),
          );
          await screen.findByRole("menu");
        },
      };
    case "saving":
      // The review mode and the Plan save without an answer, the Tech spec is refused for the disk,
      // and the Step review keeps a model the installed Claude Code no longer lists.
      return {
        ...base,
        state: sceneState({
          modelDefaults: modelDefaults().map((entry) =>
            entry.stage === "step_review" ? { ...entry, model: "claude-opus-4-1" } : entry,
          ),
        }),
        after: async (user) => {
          api.setReviewModeDefault.mockImplementation(() => forever<void>());
          api.setModelDefault.mockImplementation((stage) =>
            stage === "tech_spec"
              ? Promise.reject(
                  new Error(
                    "no space left on the disk of ~/.local/share/myspec. Free some space, then try again.",
                  ),
                )
              : forever<void>(),
          );
          await user.click(screen.getByRole("radio", { name: /^Manual/ }));
          await user.click(
            button(
              "Plan: Opus 5.5 (1M) · medium, changed from the factory default Fable 5.1 · high",
            ),
          );
          await user.click(await screen.findByRole("menuitemradio", { name: "high" }));
          await user.click(
            button(
              "Tech spec: Opus 5.5 (1M) · xhigh, changed from the factory default Fable 5.1 · high",
            ),
          );
          await user.click(await screen.findByRole("menuitemradio", { name: "high" }));
          await screen.findByRole("alert");
        },
      };
    case "reading":
      return { ...base, state: sceneState({ modelCatalog: makeModelCatalog({ models: [] }) }) };
    case "failed":
      return {
        ...base,
        state: sceneState({ modelCatalog: makeModelCatalog({ models: [], failure: "not_found" }) }),
        after: async (user) => {
          await user.click(
            button("PRD: Opus 5.5 (1M) · xhigh, changed from the factory default Fable 5.1 · high"),
          );
          await screen.findByRole("menu");
        },
      };
    default:
      throw new Error(`settings-defaults has no variation ${variation}`);
  }
}

function boardsScene(variation: string): SettingsSceneSetup {
  const base = { location: settingsAt("boards"), state: sceneState(), storage: {} };
  const platform = "Platform Roadmap";
  const edit = (user: UserEvent) => user.click(button(`Edit ${platform}`));
  const add = (user: UserEvent) => user.click(button("Add board"));
  switch (variation) {
    case "":
      return base;
    case "empty":
      return { ...base, state: sceneState({ boards: [] }) };
    case "add-1":
      return { ...base, after: add };
    case "add-1-reading":
      return {
        ...base,
        after: async (user) => {
          api.previewBoard.mockImplementation(() => forever<BoardPreview>());
          await add(user);
          await readBoard(user);
        },
      };
    case "add-1-error":
      return {
        ...base,
        after: async (user) => {
          api.previewBoard.mockRejectedValue(
            new Error(
              "The board doesn't exist or this account can't read it. Check the number, or run gh auth refresh -s read:project.",
            ),
          );
          await add(user);
          await readBoard(user);
          await screen.findByText(/^The board doesn't exist/);
        },
      };
    case "add-2":
    case "add-3":
    case "add-nostatus": {
      const nostatus = variation === "add-nostatus";
      return {
        ...base,
        after: async (user) => {
          api.previewBoard.mockResolvedValue(
            nostatus
              ? newBoard({
                  title: "Release Train",
                  hasStatus: false,
                  statuses: [],
                  repositories: [
                    option("acme/infra", 6, { link: "registered" }),
                    option("acme/release-notes", 3, {
                      link: "uncloned",
                      path: "",
                      repositoryId: "",
                    }),
                  ],
                })
              : newBoard(),
          );
          await add(user);
          await readBoard(user);
          if (variation === "add-3") {
            await user.click(await screen.findByRole("button", { name: /^Continue/ }));
          }
          await screen.findByRole("dialog");
        },
      };
    }
    case "edit-reading":
      return {
        ...base,
        after: async (user) => {
          api.previewEditBoard.mockImplementation(() => forever<BoardPreview>());
          await edit(user);
        },
      };
    case "edit-failed":
      return {
        ...base,
        after: async (user) => {
          api.previewEditBoard.mockRejectedValue(
            new Error("GitHub's rate limit was reached. It resets at 14:32."),
          );
          await edit(user);
          await screen.findByRole("alert");
        },
      };
    case "edit-1":
    case "edit-2":
      return {
        ...base,
        after: async (user) => {
          api.previewEditBoard.mockResolvedValue(editedBoard());
          await edit(user);
          await screen.findByRole("table");
          if (variation === "edit-2") {
            // The user unchecks the two repositories whose consequence the dialog says.
            await user.click(button(/^Continue/));
            await user.click(await screen.findByRole("checkbox", { name: /^acme\/billing/ }));
            await user.click(screen.getByRole("checkbox", { name: /^acme\/docs/ }));
          }
        },
      };
    case "remove":
    case "remove-failed":
      return {
        ...base,
        after: async (user) => {
          api.previewRemoveBoard.mockResolvedValue(
            makeBoardRemoval({
              toNoBoard: 5,
              removed: 1,
              toNoBoardNames: ["api", "docs", "gateway", "sdk-js", "web"],
              removedNames: ["billing"],
            }),
          );
          await user.click(button(`Remove ${platform}`));
          await screen.findByRole("alertdialog");
          await screen.findByText(/^To No board:/);
          if (variation === "remove-failed") {
            api.removeBoard.mockRejectedValue(new Error("database is locked"));
            await user.click(button("Remove board"));
            await screen.findByRole("alert");
          }
        },
      };
    default:
      throw new Error(`settings-boards has no variation ${variation}`);
  }
}

function repositoriesScene(variation: string): SettingsSceneSetup {
  const base = { location: settingsAt("repositories"), state: sceneState(), storage: {} };
  const more = (user: UserEvent, fullName: string) => user.click(button(`More for ${fullName}`));
  const addRepository = async (user: UserEvent) => {
    api.scanRepositories.mockResolvedValue(candidates());
    await user.click(button("Add repository"));
  };
  switch (variation) {
    case "":
      return base;
    case "empty":
      return { ...base, state: sceneState({ repositories: [] }) };
    case "add":
      return {
        ...base,
        after: async (user) => {
          await addRepository(user);
          await screen.findByRole("searchbox", { name: "Filter by name or path" });
        },
      };
    case "add-scanning":
      return {
        ...base,
        after: async (user) => {
          api.scanRepositories.mockImplementation(() => forever<RepositoryCandidate[]>());
          await user.click(button("Add repository"));
          await screen.findByRole("status");
        },
      };
    case "add-refused":
      return {
        ...base,
        after: async (user) => {
          await addRepository(user);
          await screen.findByRole("searchbox", { name: "Filter by name or path" });
          api.browseRepository.mockRejectedValue(
            new Error(`${HOME}/Downloads/site is not the root of a git repository.`),
          );
          await user.click(button("Browse…"));
          await screen.findByRole("alert");
        },
      };
    case "add-failed":
      return {
        ...base,
        after: async (user) => {
          await addRepository(user);
          await user.click(await screen.findByRole("checkbox", { name: /^acme\/billing/ }));
          await user.click(screen.getByRole("checkbox", { name: /^acme\/marketing-site/ }));
          api.addRepository
            .mockResolvedValueOnce()
            .mockRejectedValueOnce(
              new Error(
                `${HOME}/code/marketing-site is a clone of acme/site, not of acme/marketing-site.`,
              ),
            );
          await user.click(button("Add 2 repositories"));
          await screen.findAllByRole("alert");
        },
      };
    case "menu":
      return {
        ...base,
        after: async (user) => {
          await more(user, "acme/web");
          await screen.findByRole("menu");
        },
      };
    case "instructions":
      return {
        ...base,
        after: async (user) => {
          await more(user, "acme/web");
          await user.click(await screen.findByRole("menuitem", { name: /^Review instructions…/ }));
          await screen.findByRole("textbox", { name: "Review instructions" });
        },
      };
    case "change-path":
      return {
        ...base,
        after: async (user) => {
          api.changeRepositoryPath.mockRejectedValue(
            new Error(`${HOME}/code/infra-old is a clone of acme/terraform, not of acme/infra.`),
          );
          await user.click(button("Change path…"));
          await screen.findByRole("alert");
        },
      };
    case "remove":
      return {
        ...base,
        after: async (user) => {
          await more(user, "acme/docs");
          await user.click(await screen.findByRole("menuitem", { name: "Remove…" }));
          await screen.findByRole("alertdialog");
        },
      };
    default:
      throw new Error(`settings-repos has no variation ${variation}`);
  }
}

function promptsScene(variation: string): SettingsSceneSetup {
  const list = settingsAt("prompts");
  const prd = settingsAt("prd");
  const base = { state: sceneState(), storage: {}, listings: listings() };
  // The buttons of the page wait for the text of the prompt, with aria-disabled.
  const ready = async (name: string) => {
    await waitFor(() =>
      expect(screen.getByRole("button", { name })).not.toHaveAttribute("aria-disabled", "true"),
    );
    return screen.getByRole("button", { name });
  };
  const edit = async (user: UserEvent) => {
    await user.click(await ready("Edit"));
    await screen.findByRole("textbox", { name: "PRD prompt" });
  };
  switch (variation) {
    case "":
      return { ...base, location: list };
    case "list-failed":
      return {
        ...base,
        location: list,
        listings: new Error("database is locked"),
      };
    case "view":
      return { ...base, location: prd, prompt: editedPrd() };
    case "view-failed":
      return {
        ...base,
        location: prd,
        prompt: new Error("open prompts/prd.md: permission denied"),
      };
    case "edit":
      return { ...base, location: prd, prompt: editedPrd(), after: edit };
    case "reset":
      return {
        ...base,
        location: prd,
        prompt: editedPrd(),
        after: async (user) => {
          await user.click(await ready("Reset to default…"));
          await screen.findByRole("alertdialog");
        },
      };
    case "discard":
      return {
        ...base,
        location: prd,
        prompt: editedPrd(),
        after: async (user) => {
          await edit(user);
          await user.type(screen.getByRole("textbox", { name: "PRD prompt" }), "More. ");
          await user.click(screen.getByRole("button", { name: "Cancel" }));
          await waitFor(() => within(document.body).getByRole("alertdialog"));
        },
      };
    default:
      throw new Error(`settings-prompts has no variation ${variation}`);
  }
}

/**
 * settingsScene is the setup of a page of Settings at a moment ("" for the page at rest). The
 * variation's after is what the user does to reach it, and the test reads the answers of the
 * boundary from the setup (listings, prompt) before it draws.
 */
export function settingsScene(name: SettingsSceneName, variation: string): SettingsSceneSetup {
  switch (name) {
    case "settings-defaults":
      return defaultsScene(variation);
    case "settings-boards":
      return boardsScene(variation);
    case "settings-repos":
      return repositoriesScene(variation);
    case "settings-prompts":
      return promptsScene(variation);
  }
}

// ---------------- The start, the welcome and the migration ----------------

/** START_VARIATIONS are the moments of the start of the app, "" being the start that runs. */
export const START_VARIATIONS = ["", "slow", "failed", "disk-full"] as const;

/** WELCOME_VARIATIONS are the moments of the welcome, "" being the machine with nothing missing. */
export const WELCOME_VARIATIONS = ["", "no-login", "no-gh", "no-claude", "history"] as const;

/** SLOW_FOR is how long the step of the clones has been running in the slow start. */
const SLOW_FOR_MS = 12_000;

/** startScene is the start of the app at a moment: running, with the clones slow, or failed. */
export function startScene(variation: (typeof START_VARIATIONS)[number]): SettingsSceneSetup {
  const base = { state: makeState(), location: { kind: "home" } as Location, storage: {} };
  const data = makeStartupStep({ id: "data", state: "done" });
  const clones = (overrides: Partial<Parameters<typeof makeStartupStep>[0]>) =>
    makeStartupStep({ id: "clones", count: 12, ...overrides });
  switch (variation) {
    case "":
      return {
        ...base,
        startup: makeStartup({
          phase: "starting",
          steps: [data, clones({ state: "running", startedAt: at(0) })],
        }),
      };
    case "slow":
      return {
        ...base,
        startup: makeStartup({
          phase: "starting",
          steps: [
            data,
            clones({
              state: "running",
              startedAt: new Date(Date.parse(SCENE_NOW) - SLOW_FOR_MS).toISOString(),
              detail: `${HOME}/code/infra`,
            }),
          ],
        }),
      };
    case "failed":
    case "disk-full": {
      const full = variation === "disk-full";
      return {
        ...base,
        startup: makeStartup({
          phase: "failed",
          steps: [makeStartupStep({ id: "data", state: "failed" })],
          failure: makeStartupFailure({
            case: full ? "disk_full" : "permission",
            error: full
              ? `open ${HOME}/.local/share/myspec/myspec.db: no space left on device`
              : `open ${HOME}/.local/share/myspec/myspec.db: permission denied\nthe folder belongs to root (drwx------ root root)`,
            dataDir: `${HOME}/.local/share/myspec`,
            logPath: `${HOME}/.local/state/myspec/myspec.log`,
          }),
        }),
      };
    }
  }
}

/** welcomeScene is the welcome at a moment: nothing registered, with what the machine lacks. */
export function welcomeScene(variation: (typeof WELCOME_VARIATIONS)[number]): SettingsSceneSetup {
  const empty = (overrides: Partial<State> = {}) =>
    sceneState({
      repositories: [],
      boards: [],
      tasks: [],
      reviews: [],
      discussions: [],
      ...overrides,
    });
  const base = { state: empty(), location: { kind: "home" } as Location, storage: {} };
  switch (variation) {
    case "":
      return { ...base, machine: makeMachine() };
    case "no-login":
      return { ...base, machine: makeMachine({ gh: "signed_out" }) };
    case "no-gh":
      return { ...base, machine: makeMachine({ gh: "not_installed" }) };
    case "no-claude":
      return { ...base, machine: makeMachine({ claude: "not_found" }) };
    case "history":
      return {
        ...base,
        state: empty({
          history: [
            makeArchivedTask({
              id: "archived-1",
              name: "idempotency-keys",
              repository: "acme/api",
              archivedAt: at(60 * 24 * 3),
            }),
          ],
        }),
        machine: makeMachine(),
      };
  }
}

/** migrationScene is the refused migration: one case of each kind, with the tasks. */
export function migrationScene(): SettingsSceneSetup {
  return {
    state: makeState({
      migration: makeMigration({
        cases: [
          {
            kind: "root_task",
            repository: `${HOME}/work`,
            detail: "",
            tasks: [
              { name: "billing-export", workspace: `${HOME}/work`, path: "" },
              { name: "fix-ci-cache", workspace: `${HOME}/work`, path: "" },
            ],
          },
          {
            kind: "no_origin",
            repository: `${HOME}/work/legacy-portal`,
            detail: "The origin remote is not on GitHub: git@gitlab.com:acme/legacy-portal.git",
            tasks: [
              {
                name: "portal-sso",
                workspace: `${HOME}/work`,
                path: `${HOME}/work/legacy-portal`,
              },
            ],
          },
          {
            kind: "name_conflict",
            repository: "acme/api",
            detail: "",
            tasks: [
              { name: "rate-limit", workspace: `${HOME}/work`, path: `${HOME}/work/api` },
              { name: "rate-limit", workspace: `${HOME}/code`, path: `${HOME}/code/api` },
            ],
          },
        ],
      }),
    }),
    location: { kind: "home" },
    storage: {},
  };
}
