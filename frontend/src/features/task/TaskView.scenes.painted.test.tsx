import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import {
  capture,
  mainArea,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  setTheme,
  stepperText,
  THEMES,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { type SceneName, sceneTask, TASK_ID } from "@/test/task-scenes";

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

// scene draws the task screen at a moment of the reference task, in the main area of the mock.
function scene(name: SceneName) {
  const { state, transcripts, openStepTab } = sceneTask(name);
  const { container } = renderWithStore(
    <div style={{ ...mainArea(SCENE_MAIN), height: "800px", display: "flex" }}>
      <TaskView taskId={TASK_ID} />
    </div>,
    { state, ui: { location: { kind: "task", id: TASK_ID }, transcripts, openStepTab } },
  );
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return { area, band: screen.getByRole("banner") };
}

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
});
