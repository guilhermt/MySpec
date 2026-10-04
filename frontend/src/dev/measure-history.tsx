/**
 * measure-history times the list of the History at the size the 90 days are measured at
 * (docs/development/target-machine.md, A lista do History): 400 archived items, 240 tasks, 100
 * reviews and 60 discussions, spread over 90 days. It measures two things, each once cold and five
 * times warm: the first paint of HistoryView, from before the render to the frame after the commit
 * with its layout, and ↓ in the list, from the keydown to the frame after it. The targets are 300 ms
 * and 16 ms.
 *
 * A tool of the development build and of the measure mode of the build: main.tsx mounts it in place
 * of the app only with ?measure=history, and the production bundle never has it. The numbers go to
 * the console and to the page.
 */

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { measuredState } from "@/dev/measure-board";
import { HistoryView } from "@/features/history/HistoryView";
import type { ArchivedDiscussion, ArchivedReview, ArchivedTask, State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

/** TASKS, REVIEWS and DISCUSSIONS are how many items of each kind the measured History has. */
const TASKS = 240;
const REVIEWS = 100;
const DISCUSSIONS = 60;
const ITEMS = TASKS + REVIEWS + DISCUSSIONS;

/** DAYS is how far back the items go. */
const DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** WARM_RUNS is how many times each measure runs after the cold one. */
const WARM_RUNS = 5;

const REPOSITORIES = ["api", "web", "billing", "gateway", "docs"];

// archivedAt spreads the items over the 90 days, the newest first.
const archivedAt = (i: number, now: number) =>
  new Date(now - Math.floor((i * DAYS * DAY_MS) / ITEMS)).toISOString();

// repositoryOf is the repository of item i, as measuredState names them.
function repositoryOf(i: number): { id: string; name: string } {
  const name = REPOSITORIES[i % REPOSITORIES.length] ?? "api";
  return { id: `repo-${name}`, name: `acme/${name}` };
}

// task is archived task i: a structured one, or a one-shot one in every fifth.
function task(i: number, now: number): ArchivedTask {
  const repository = repositoryOf(i);
  return {
    id: `task-${i}`,
    name: `task-number-${i}`,
    repositoryId: repository.id,
    repository: repository.name,
    card: null,
    mode: i % 5 === 0 ? "one_shot" : "structured",
    hasPrd: true,
    hasTechSpec: true,
    hasOneShot: i % 5 === 0,
    steps: [],
    pr: {
      number: 100 + i,
      url: `https://github.com/${repository.name}/pull/${100 + i}`,
      state: "merged",
      base: "main",
      mergedBy: "person0",
      mergedAt: archivedAt(i, now),
    },
    artifactVersion: 1,
    createdAt: archivedAt(i + 3, now),
    archivedAt: archivedAt(i, now),
    close: null,
    hasPrDraft: false,
    prReports: [],
  };
}

// review is archived review i.
function review(i: number, now: number): ArchivedReview {
  const repository = repositoryOf(i);
  return {
    id: `review-${i}`,
    repositoryId: repository.id,
    repository: repository.name,
    number: 500 + i,
    title: `Review number ${i} of the measured History`,
    author: `person${i % 5}`,
    url: `https://github.com/${repository.name}/pull/${500 + i}`,
    mode: "publish",
    outcome: "merged",
    baseBranch: "main",
    card: null,
    passes: [],
    mergedBy: "person0",
    mergedAt: archivedAt(i, now),
    closedAt: "",
    createdAt: archivedAt(i + 3, now),
    archivedAt: archivedAt(i, now),
  };
}

// discussion is archived discussion i.
function discussion(i: number, now: number): ArchivedDiscussion {
  return {
    id: `discussion-${i}`,
    boardId: "board-measure",
    board: "Platform Roadmap",
    title: `Discussion number ${i} of the measured History`,
    text: "",
    cards: [],
    drafts: [],
    publishedCount: 0,
    repositoryIds: [repositoryOf(i).id],
    createdAt: archivedAt(i + 3, now),
    archivedAt: archivedAt(i, now),
  };
}

// measuredHistory is the state the measured History lives in: the items in the order of the kinds
// round the days, 12 of every 20 a task, 5 a review and 3 a discussion.
function measuredHistory(): State {
  const now = Date.now();
  const tasks: ArchivedTask[] = [];
  const reviews: ArchivedReview[] = [];
  const discussions: ArchivedDiscussion[] = [];
  for (let i = 0; i < ITEMS; i++) {
    if (i % 20 < 12) {
      tasks.push(task(i, now));
    } else if (i % 20 < 17) {
      reviews.push(review(i, now));
    } else {
      discussions.push(discussion(i, now));
    }
  }
  return {
    ...measuredState(),
    boards: [],
    tasks: [],
    history: tasks,
    reviewHistory: reviews,
    discussionHistory: discussions,
    historySummary: {
      tasks: tasks.length,
      reviews: reviews.length,
      discussions: discussions.length,
      oldest: archivedAt(ITEMS - 1, now),
      windowStart: new Date(now - DAYS * DAY_MS).toISOString(),
    },
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

// paint mounts the History and returns the milliseconds to the frame after its commit.
async function paint(root: Root): Promise<number> {
  const started = performance.now();
  flushSync(() => root.render(<HistoryView />));
  return (await nextFrame()) - started;
}

// arrowDown presses ↓ on the element in focus, and returns the milliseconds to the frame after it.
async function arrowDown(target: HTMLElement): Promise<number> {
  const started = performance.now();
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
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

/** measureHistory mounts the measured History in the element and times it. */
export async function measureHistory(container: HTMLElement): Promise<void> {
  document.documentElement.dataset.theme = "light";
  container.style.cssText =
    "container:main/inline-size;display:flex;flex-direction:column;width:1566px;height:900px";
  useAppStore.setState({ app: measuredHistory(), location: { kind: "history" } });

  const root = createRoot(container);
  const coldPaint = await paint(root);
  const warmPaint: number[] = [];
  for (let run = 0; run < WARM_RUNS; run++) {
    flushSync(() => root.render(null));
    await nextFrame();
    warmPaint.push(await paint(root));
  }
  const mountedRows = container.querySelectorAll("[data-row-key]").length;

  const first = container.querySelector<HTMLElement>("[data-section-id]");
  if (first === null) {
    throw new Error("the list of the History has no day");
  }
  first.focus();
  const downs: number[] = [];
  for (let run = 0; run <= WARM_RUNS; run++) {
    const focused = document.activeElement;
    downs.push(await arrowDown(focused instanceof HTMLElement ? focused : first));
  }

  const [coldDown, ...warmDowns] = downs;
  const result = {
    items: ITEMS,
    mountedRows,
    firstPaint: measureOf(coldPaint, warmPaint),
    arrowDown: measureOf(coldDown ?? 0, warmDowns),
    targetsMs: { firstPaint: 300, arrowDown: 16 },
    userAgent: navigator.userAgent,
  };
  console.info("measure-history", result);
  const out = document.createElement("pre");
  out.id = "measure-history";
  // The numbers cover the page, so a screenshot of a window of any size reads them.
  out.style.cssText =
    "position:fixed;inset:0;z-index:99999;margin:0;padding:8px;overflow:auto;background:#fff;color:#000;font:12px monospace;white-space:pre-wrap";
  out.textContent = JSON.stringify(result);
  document.body.prepend(out);
}
