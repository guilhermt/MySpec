import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoneView } from "@/features/navigation/GoneView";
import { AppNotices } from "@/features/notice/AppNotices";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { TaskView } from "@/features/task/TaskView";
import type { GoneLocation } from "@/lib/locations";
import type { State } from "@/lib/wails";
import type { Toast } from "@/store/app-store";
import { fixHistorySceneClock, historyScene } from "@/test/history-scenes";
import {
  capture,
  cutTexts,
  mainArea,
  offWholePixels,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { sceneTask, TASK_ID } from "@/test/task-scenes";
import { makeLeftover, makeSituation, makeTask } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;
const WIDTHS = [WIDE_MAIN, HALF_MAIN];

const HOME = "/home/guilherme";

/** Case is a scene of the page of an item that left, or of the notices, named as the mock's query names it. */
interface Case {
  name: "gone" | "notice";
  variant: string;
  /** primary is the primary the scene asks of the page: null for none. */
  primary: string | null;
}

const NEXT = "Next that needs you";
const CASES: Case[] = [
  { name: "gone", variant: "", primary: NEXT },
  { name: "gone", variant: "deleted", primary: NEXT },
  { name: "gone", variant: "review", primary: NEXT },
  { name: "gone", variant: "discussion", primary: NEXT },
  { name: "gone", variant: "nothing", primary: "Open in History" },
  { name: "gone", variant: "deleted-clean", primary: NEXT },
  { name: "gone", variant: "review-deleted", primary: NEXT },
  { name: "notice", variant: "", primary: null },
  { name: "notice", variant: "toast", primary: null },
  { name: "notice", variant: "toast-three", primary: null },
];

// The archived items of the History scenes, the ones the mock's page tells of.
const archived = historyScene("archived-task");
const ARCHIVED_REVIEW = historyScene("archived-review");
const ARCHIVED_DISCUSSION = historyScene("archived-discussion");

// itemOf is the archived item a History scene opens, found by its id among the ones the state has.
function itemOf<T extends { id: string }>(
  scene: ReturnType<typeof historyScene>,
  list: T[] | null,
): T {
  const { location } = scene;
  const item = list?.find((one) => "id" in location && one.id === location.id);
  if (item === undefined) {
    throw new Error("the item is not archived");
  }
  return item;
}

const TASK = itemOf(archived, archived.state.history);
const REVIEW = itemOf(ARCHIVED_REVIEW, ARCHIVED_REVIEW.state.reviewHistory);
const DISCUSSION = itemOf(ARCHIVED_DISCUSSION, ARCHIVED_DISCUSSION.state.discussionHistory);

// WAITING is the task another place needs the user in: what Next that needs you opens.
const WAITING = makeTask({
  id: "task-w",
  name: "Widget for today's tasks",
  situations: [makeSituation({ taskId: "task-w" })],
});

const WORKTREE_STAYED = {
  path: `${HOME}/.local/share/myspec/worktrees/acme/api/idempotency-keys`,
  kept: true,
  error:
    "fatal: '…/idempotency-keys' contains modified or untracked files, use --force to delete it",
  registered: true,
};

// pageOf is the page of an item that left, with the state it is read from and what the deletion left.
function pageOf({ variant }: Case): {
  location: GoneLocation;
  state: State;
  leftovers: Record<string, ReturnType<typeof makeLeftover>>;
} {
  const base = archived.state;
  const state = { ...base, tasks: variant === "nothing" ? [] : [WAITING] };
  const board = "board-platform";
  switch (variant) {
    case "deleted":
    case "deleted-clean": {
      const id = "task-deleted";
      return {
        location: {
          kind: "gone",
          item: "task",
          id,
          name: TASK.name,
          boardId: board,
          pr: { number: 1279, state: "open" },
        },
        state,
        leftovers:
          variant === "deleted"
            ? {
                [id]: makeLeftover({
                  repoPath: `${HOME}/code/api`,
                  worktree: WORKTREE_STAYED,
                  branch: { name: "idempotency-keys", kept: false, error: "" },
                }),
              }
            : {},
      };
    }
    case "review":
      return {
        location: { kind: "gone", item: "review", id: REVIEW.id, name: "web#2291", boardId: "" },
        state,
        leftovers: {},
      };
    case "review-deleted":
      return {
        location: {
          kind: "gone",
          item: "review",
          id: "review-deleted",
          name: "web#2291",
          boardId: "",
        },
        state,
        leftovers: {
          "review-deleted": makeLeftover({
            repoPath: `${HOME}/code/web`,
            worktree: {
              ...WORKTREE_STAYED,
              path: `${HOME}/.local/share/myspec/worktrees/acme/web/review-2291`,
            },
          }),
        },
      };
    case "discussion":
      return {
        location: {
          kind: "gone",
          item: "discussion",
          id: DISCUSSION.id,
          name: DISCUSSION.title,
          boardId: board,
        },
        state,
        leftovers: {},
      };
    default:
      return {
        location: { kind: "gone", item: "task", id: TASK.id, name: TASK.name, boardId: board },
        state,
        leftovers: {},
      };
  }
}

// TOASTS are the notices of the items that left without being open: the task and the review of the
// mock, and the discussion the material adds for three.
const TOASTS: Record<string, Toast[]> = {
  toast: [
    { id: TASK.id, kind: "task", task: TASK },
    { id: REVIEW.id, kind: "review", review: REVIEW },
  ],
  "toast-three": [
    { id: TASK.id, kind: "task", task: TASK },
    { id: REVIEW.id, kind: "review", review: REVIEW },
    { id: DISCUSSION.id, kind: "discussion", discussion: DISCUSSION },
  ],
};

const FAILED = {
  label: "Couldn't pause Rate limit per API key",
  detail:
    "The reviewer's session didn't stop in 10 seconds, so it keeps running. Try Pause again, or Stop its answer from the Reviewer tab.",
};

// draw draws a scene in a main area of a width: the page of the item that left, or the task screen
// with the notice and the toasts the shell puts over it.
async function draw(one: Case, width: number) {
  const box = { ...mainArea(width), height: "800px" };
  if (one.name === "gone") {
    const { location, state, leftovers } = pageOf(one);
    const { container } = renderWithStore(
      <div style={{ ...box, display: "flex" }}>
        <GoneView location={location} />
      </div>,
      { state, ui: { location, leftovers } },
    );
    await settle();
    return { area: container.firstElementChild as HTMLElement };
  }
  const task = sceneTask("run");
  const { container } = renderWithStore(
    <div className="main-area relative flex flex-col" style={box}>
      <AppNotices />
      <TaskView taskId={TASK_ID} />
      <ShellToasts />
    </div>,
    {
      state: {
        ...task.state,
        history: [TASK],
        reviewHistory: [REVIEW],
        discussionHistory: [DISCUSSION],
      },
      ui: {
        location: { kind: "task", id: TASK_ID },
        transcripts: task.transcripts,
        openStepTab: task.openStepTab,
        ...(one.variant === "" ? { error: FAILED } : { toasts: TOASTS[one.variant] ?? [] }),
      },
    },
  );
  await settle();
  return { area: container.firstElementChild as HTMLElement };
}

fixHistorySceneClock(archived);

describe.each(THEMES)(
  "The pages that left and the notices, the scenes in the %s theme",
  (theme) => {
    describe.each(CASES)("the $name scene, variant “$variant”", (one) => {
      it.each(WIDTHS)("draws it at the main area of %ipx", async (width) => {
        setTheme(theme);
        const { area } = await draw(one, width);

        if (one.name === "gone") {
          // The header keeps one line, and the page, its blocks and its actions stand on whole pixels.
          const band = within(area).getByRole("banner");
          expect(placeHeaderOneLine(band)).toBe(true);
          expect(overlaps(placeHeaderPieces(band))).toBe(false);
          expect(
            offWholePixels([
              ...area.querySelectorAll("section, h1, h2, ul, li, pre, button, [role='group']"),
            ]),
          ).toEqual([]);
          // The page has one primary: Next that needs you, or Open in History with nothing waiting.
          const primaries = visiblePrimaries(area);
          expect(
            primaries.map((button) => button.textContent?.replace(/Ctrl.*$/, "").trim()),
          ).toEqual([one.primary]);
        } else {
          const notices = [...area.querySelectorAll("[role='alert'], .toast")];
          expect(notices.length).toBeGreaterThan(0);
          expect(
            offWholePixels([
              ...notices,
              ...notices.flatMap((n) => [...n.querySelectorAll("button")]),
            ]),
          ).toEqual([]);
          expect(visiblePrimaries(area)).toEqual([]);
          expect(document.querySelectorAll(".toast")).toHaveLength(
            one.variant === "toast" ? 2 : one.variant === "toast-three" ? 3 : 0,
          );
        }

        // The focus leaves Next that needs you, whose tooltip would cover the capture.
        (document.activeElement as HTMLElement | null)?.blur();
        await vi.waitFor(() => {
          if (document.querySelector('[role="tooltip"]') !== null) {
            throw new Error("a tooltip is open");
          }
        });
        await capture(
          `gone-${one.name}${one.variant === "" ? "" : `-${one.variant}`}-${width}-${theme}`,
          area,
        );

        // What the screen cuts says its whole text in a tooltip, after the capture.
        expect(await withoutTooltip(cutTexts(area))).toEqual([]);
      });
    });
  },
);
