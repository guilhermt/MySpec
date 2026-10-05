import { cleanup } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryView } from "@/features/history/HistoryView";
import type { ArchivedDiscussion, ArchivedReview, ArchivedTask } from "@/lib/wails";
import { mainArea, settle } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeHistorySummary,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The History with 400 archived items in the window, the size the 90 days are measured at
 * (docs/development/target-machine.md, A lista do History), against the History with 40, in the same
 * run: the first paint, from before the render to the frame after its commit, and ↓ in the list, from
 * the keydown to the frame after it, once cold and five times warm, the two sizes in turn. The targets,
 * 300 ms and no frame lost, are measured in the engine of the app by dev/measure-history.tsx, never
 * here. The test prints the numbers and holds the warm median of 400 to a ratio over the one of 40: the list is windowed, so 400 items cost about what 40 do, and a
 * list that stopped being windowed, or one with work that grows with the square of the rows, costs
 * ten times or a hundred.
 * A loaded runner slows both sizes alike, so the ratio does not depend on the machine.
 */
const ITEMS = 400;
const FEW_ITEMS = 40;
const WARM_RUNS = 5;
const RATIO_CEILING = 30;
// MOUNTED_CEILING is what the window of 800 px with its overscan mounts at the most.
const MOUNTED_CEILING = 100;
// TEST_TIMEOUT_MS holds the twelve runs on a loaded runner: they take 8 s alone and over 20 s beside the other browser tests.
const TEST_TIMEOUT_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 24, 12);

// archivedAt spreads the items over 90 days, the newest first.
const archivedAt = (i: number, items: number) =>
  new Date(NOW - Math.floor((i * 90 * DAY_MS) / items)).toISOString();

function scene(items: number) {
  const tasks: ArchivedTask[] = [];
  const reviews: ArchivedReview[] = [];
  const discussions: ArchivedDiscussion[] = [];
  for (let i = 0; i < items; i++) {
    const id = `item-${String(i).padStart(3, "0")}`;
    if (i % 20 < 12) {
      tasks.push(
        makeArchivedTask({
          id,
          name: `Task number ${i}`,
          mode: i % 5 === 0 ? "one_shot" : "structured",
          archivedAt: archivedAt(i, items),
        }),
      );
    } else if (i % 20 < 17) {
      reviews.push(
        makeArchivedReview({
          id,
          title: `Review number ${i}`,
          number: i,
          archivedAt: archivedAt(i, items),
        }),
      );
    } else {
      discussions.push(
        makeArchivedDiscussion({
          id,
          title: `Discussion number ${i}`,
          archivedAt: archivedAt(i, items),
        }),
      );
    }
  }
  return makeState({
    repositories: [makeRepository()],
    history: tasks,
    reviewHistory: reviews,
    discussionHistory: discussions,
    historySummary: makeHistorySummary({
      tasks: tasks.length,
      reviews: reviews.length,
      discussions: discussions.length,
      oldest: archivedAt(items - 1, items),
    }),
  });
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

const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

// draw mounts the History of a number of items in a main area of the whole monitor and returns the
// milliseconds to the frame after its commit.
async function draw(items: number): Promise<number> {
  const started = performance.now();
  renderWithStore(
    <div style={{ ...mainArea(2180), height: "800px", display: "flex" }}>
      <HistoryView />
    </div>,
    { state: scene(items), ui: { location: { kind: "history" } } },
  );
  const frame = (await nextFrame()) - started;
  await settle();
  return frame;
}

// arrowDown presses ↓ on the element in focus and returns the milliseconds to the frame after it.
async function arrowDown(): Promise<number> {
  const target = document.activeElement as HTMLElement;
  const started = performance.now();
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  return (await nextFrame()) - started;
}

/** Times are the first paints and the ↓ of a size, the cold one first. */
interface Times {
  paints: number[];
  keys: number[];
}

// measure draws the History of a number of items, presses ↓ on its first day and adds both times.
async function measure(items: number, times: Times) {
  times.paints.push(await draw(items));
  // The list is windowed: the rows mounted are the ones of the window, not the ones of the list.
  const mounted = document.querySelectorAll("[data-row-key]").length;
  expect(mounted).toBeLessThanOrEqual(Math.min(items, MOUNTED_CEILING));
  (document.querySelector("[data-section-id]") as HTMLElement).focus();
  times.keys.push(await arrowDown());
  cleanup();
}

const ms = (value: number) => value.toFixed(1);

// told is what the run prints of a size: the cold time, the warm median and the warm maximum.
function told(values: readonly number[]): string {
  const [cold = 0, ...warm] = values;
  return `cold ${ms(cold)} ms, warm median ${ms(median(warm))} ms, max ${ms(Math.max(...warm))} ms`;
}

// warmMedian is the median of the warm times, the cold one left out.
const warmMedian = (values: readonly number[]) => median(values.slice(1));

describe("HistoryView with 400 items", () => {
  it("paints and moves with ↓ within a ratio of the History with 40", {
    timeout: TEST_TIMEOUT_MS,
  }, async ({ annotate }) => {
    const many: Times = { paints: [], keys: [] };
    const few: Times = { paints: [], keys: [] };
    for (let run = 0; run <= WARM_RUNS; run++) {
      await measure(FEW_ITEMS, few);
      await measure(ITEMS, many);
    }
    const paintRatio = warmMedian(many.paints) / warmMedian(few.paints);
    const keyRatio = warmMedian(many.keys) / warmMedian(few.keys);
    await annotate(
      `history ${ITEMS} items: first paint ${told(many.paints)}; ↓ ${told(many.keys)}. ` +
        `${FEW_ITEMS} items: first paint ${told(few.paints)}; ↓ ${told(few.keys)}. ` +
        `Ratio of the warm medians: first paint ${paintRatio.toFixed(1)}, ↓ ${keyRatio.toFixed(1)}`,
    );

    expect(paintRatio).toBeLessThan(RATIO_CEILING);
    expect(keyRatio).toBeLessThan(RATIO_CEILING);
  });
});
