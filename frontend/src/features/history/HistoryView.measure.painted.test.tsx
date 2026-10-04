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
 * (docs/development/target-machine.md, A lista do History): the first paint, from before the render
 * to the frame after its commit, and ↓ in the list, from the keydown to the frame after it, once
 * cold and five times warm. The targets are the ones of the board, 300 ms and 16 ms. The test
 * prints the numbers and holds them to a ceiling a whole order above the targets, so that a list
 * that stopped being a list fails and a slow runner does not.
 */
const ITEMS = 400;
const WARM_RUNS = 5;
const FIRST_PAINT_CEILING_MS = 3000;
const ARROW_CEILING_MS = 500;
// TEST_TIMEOUT_MS holds the six runs on a loaded runner: they take 8 s alone and over 20 s beside the other browser tests.
const TEST_TIMEOUT_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 24, 12);

// archivedAt spreads the items over 90 days, the newest first, four or five a day.
const archivedAt = (i: number) =>
  new Date(NOW - Math.floor((i * 90 * DAY_MS) / ITEMS)).toISOString();

function scene() {
  const tasks: ArchivedTask[] = [];
  const reviews: ArchivedReview[] = [];
  const discussions: ArchivedDiscussion[] = [];
  for (let i = 0; i < ITEMS; i++) {
    const id = `item-${String(i).padStart(3, "0")}`;
    if (i % 20 < 12) {
      tasks.push(
        makeArchivedTask({
          id,
          name: `Task number ${i}`,
          mode: i % 5 === 0 ? "one_shot" : "structured",
          archivedAt: archivedAt(i),
        }),
      );
    } else if (i % 20 < 17) {
      reviews.push(
        makeArchivedReview({
          id,
          title: `Review number ${i}`,
          number: i,
          archivedAt: archivedAt(i),
        }),
      );
    } else {
      discussions.push(
        makeArchivedDiscussion({ id, title: `Discussion number ${i}`, archivedAt: archivedAt(i) }),
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
      oldest: archivedAt(ITEMS - 1),
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

// draw mounts the History in a main area of the whole monitor and returns the milliseconds to the frame after its commit.
async function draw(): Promise<number> {
  const started = performance.now();
  renderWithStore(
    <div style={{ ...mainArea(2180), height: "800px", display: "flex" }}>
      <HistoryView />
    </div>,
    { state: scene(), ui: { location: { kind: "history" } } },
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

describe("HistoryView with 400 items", () => {
  it("paints and moves with ↓ within the ceilings", { timeout: TEST_TIMEOUT_MS }, async ({
    annotate,
  }) => {
    const paints: number[] = [];
    const keys: number[] = [];
    for (let run = 0; run <= WARM_RUNS; run++) {
      paints.push(await draw());
      expect(document.querySelectorAll("[data-row-key]")).toHaveLength(ITEMS);
      (document.querySelector("[data-section-id]") as HTMLElement).focus();
      keys.push(await arrowDown());
      cleanup();
    }
    const [coldPaint = 0, ...warmPaints] = paints;
    const [coldKey = 0, ...warmKeys] = keys;
    const ms = (value: number) => value.toFixed(1);
    await annotate(
      `history ${ITEMS} items: first paint cold ${ms(coldPaint)} ms, warm median ${ms(median(warmPaints))} ms, max ${ms(Math.max(...warmPaints))} ms; ↓ cold ${ms(coldKey)} ms, warm median ${ms(median(warmKeys))} ms, max ${ms(Math.max(...warmKeys))} ms`,
    );

    expect(median(warmPaints)).toBeLessThan(FIRST_PAINT_CEILING_MS);
    expect(median(warmKeys)).toBeLessThan(ARROW_CEILING_MS);
  });
});
