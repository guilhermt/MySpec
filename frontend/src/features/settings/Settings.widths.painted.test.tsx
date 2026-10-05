import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import { StartScreen } from "@/features/startup/StartScreen";
import { type GoneLocation, HOME as HOME_PLACE, type Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { api } from "@/lib/wails";
import { type Toast, useAppStore } from "@/store/app-store";
import {
  fixHistorySceneClock,
  HISTORY_SCENES,
  HISTORY_VARIANTS,
  type HistorySceneName,
  historyScene,
} from "@/test/history-scenes";
import { capture, setTheme, THEMES } from "@/test/painted";
import {
  fixSettingsSceneClock,
  migrationScene,
  newerScene,
  SETTINGS_SCENES,
  SETTINGS_VARIATIONS,
  type SettingsSceneName,
  START_VARIATIONS,
  settingsScene,
  startScene,
  WELCOME_VARIATIONS,
  welcomeScene,
} from "@/test/settings-scenes";
import { fixSceneClock, REFERENCE_NAME, sceneTask, TASK_ID } from "@/test/task-scenes";
import {
  makeDeletePreview,
  makeLeftover,
  makeSituation,
  makeTask,
  resetWailsMock,
} from "@/test/wails-mock";
import {
  atWindow,
  proveScene,
  renderPage,
  renderShell,
  SWEEP_TIMEOUT,
  WINDOWS,
} from "@/test/widths";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

// A scene rests the pointer on every text it cuts, one by one.
vi.setConfig({ testTimeout: SWEEP_TIMEOUT });

const HOME = "/home/guilherme";

afterEach(() => {
  // The scenes answer the boundary for good; the next one starts from the answers of the mock.
  for (const fn of Object.values(api)) {
    vi.mocked(fn).mockReset();
  }
  resetWailsMock();
});

/** Draw is a scene of this file: it draws the screen in the window of the browser and returns its main area. */
type Draw = () => Promise<HTMLElement>;

/** Group is a family of scenes, each with the way it is drawn. */
interface Group {
  title: string;
  /** reference is the scene whose captures go to the pull request. */
  reference?: string;
  /** fixClock fixes the clock the scenes of the group are read at. */
  fixClock: () => void;
  scenes: [name: string, draw: Draw][];
}

// settings draws a page of Settings at a moment.
const settings =
  (name: SettingsSceneName, variation: string): Draw =>
  async () => {
    const { state, location, storage, listings, prompt, after } = settingsScene(name, variation);
    for (const [key, value] of Object.entries(storage)) {
      localStorage.setItem(key, value);
    }
    if (listings instanceof Error) {
      vi.mocked(api.listPrompts).mockRejectedValue(listings);
    } else if (listings !== undefined) {
      vi.mocked(api.listPrompts).mockResolvedValue(listings);
    }
    if (prompt instanceof Error) {
      vi.mocked(api.getPrompt).mockRejectedValue(prompt);
    } else if (prompt !== undefined) {
      vi.mocked(api.getPrompt).mockResolvedValue(prompt);
    }
    const { main, user } = renderShell({ state, ui: { location } });
    await after?.(user);
    return main;
  };

// start draws the start of the app at a moment, the whole window.
const start =
  (variation: (typeof START_VARIATIONS)[number]): Draw =>
  async () => {
    const { startup } = startScene(variation);
    // A failure arrives after the start that was running, as it does in the app.
    const failed = startup?.phase === "failed";
    const { main } = renderPage(<StartScreen />, {
      startup: (failed ? startScene("").startup : startup) ?? null,
    });
    if (failed) {
      act(() => useAppStore.setState({ startup: startup ?? null }));
    }
    return main;
  };

// welcome draws the welcome at a moment.
const welcome =
  (variation: (typeof WELCOME_VARIATIONS)[number]): Draw =>
  async () => {
    const { state, location, machine } = welcomeScene(variation);
    if (machine !== undefined) {
      vi.mocked(api.checkMachine).mockResolvedValue(machine);
    }
    const { main } = renderShell({ state, ui: { location } });
    await screen.findByRole("heading", { level: 1, name: "Welcome to MySpec" });
    return main;
  };

// refused draws the page of a refused migration: the list of what can't be carried over, or the newer data.
const refused =
  (setup: typeof migrationScene): Draw =>
  async () => {
    const { state } = setup();
    if (state.migration === null) {
      throw new Error("the scene has no migration");
    }
    return renderPage(<MigrationRefused migration={state.migration} />).main;
  };

// history draws a place of the History at a variant.
const history =
  (name: HistorySceneName, variant: string): Draw =>
  async () => {
    const scene = historyScene(name, variant);
    const { main, user } = renderShell({
      state: scene.state,
      ui: { location: scene.location, back: scene.back },
    });
    await scene.after?.(user);
    return main;
  };

const GROUPS: Group[] = [
  {
    title: "Settings",
    reference: "settings-defaults",
    fixClock: fixSettingsSceneClock,
    scenes: SETTINGS_SCENES.flatMap((name) =>
      SETTINGS_VARIATIONS[name].map((variation): [string, Draw] => [
        `${name}${variation === "" ? "" : `-${variation}`}`,
        settings(name, variation),
      ]),
    ),
  },
  {
    title: "The start, the welcome and the refused migration",
    fixClock: fixSettingsSceneClock,
    scenes: [
      ...START_VARIATIONS.map((variation): [string, Draw] => [
        `start${variation === "" ? "" : `-${variation}`}`,
        start(variation),
      ]),
      ...WELCOME_VARIATIONS.map((variation): [string, Draw] => [
        `welcome${variation === "" ? "" : `-${variation}`}`,
        welcome(variation),
      ]),
      ["migration", refused(migrationScene)],
      ["newer", refused(newerScene)],
    ],
  },
];

describe.each(THEMES)(
  "Settings, the start, the welcome and the migration in every window, in the %s theme",
  (theme) => {
    describe.each(GROUPS)("$title", ({ fixClock, reference, scenes }) => {
      fixClock();

      describe.each(scenes)("the %s scene", (name, draw) => {
        it.each(WINDOWS)("holds the checks of every screen at %ipx", async (window) => {
          setTheme(theme);
          await atWindow(window);
          const main = await draw();

          expect(await proveScene(main)).toEqual({});
          if (name === reference || name === "newer" || name === "migration") {
            await capture(`ref-${name}-${window}-${theme}`, main);
          }
        });
      });
    });
  },
);

describe.each(THEMES)(
  "The History and the archived items in every window, in the %s theme",
  (theme) => {
    describe.each(
      HISTORY_SCENES.flatMap((name) =>
        HISTORY_VARIANTS[name].map((variant) => [name, variant] as const),
      ),
    )("the %s scene, variant “%s”", (name, variant) => {
      fixHistorySceneClock(historyScene(name, variant));

      it.each(WINDOWS)("holds the checks of every screen at %ipx", async (window) => {
        setTheme(theme);
        await atWindow(window);
        const main = await history(name, variant)();

        expect(await proveScene(main)).toEqual({});
        if (name === "history" && variant === "") {
          await capture(`ref-history-${window}-${theme}`, main);
        }
      });
    });
  },
);

// The task the dialogs of the task are drawn over: the reference task at its third step.
const WORKTREE = {
  path: `${HOME}/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key`,
  dirty: true,
  files: 3,
  error: "",
};
const BRANCH = { name: "rate-limit-per-api-key", merged: false, ahead: 9, error: "" };
const PR = { number: 1284, url: "https://github.com/acme/api/pull/1284", state: "open" };

/** DIALOGS are the dialogs of the task and the item of the ⋯ that opens each, over the run scene. */
const DIALOGS: [name: string, item: string, scene: () => ReturnType<typeof sceneTask>][] = [
  ["delete-task", "Delete task…", () => sceneTask("run")],
  ["discard-step", "Discard step 3…", () => sceneTask("run")],
  ["back-to-stage", "Back to Tech spec…", () => sceneTask("run")],
  ["delete-task-planning", "Delete task…", () => sceneTask("plan")],
];

describe.each(THEMES)("The dialogs of the task in every window, in the %s theme", (theme) => {
  describe.each(DIALOGS)("the %s scene", (name, item, sceneOf) => {
    fixSceneClock();

    it.each(WINDOWS)("holds the checks of every screen at %ipx", async (window) => {
      setTheme(theme);
      await atWindow(window);
      vi.mocked(api.previewDelete).mockResolvedValue(
        makeDeletePreview({ worktree: WORKTREE, branch: BRANCH, pr: PR }),
      );
      const { state, transcripts, openStepTab } = sceneOf();
      const { main, user } = renderShell({
        state,
        ui: {
          location: { kind: "task", id: TASK_ID },
          back: [{ kind: "board", id: "board-1" }],
          transcripts,
          openStepTab,
        },
      });
      await user.click(await screen.findByRole("button", { name: "More actions" }));
      await user.click(await screen.findByRole("menuitem", { name: item }));
      await screen.findByRole("alertdialog");
      await vi.waitFor(() => expect(screen.queryByText(/^Reading the worktree/)).toBeNull());

      expect(await proveScene(main)).toEqual({});
      void name;
    });
  });
});

// WAITING is the task another place needs the user in: what Next that needs you opens.
const WAITING = makeTask({
  id: "task-w",
  name: "Widget for today's tasks",
  situations: [makeSituation({ taskId: "task-w" })],
});

/** GONE are the pages of the items that left, with what the deletion left behind. */
const GONE: [string, GoneLocation, Record<string, ReturnType<typeof makeLeftover>>][] = [
  [
    "gone-task",
    { kind: "gone", item: "task", id: "task-x", name: REFERENCE_NAME, boardId: "board-platform" },
    {},
  ],
  [
    "gone-task-deleted",
    {
      kind: "gone",
      item: "task",
      id: "task-deleted",
      name: REFERENCE_NAME,
      boardId: "board-platform",
      pr: { number: 1284, state: "open" },
    },
    {
      "task-deleted": makeLeftover({
        repoPath: `${HOME}/code/api`,
        worktree: {
          path: `${HOME}/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key`,
          kept: true,
          error: "error: failed to delete: Permission denied",
          registered: false,
          locked: false,
        },
        branch: { name: "rate-limit-per-api-key", kept: false, error: "" },
      }),
    },
  ],
  [
    "gone-review",
    { kind: "gone", item: "review", id: "review-x", name: "web#2291", boardId: "" },
    {},
  ],
  [
    "gone-discussion",
    {
      kind: "gone",
      item: "discussion",
      id: "discussion-x",
      name: "Billing tiers",
      boardId: "board-platform",
    },
    {},
  ],
];

describe.each(THEMES)(
  "The pages that left, the notice and the toasts in every window, in the %s theme",
  (theme) => {
    describe.each(GONE)("the %s scene", (name, location, leftovers) => {
      fixHistorySceneClock(historyScene("archived-task"));

      it.each(WINDOWS)("holds the checks of every screen at %ipx", async (window) => {
        setTheme(theme);
        await atWindow(window);
        const { main } = renderShell({
          state: { ...historyScene("archived-task").state, tasks: [WAITING] },
          ui: { location, back: [HOME_PLACE], leftovers },
        });

        expect(await proveScene(main)).toEqual({});
        void name;
      });
    });

    describe.each(["notice", "toast", "toast-three"] as const)("the %s scene", (name) => {
      fixHistorySceneClock(historyScene("archived-task"));

      it.each(WINDOWS)("holds the checks of every screen at %ipx", async (window) => {
        setTheme(theme);
        await atWindow(window);
        const archived = historyScene("archived-task");
        const task = archived.state.history?.[0];
        const review = historyScene("archived-review").state.reviewHistory?.[0];
        const discussion = historyScene("archived-discussion").state.discussionHistory?.[0];
        const toasts: Toast[] = [
          ...(task === undefined ? [] : [{ id: task.id, kind: "task" as const, task }]),
          ...(review === undefined ? [] : [{ id: review.id, kind: "review" as const, review }]),
          ...(name === "toast-three" && discussion !== undefined
            ? [{ id: discussion.id, kind: "discussion" as const, discussion }]
            : []),
        ];
        const scene = sceneTask("run");
        const state: State = {
          ...scene.state,
          history: archived.state.history,
          reviewHistory: archived.state.reviewHistory,
          discussionHistory: archived.state.discussionHistory,
        };
        const location: Location = { kind: "task", id: TASK_ID };
        const { main } = renderShell({
          state,
          ui: {
            location,
            back: [HOME_PLACE],
            transcripts: scene.transcripts,
            openStepTab: scene.openStepTab,
            ...(name === "notice" ? {} : { toasts }),
          },
        });
        // The failure of an action arrives after the screen, as it does in the app.
        if (name === "notice") {
          act(() =>
            useAppStore.getState().setError({
              label: "Couldn't pause Rate limit per API key",
              detail:
                "The implementer's session didn't stop in 10 seconds, so it keeps running. Try Pause again, or Stop its answer from the Implementer tab.",
            }),
          );
        }

        expect(await proveScene(main)).toEqual({});
      });
    });
  },
);
