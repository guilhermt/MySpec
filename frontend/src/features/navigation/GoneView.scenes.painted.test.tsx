import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoneView } from "@/features/navigation/GoneView";
import { AppNotices } from "@/features/notice/AppNotices";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { TaskView } from "@/features/task/TaskView";
import { type GoneLocation, HOME as HOME_PLACE } from "@/lib/locations";
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
  resolve,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { REFERENCE_NAME, sceneTask, TASK_ID } from "@/test/task-scenes";
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

// The worktrees of the deleted task and of the deleted review, as the page writes them.
const TASK_WORKTREE = "~/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key";
const REVIEW_WORKTREE = "~/.local/share/myspec/worktrees/acme/web/pr_2291";
// FOLDER_WARNING and LOCKED_WARNING are the warnings over the command of a folder git forgot and of a
// locked worktree git still lists.
const FOLDER_WARNING = "rm -rf deletes the modified and untracked files in it too.";
const LOCKED_WARNING =
  "--force --force unlocks the worktree and deletes the modified and untracked files in it too.";

/** Case is a scene of the page of an item that left, or of the notices, named as the mock's query names it. */
interface Case {
  name: "gone" | "notice";
  variant: string;
  /** primary is the primary the scene asks of the page: null for none. */
  primary: string | null;
  /** says are texts the scene writes, as the material words them. */
  says?: string[];
}

const NEXT = "Next that needs you";
// TURN_LINE is what the composer says of the turn of the scene of the task.
const TURN_LINE = "Working · 3m 40s";
const CASES: Case[] = [
  {
    name: "gone",
    variant: "",
    primary: NEXT,
    says: ["PR #1279 was merged into dev at 14:51. MySpec closed the task at 15:02"],
  },
  {
    name: "gone",
    variant: "deleted",
    primary: NEXT,
    says: [
      "Rate limit per API key was deleted",
      "PR #1284 stays open on GitHub.",
      `error: failed to delete '${TASK_WORKTREE}': Permission denied`,
      FOLDER_WARNING,
      `rm -rf ${TASK_WORKTREE}`,
    ],
  },
  {
    name: "gone",
    variant: "deleted-locked",
    primary: NEXT,
    says: [
      "Rate limit per API key was deleted",
      "fatal: cannot remove a locked working tree; use 'remove -f -f' to override or unlock first",
      LOCKED_WARNING,
      `git worktree remove --force --force ${TASK_WORKTREE}`,
    ],
  },
  { name: "gone", variant: "review", primary: NEXT },
  { name: "gone", variant: "discussion", primary: NEXT },
  { name: "gone", variant: "nothing", primary: "Open in History" },
  { name: "gone", variant: "deleted-clean", primary: NEXT },
  {
    name: "gone",
    variant: "review-deleted",
    primary: NEXT,
    says: [`${REVIEW_WORKTREE}': Permission denied`, FOLDER_WARNING, `rm -rf ${REVIEW_WORKTREE}`],
  },
  { name: "notice", variant: "", primary: null, says: ["The implementer's session", TURN_LINE] },
  { name: "notice", variant: "toast", primary: null, says: [TURN_LINE] },
  { name: "notice", variant: "toast-three", primary: null, says: [TURN_LINE] },
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

// stayed is a worktree git couldn't remove, with the error it gives when a file in it is not the
// user's to delete: the product removes with --force, so what is left is a permission, and git forgot
// the worktree before it failed on the folder.
const stayed = (path: string) => ({
  path,
  kept: true,
  error: `error: failed to delete '${path}': Permission denied`,
  registered: false,
  locked: false,
});

// locked is a worktree git refused to remove because it is locked: git still lists it, and removes it
// only with --force twice.
const locked = (path: string) => ({
  path,
  kept: true,
  error:
    "fatal: cannot remove a locked working tree;\nuse 'remove -f -f' to override or unlock first",
  registered: true,
  locked: true,
});

// The task deleted with the page open is the reference task, with its pull request still open.
const DELETED = { name: REFERENCE_NAME, branch: "rate-limit-per-api-key", pr: 1284 };

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
    case "deleted-locked":
    case "deleted-clean": {
      const id = "task-deleted";
      return {
        location: {
          kind: "gone",
          item: "task",
          id,
          name: DELETED.name,
          boardId: board,
          pr: { number: DELETED.pr, state: "open" },
        },
        state,
        leftovers:
          variant === "deleted-clean"
            ? {}
            : {
                [id]: makeLeftover({
                  repoPath: `${HOME}/code/api`,
                  worktree: (variant === "deleted" ? stayed : locked)(
                    `${HOME}/.local/share/myspec/worktrees/acme/api/${DELETED.branch}`,
                  ),
                  branch: { name: DELETED.branch, kept: false, error: "" },
                }),
              },
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
            worktree: stayed(`${HOME}/.local/share/myspec/worktrees/acme/web/pr_2291`),
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

// FAILED is the pause that failed, of the implementer: the one working in the scene of the task.
const FAILED = {
  label: "Couldn't pause Rate limit per API key",
  detail:
    "The implementer's session didn't stop in 10 seconds, so it keeps running. Try Pause again, or Stop its answer from the Implementer tab.",
};

// TURN is how long the turn of the implementer has run at the moment of the scene: 3m 40s, as in the
// scene of the task, on the clock of the History scenes.
const TURN = 220_000;

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
      { state, ui: { location, back: [HOME_PLACE], leftovers } },
    );
    await settle();
    return { area: container.firstElementChild as HTMLElement };
  }
  const scene = sceneTask("run");
  const turnStartedAt = new Date(Date.parse(archived.now) - TURN).toISOString();
  const task = {
    ...scene,
    state: {
      ...scene.state,
      tasks: (scene.state.tasks ?? []).map((one) => ({ ...one, turnStartedAt })),
    },
  };
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
        back: [HOME_PLACE],
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
        for (const text of one.says ?? []) {
          expect(area).toHaveTextContent(text);
        }

        if (one.name === "gone") {
          // The header keeps one line, and the page, its blocks and its actions stand on whole pixels.
          const band = within(area).getByRole("banner");
          expect(placeHeaderOneLine(band)).toBe(true);
          expect(overlaps(placeHeaderPieces(band))).toBe(false);
          // ← has a place behind it, as it has in the app.
          expect(within(band).getByRole("button", { name: /^Back to / })).not.toHaveAttribute(
            "aria-disabled",
            "true",
          );
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

// The page column is the reading measure less its gutters: the width each block of the page takes.
function pageColumn(): number {
  return (
    Number.parseFloat(resolve("var(--measure-read)", "width")) -
    2 * Number.parseFloat(resolve("var(--space-6)", "width"))
  );
}

describe("The page of an item that left, its blocks and its key", () => {
  const closed = CASES.find((one) => one.name === "gone" && one.variant === "") as Case;
  const deleted = CASES.find((one) => one.name === "gone" && one.variant === "deleted") as Case;

  it.each(WIDTHS)(
    "writes Ctrl J on Next that needs you, and draws the closing on the whole measure at %ipx",
    async (width) => {
      setTheme("light");
      const { area } = await draw(closed, width);

      const next = within(area).getByRole("button", { name: "Next that needs you" });
      const key = within(next).getByText("Ctrl J");
      const keyBox = key.getBoundingClientRect();
      const nextBox = next.getBoundingClientRect();
      expect(keyBox.width).toBeGreaterThan(0);
      expect(keyBox.left).toBeGreaterThanOrEqual(nextBox.left);
      expect(keyBox.right).toBeLessThanOrEqual(nextBox.right);
      expect(getComputedStyle(key).visibility).toBe("visible");

      const closing = within(area).getByRole("group", { name: "What the closing did" });
      expect(closing.getBoundingClientRect().width).toBe(pageColumn());
    },
  );

  it.each(WIDTHS)(
    "draws what stayed on disk on the whole measure, the warning and the commands under it at %ipx",
    async (width) => {
      setTheme("light");
      const { area } = await draw(deleted, width);

      const stayed = within(area).getByRole("group", { name: "What stayed on disk" });
      const warning = within(area)
        .getByText(/^rm -rf deletes the modified/)
        .closest("p");
      const commands = within(area).getByText(/^rm -rf ~/).parentElement;
      if (warning === null || commands === null) {
        throw new Error("the warning or the commands are missing");
      }
      for (const block of [stayed, warning, commands]) {
        expect(block.getBoundingClientRect().width).toBe(pageColumn());
      }
      expect(stayed.contains(warning)).toBe(false);
      expect(stayed.contains(commands)).toBe(false);
      expect(warning.getBoundingClientRect().top).toBeGreaterThan(
        stayed.getBoundingClientRect().bottom,
      );
      expect(commands.getBoundingClientRect().top).toBeGreaterThan(
        warning.getBoundingClientRect().bottom,
      );
    },
  );
});

describe("The toasts over the task screen", () => {
  const three = CASES.find((one) => one.name === "notice" && one.variant === "toast-three") as Case;

  it.each(WIDTHS)("stand above the composer at the main area of %ipx", async (width) => {
    setTheme("light");
    const { area } = await draw(three, width);

    const composer = area.querySelector('[data-slot="composer"]');
    if (composer === null) {
      throw new Error("the task screen has no composer");
    }
    const top = composer.getBoundingClientRect().top;
    const toasts = [...area.querySelectorAll(".toast")];
    expect(toasts).toHaveLength(3);
    for (const toast of toasts) {
      expect(toast.getBoundingClientRect().bottom).toBeLessThanOrEqual(top);
    }
    expect(offWholePixels(area.querySelectorAll(".toasts"))).toEqual([]);
  });
});
