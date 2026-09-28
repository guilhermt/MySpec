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
import { type Scene, TASK_ID, taskInLoop, taskInPRReview } from "@/test/task-scenes";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails. The
// mock is imported inside the factory, which runs before the imports of the file.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** FIXTURES are the two tasks the widths are proved on: a step in the loop and a PR waiting for its checks. */
const FIXTURES = { loop: taskInLoop, "pr-review": taskInPRReview } as const;

/** MAIN_WIDTHS are the main areas the header is proved at, from a 1100px window to a wide monitor. */
const MAIN_WIDTHS = [812, 950, 996, 1134, 1566, 2180];

/** STEPPER_AT_HALF is what the stepper shows at 950 and 996px of main area, half a monitor. */
const STEPPER_AT_HALF: Record<keyof typeof FIXTURES, string> = {
  loop: "✓ ✓ ✓ Implementation 3/7 ○ PR ○ PR review ○ Closing",
  "pr-review": "✓ ✓ ✓ ✓ ✓ PR review ○ Closing",
};

// view draws the task screen inside a main area of a fixed width, the container its queries measure.
function view(scene: Scene, width: number) {
  const { state, transcripts, openStepTab } = scene;
  const { container } = renderWithStore(
    <div style={{ ...mainArea(width), height: "720px", display: "flex" }}>
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

describe.each(THEMES)("TaskView in the %s theme", (theme) => {
  describe.each(Object.keys(FIXTURES) as (keyof typeof FIXTURES)[])("with the %s task", (name) => {
    it.each(MAIN_WIDTHS)("keeps the header on one line at %ipx of main area", async (width) => {
      setTheme(theme);
      const { area, band } = view(FIXTURES[name](), width);

      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);
      // The reference name fits every width: the title cuts only when it has to.
      const title = within(band).getByRole("heading", { level: 1 });
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
      await capture(`widths-${name}-${width}-${theme}`, area);
    });

    it.each([950, 996])("names the current stage and the ones to come at %ipx", (width) => {
      setTheme(theme);
      const { band } = view(FIXTURES[name](), width);

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
      const { area, band } = view(FIXTURES[name]({ longName: true }), 812);

      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);
      const title = within(band).getByRole("heading", { level: 1 });
      expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
      expect(title.getBoundingClientRect().width).toBeGreaterThanOrEqual(200);
      await capture(`widths-${name}-long-812-${theme}`, area);
    });
  });
});
