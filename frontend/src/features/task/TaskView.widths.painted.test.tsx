import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CONVERSATION_SCENES,
  type ConversationSceneName,
  conversationScene,
  fixConversationClock,
} from "@/test/conversation-scenes";
import {
  capture,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  setTheme,
  stepperText,
  THEMES,
  windowForMain,
} from "@/test/painted";
import {
  type FixedCardName,
  fixedCardScene,
  fixSceneClock,
  SCENES,
  type Scene,
  sceneTask,
  TASK_ID,
  taskInLoop,
  taskInPRReview,
} from "@/test/task-scenes";
import {
  atWindow,
  proveScene,
  RAIL_WINDOWS,
  renderShell,
  SWEEP_TIMEOUT,
  windowsIn,
} from "@/test/widths";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails. The
// mock is imported inside the factory, which runs before the imports of the file.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

// A scene rests the pointer on every text it cuts, one by one.
vi.setConfig({ testTimeout: SWEEP_TIMEOUT });

/** FIXTURES are the two tasks the header is proved on: a step in the loop and a PR waiting for its checks. */
const FIXTURES = { loop: taskInLoop, "pr-review": taskInPRReview } as const;

/** MAIN_WIDTHS are the main areas the header is proved at, from a 1100px window to a wide monitor. */
const MAIN_WIDTHS = [812, 950, 996, 1134, 1566, 2180];

/** STEPPER_AT_HALF is what the stepper shows at 950 and 996px of main area, half a monitor. */
const STEPPER_AT_HALF: Record<keyof typeof FIXTURES, string> = {
  loop: "✓ ✓ ✓ Implementation 3/7 ○ PR ○ PR review ○ Closing",
  "pr-review": "✓ ✓ ✓ ✓ ✓ PR review ○ Closing",
};

// view draws the shell in the window whose main area is as wide as asked, where the task screen is.
async function view(scene: Scene, width: number, rail = false) {
  await atWindow(windowForMain(width));
  return drawShell(scene, rail);
}

// drawShell draws the shell of the app at the task screen of a scene, in the window of the browser.
function drawShell({ state, transcripts, openStepTab }: Scene, rail = false) {
  const { main } = renderShell({
    state,
    ui: { location: { kind: "task", id: TASK_ID }, transcripts, openStepTab },
    rail,
  });
  return { main, band: screen.getByRole("banner") };
}

// The scenes are drawn at the moment of the mock, whatever the day the suite runs.
fixSceneClock();

describe.each(THEMES)("TaskView in the %s theme", (theme) => {
  describe.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])("with the %s task", (name) => {
    it.each(MAIN_WIDTHS)("keeps the header on one line at %ipx of main area", async (width) => {
      setTheme(theme);
      const { main, band } = await view(FIXTURES[name](), width);

      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);
      // The reference name fits every width: the title cuts only when it has to.
      const title = within(band).getByRole("heading", { level: 1 });
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
      await capture(`widths-${name}-${width}-${theme}`, main);
    });

    it.each([950, 996])("names the current stage and the ones to come at %ipx", async (width) => {
      setTheme(theme);
      const { band } = await view(FIXTURES[name](), width);

      const stepper = within(band).getByRole("list", { name: /^Progress/ });
      expect(stepperText(stepper)).toBe(STEPPER_AT_HALF[name]);
      const pill = within(stepper).getByRole("listitem", { current: "step" });
      expect(pill.querySelector("[data-state]")).toHaveAttribute(
        "data-state",
        name === "loop" ? "work" : "github",
      );
    });

    it("cuts the longest name last, leaving it at least 200px at 812px", async () => {
      setTheme(theme);
      const { main, band } = await view(FIXTURES[name]({ longName: true }), 812);

      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);
      const title = within(band).getByRole("heading", { level: 1 });
      expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
      expect(title.getBoundingClientRect().width).toBeGreaterThanOrEqual(200);
      await capture(`widths-${name}-long-812-${theme}`, main);
    });
  });
});

/** SWEPT are the scenes of the task screen the sweep draws: the moments of the task, of its fixed cards and of the conversation. */
const SWEPT: [string, () => Scene, () => void][] = [
  ...SCENES.map((name): [string, () => Scene, () => void] => [
    name,
    () => sceneTask(name),
    fixSceneClock,
  ]),
  ...(["draft", "checks-after-a-pass"] as const).map(
    (name: FixedCardName): [string, () => Scene, () => void] => [
      name,
      () => fixedCardScene(name),
      fixSceneClock,
    ],
  ),
  ...CONVERSATION_SCENES.flatMap((name: ConversationSceneName) =>
    (name === "ask" || name === "error" ? [undefined, "impl" as const] : [undefined]).map(
      (voice): [string, () => Scene, () => void] => [
        `conversation-${name}${voice === undefined ? "" : `-${voice}`}`,
        () => conversationScene(name, voice === undefined ? {} : { voice }),
        () => fixConversationClock(name),
      ],
    ),
  ),
];

/**
 * REFERENCE are the scenes whose captures go to the pull request: the implementer at work, the
 * question, the findings of the PR, the checks and the long conversation.
 */
const REFERENCE = ["run", "ask", "findings", "checks", "conversation-long"];

describe.each(THEMES)("The task screen in every window, in the %s theme", (theme) => {
  describe.each(SWEPT)("the %s scene", (name, sceneOf, fixClock) => {
    fixClock();

    it.each(windowsIn(theme, { reference: REFERENCE.includes(name) }))(
      "holds the checks of every screen at %ipx",
      async (window) => {
        setTheme(theme);
        await atWindow(window);
        const { main } = drawShell(sceneOf());

        expect(await proveScene(main)).toEqual({});
        if (REFERENCE.includes(name)) {
          await capture(`ref-task-${name}-${window}-${theme}`, main);
        }
      },
    );

    if (name === "run") {
      it.each(RAIL_WINDOWS)(
        "holds the checks of every screen at %ipx with the rail",
        async (window) => {
          setTheme(theme);
          await atWindow(window);
          const { main } = drawShell(sceneOf(), true);

          expect(await proveScene(main)).toEqual({});
          await capture(`ref-task-${name}-${window}-rail-${theme}`, main);
        },
      );
    }
  });
});
