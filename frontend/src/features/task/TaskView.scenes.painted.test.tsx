import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { TaskView } from "@/features/task/TaskView";
import { sessionKey } from "@/lib/wails";
import { fromTranscript } from "@/store/transcript";
import {
  capture,
  mainArea,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  resolve,
  setTheme,
  stepperText,
  THEMES,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { fixSceneClock, type SceneName, sceneTask, TASK_ID } from "@/test/task-scenes";
import { makeTranscript } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails. The
// mock is imported inside the factory, which runs before the imports of the file.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** SCENE_MAIN is the main area the scenes are drawn in, the one of the mock. */
const SCENE_MAIN = 1566;

// The nine scenes of the mock (design/screens/task.md §11): what the stepper shows, and its glyph.
const STEPPERS: [SceneName, string, string][] = [
  ["plan", "PRD ○ Tech spec ○ Plan ○ Implementation ○ PR ○ PR review ○ Closing", "wait"],
  [
    "run",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 3/7 · round 1 working ○ PR ○ PR review ○ Closing",
    "work",
  ],
  [
    "ask",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 3/7 · pass 2 ○ PR ○ PR review ○ Closing",
    "wait",
  ],
  [
    "error",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 3/7 · pass 2 ○ PR ○ PR review ○ Closing",
    "error",
  ],
  [
    "manual",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 4/7 · Manual ○ PR ○ PR review ○ Closing",
    "wait",
  ],
  ["blocked", "✓ PRD ✓ Tech spec ✓ Plan Implementation 5/7 ○ PR ○ PR review ○ Closing", "error"],
  [
    "checks",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review checks 3/5 ○ Closing",
    "github",
  ],
  ["findings", "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 ○ Closing", "wait"],
  ["close", "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR ✓ PR review Closing", "close"],
];

/** HALF_MAIN is the main area of a 1250px window, the narrowest the column is proved at. */
const HALF_MAIN = 950;

// px is a length token in pixels.
const px = (name: `--${string}`) => parseFloat(resolve(`var(${name})`, "width"));

// scene draws the task screen at a moment of the reference task, in the main area of the mock.
function scene(
  name: SceneName,
  { width = SCENE_MAIN, earlier = null }: { width?: number; earlier?: string | null } = {},
) {
  const { state, transcripts, openStepTab } = sceneTask(name);
  const { container } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <TaskView taskId={TASK_ID} />
    </div>,
    {
      state,
      ui: {
        location: { kind: "task", id: TASK_ID },
        transcripts:
          earlier === null
            ? transcripts
            : {
                ...transcripts,
                [sessionKey(TASK_ID, earlier)]: fromTranscript(
                  makeTranscript({ taskId: TASK_ID, stage: earlier }),
                ),
              },
        openStepTab,
        earlierConversation:
          earlier === null ? null : { taskId: TASK_ID, stage: earlier, from: "panel" },
      },
    },
  );
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return { area, band: screen.getByRole("banner") };
}

// barAndComposer are the bar of the request and the box of the composer, the ones the scene has.
function barAndComposer(): HTMLElement[] {
  const bar = document.querySelector<HTMLElement>('section[aria-label="Request"]');
  const composer =
    document
      .getElementById("composer-input")
      ?.closest<HTMLElement>('[class~="max-w-(--measure-conversation)"]') ?? null;
  return [bar, composer].filter((piece) => piece !== null);
}

/**
 * captureTogether saves one screenshot of pieces that stand one over the other: whatever else their
 * common container holds leaves the flow first, and the container takes only their height. The
 * screen is drawn again for the next test, so nothing is put back.
 */
async function captureTogether(name: string, pieces: readonly HTMLElement[]): Promise<void> {
  let common = pieces[0]?.parentElement ?? null;
  while (common !== null && !pieces.every((piece) => common?.contains(piece))) {
    common = common.parentElement;
  }
  if (common === null) {
    throw new Error("the pieces share no container");
  }
  for (const child of common.children) {
    if (child instanceof HTMLElement && !pieces.some((piece) => child.contains(piece))) {
      child.style.display = "none";
    }
  }
  common.style.flex = "none";
  await capture(name, common);
}

// The scenes are drawn at the moment of the mock, whatever the day the suite runs.
fixSceneClock();

describe.each(THEMES)("TaskView, the nine scenes in the %s theme", (theme) => {
  it.each(STEPPERS)("draws the %s scene", async (name, text, glyph) => {
    setTheme(theme);
    const { area, band } = scene(name);

    expect(placeHeaderOneLine(band)).toBe(true);
    expect(overlaps(placeHeaderPieces(band))).toBe(false);
    const stepper = within(band).getByRole("list", { name: /^Progress/ });
    expect(stepperText(stepper)).toBe(text);
    const pill = within(stepper).getByRole("listitem", { current: "step" });
    expect(pill.querySelector("[data-state]")).toHaveAttribute("data-state", glyph);
    await capture(`scene-${name}-${theme}`, area);
  });

  it.each(STEPPERS.map(([name]) => name))(
    "captures the bar and the composer of the %s scene",
    async (name) => {
      setTheme(theme);
      scene(name);

      // Waiting for its checks, the pull request asks nothing and has no conversation to write in.
      const pieces = barAndComposer();
      expect(pieces.length === 0).toBe(name === "checks");
      if (pieces.length > 0) {
        await captureTogether(`bar-${name}-${theme}`, pieces);
      }
    },
  );

  it("draws the bar of the close scene inside the main area", () => {
    setTheme(theme);
    const { area } = scene("close");

    const bar = screen.getByRole("region", { name: "Request" });
    const inner = bar.getBoundingClientRect();
    const outer = area.getBoundingClientRect();
    expect(inner.height).toBeGreaterThan(0);
    expect(inner.left).toBeGreaterThanOrEqual(outer.left);
    expect(inner.right).toBeLessThanOrEqual(outer.right);
    expect(inner.bottom).toBeLessThanOrEqual(outer.bottom);
  });

  // The column is the main area less --space-6 on each side, for the tabs, the bar and the foot.
  it("keeps the bar in the column of the tabs at the main area of a 1250px window", () => {
    setTheme(theme);
    const { area } = scene("manual", { width: HALF_MAIN });

    const bar = screen.getByRole("region", { name: "Request" }).getBoundingClientRect();
    const outer = area.getBoundingClientRect();
    expect(bar.left - outer.left).toBe(px("--space-6"));
    expect(outer.right - bar.right).toBe(px("--space-6"));
  });

  it("keeps the strip of an earlier conversation in the column at the main area of a 1250px window", () => {
    setTheme(theme);
    const { area } = scene("close", { width: HALF_MAIN, earlier: "prd" });

    const back = screen.getByRole("button", { name: /^Back to/ });
    const strip = back.closest("p")?.parentElement ?? back.parentElement;
    if (!(strip instanceof HTMLElement)) {
      throw new Error("the strip is not drawn");
    }
    const box = strip.getBoundingClientRect();
    const outer = area.getBoundingClientRect();
    expect(box.left - outer.left).toBe(px("--space-6"));
    expect(outer.right - box.right).toBe(px("--space-6"));
  });

  it("keeps every item of the ⋯ of the run scene on one line", async () => {
    setTheme(theme);
    scene("run", { width: HALF_MAIN });

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      // offsetHeight is the height of the layout, before the scale the menu opens with.
      expect(item.offsetHeight).toBe(px("--size-control"));
    }
    for (const label of menu.querySelectorAll('[data-slot="dropdown-menu-label"]')) {
      if (!(label instanceof HTMLElement)) {
        throw new Error("a legend of the menu is not an element");
      }
      const style = getComputedStyle(label);
      expect(label.offsetHeight).toBe(
        parseFloat(style.lineHeight) +
          parseFloat(style.paddingTop) +
          parseFloat(style.paddingBottom),
      );
    }
  });
});
