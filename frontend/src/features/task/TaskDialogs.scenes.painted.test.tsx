import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import { api, type TaskSummary } from "@/lib/wails";
import {
  capture,
  cutTexts,
  footerPlaces,
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
import { fixSceneClock, type Scene, sceneTask, TASK_ID } from "@/test/task-scenes";
import { makeDeletePreview } from "@/test/wails-mock";

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
const WORKTREE = {
  path: `${HOME}/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key`,
  dirty: true,
  files: 3,
  error: "",
};
const BRANCH = { name: "rate-limit-per-api-key", merged: false, ahead: 9, error: "" };
const PR = { number: 1284, url: "https://github.com/acme/api/pull/1284", state: "open" };

/** Case is a scene of the dialogs, named as the mock's query names it: "delete-task?v=loading". */
interface Case {
  name: "delete-task" | "discard-step" | "back-to-stage" | "pause";
  variant: string;
  /** scene is the moment of the reference task behind the dialog. */
  scene: () => Scene;
  /** item is the item of the ⋯ that opens the dialog; none for the pause. */
  item?: string;
  /** confirm is the confirmation, and fail the call that refuses it. */
  confirm?: RegExp;
  fail?: () => void;
  /** after is what the scene has the user do once the dialog is open. */
  after?: (user: UserEvent) => Promise<void>;
  /** busy is a confirmation that waits for the call. */
  busy?: boolean;
}

// oneShot is the same moment as a task that has no PRD, tech spec nor plan.
function oneShot(scene: Scene): Scene {
  return withTask(scene, { mode: "one_shot" });
}

// withTask gives the task of a scene the fields given.
function withTask(scene: Scene, fields: Partial<TaskSummary>): Scene {
  return {
    ...scene,
    state: {
      ...scene.state,
      tasks: (scene.state.tasks ?? []).map((task) => ({ ...task, ...fields })),
    },
  };
}

// dialog is the dialog open over the screen, null when none is.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

// beforeFailure is where the footer of a scene that draws a failure stood before the call failed.
let beforeFailure: Places | null = null;

// Places is where Cancel and the confirmation stand, from the bottom edge and the right edge of the
// footer: the failure of the call joins the footer above its buttons, which then grows upward.
type Places = Record<
  "cancel" | "primary",
  { bottom: number; right: number; width: number; height: number }
>;

function placesOf(open: HTMLElement, confirm: RegExp): Places {
  const footer = open.querySelector("[data-dialog-footer]")?.getBoundingClientRect();
  if (footer === undefined) {
    throw new Error("the dialog has no footer");
  }
  const place = (name: string | RegExp) => {
    const box = within(open).getByRole("button", { name }).getBoundingClientRect();
    return {
      bottom: footer.bottom - box.bottom,
      right: footer.right - box.right,
      width: box.width,
      height: box.height,
    };
  };
  return { cancel: place("Cancel"), primary: place(confirm) };
}

const never = () => new Promise<never>(() => {});

// refuse makes the next call of the boundary fail with the message.
const refuse =
  (call: { mockRejectedValueOnce: (error: Error) => unknown }, message: string) => () => {
    call.mockRejectedValueOnce(new Error(message));
  };

const DELETE = {
  name: "delete-task",
  scene: () => sceneTask("run"),
  item: "Delete task…",
  confirm: /^Delete task$/,
  fail: refuse(vi.mocked(api.deleteTask), "the database is locked"),
} as const;

const DISCARD = {
  name: "discard-step",
  scene: () => sceneTask("run"),
  item: "Discard step 3…",
  confirm: /^Discard step$/,
  fail: refuse(vi.mocked(api.discardStep), "the worktree is locked"),
} as const;

const BACK = {
  name: "back-to-stage",
  scene: () => sceneTask("run"),
  item: "Back to Tech spec…",
  confirm: /^Back to the Tech spec$/,
  fail: refuse(vi.mocked(api.backToStage), "the session didn't stop"),
} as const;

// The twenty-one scenes of the dialogs of the task: the sixteen of the mock, the five of the material.
const CASES: Case[] = [
  { ...DELETE, variant: "" },
  { ...DELETE, variant: "loading" },
  { ...DELETE, variant: "failed" },
  { ...DELETE, variant: "merged" },
  {
    ...DELETE,
    variant: "deleting",
    busy: true,
    after: async (user) => {
      vi.mocked(api.deleteTask).mockReturnValueOnce(never());
      await user.click(screen.getByRole("button", { name: "Delete task" }));
      await screen.findByRole("button", { name: "Deleting…" });
    },
  },
  {
    ...DELETE,
    variant: "error",
    after: async (user) => {
      await settle();
      beforeFailure = placesOf(dialog() as HTMLElement, DELETE.confirm);
      DELETE.fail();
      await user.click(screen.getByRole("button", { name: "Delete task" }));
      await screen.findByRole("alert");
    },
  },
  { ...DELETE, variant: "planning", scene: () => sceneTask("plan") },
  { ...DISCARD, variant: "" },
  {
    ...DISCARD,
    variant: "keep",
    after: async (user) => user.click(screen.getByRole("checkbox", { name: /^Also clean/ })),
  },
  { ...DISCARD, variant: "reading" },
  {
    ...DISCARD,
    variant: "oneshot",
    scene: () => oneShot(sceneTask("run")),
    item: "Discard the implementation…",
    confirm: /^Discard the implementation$/,
  },
  { ...BACK, variant: "" },
  {
    ...BACK,
    variant: "pr",
    scene: () => sceneTask("findings-sent"),
    item: "Back to PRD…",
    confirm: /^Back to the PRD$/,
  },
  {
    ...BACK,
    variant: "discard",
    item: "Discard and restart the plan…",
    confirm: /^Discard the Plan$/,
    fail: refuse(vi.mocked(api.discardStage), "the session didn't stop"),
  },
  {
    ...BACK,
    variant: "oneshot",
    scene: () => oneShot(sceneTask("run")),
    item: "Back to planning…",
    confirm: /^Back to planning$/,
  },
  {
    name: "pause",
    variant: "",
    scene: () => withTask(sceneTask("run"), PAUSED),
  },
  {
    name: "pause",
    variant: "pausing",
    scene: () => sceneTask("run"),
    after: async (user) => {
      vi.mocked(api.pause).mockReturnValueOnce(never());
      await user.click(screen.getByRole("button", { name: "Pause" }));
      await screen.findByRole("button", { name: "Pausing…" });
    },
  },
  { name: "pause", variant: "blocked", scene: () => sceneTask("error") },
];

// PAUSED is the task the user paused: nothing runs, and the header offers Resume.
const PAUSED: Partial<TaskSummary> = {
  sessionStatus: "paused",
  turnRunning: false,
  processRunning: false,
  pausedAt: "2026-09-27T17:37:00Z",
};

// answerWith gives the read of what a deletion destroys that the case has: pending while it reads,
// a failed worktree, or the one of the mock.
function answerWith({ variant }: Case): void {
  vi.mocked(api.previewDelete).mockImplementation(() => {
    if (variant === "loading" || variant === "reading") {
      return never();
    }
    if (variant === "planning") {
      return Promise.resolve(makeDeletePreview());
    }
    const merged = variant === "merged";
    return Promise.resolve(
      makeDeletePreview({
        worktree:
          variant === "failed"
            ? {
                ...WORKTREE,
                dirty: false,
                files: 0,
                error: "git status failed: not a git repository",
              }
            : WORKTREE,
        branch: { ...BRANCH, merged, ahead: merged ? 0 : BRANCH.ahead },
        pr: { ...PR, state: merged ? "merged" : "open" },
      }),
    );
  });
}

// draw draws the task screen of a case in a main area of a width, and opens what the case opens.
async function draw(one: Case, width: number) {
  answerWith(one);
  beforeFailure = null;
  const { state, transcripts, openStepTab } = one.scene();
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <TaskView taskId={TASK_ID} />
    </div>,
    {
      state,
      ui: { location: { kind: "task", id: TASK_ID }, transcripts, openStepTab },
    },
  );
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  if (one.item !== undefined) {
    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: one.item }));
    await screen.findByRole("alertdialog");
    // The loading scenes keep the reading; the others have it answered.
    if (one.variant !== "loading" && one.variant !== "reading") {
      await vi.waitFor(() => expect(screen.queryByText(/^Reading the worktree/)).toBeNull());
    }
  }
  await one.after?.(user);
  await settle();
  return { area, band: screen.getByRole("banner", { hidden: true }), user };
}

fixSceneClock();

describe.each(THEMES)("The dialogs of the task, the scenes in the %s theme", (theme) => {
  describe.each(CASES)("the $name scene, variant “$variant”", (one) => {
    it.each(WIDTHS)("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const { area, band, user } = await draw(one, width);
      const open = dialog();

      // The header keeps one line, and nothing on it covers anything else.
      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);

      // Every box of the screen and of the dialog stands on whole pixels.
      expect(
        offWholePixels([
          ...area.querySelectorAll("header, section, article, li, button"),
          ...(open === null
            ? []
            : [
                open,
                ...open.querySelectorAll("[data-dialog-footer], ul, li, label, button, p, h2"),
              ]),
        ]),
      ).toEqual([]);

      // A dialog opens 8vh from the top on a whole pixel.
      expect(open !== null).toBe(one.item !== undefined);
      if (open !== null) {
        expect(open.getBoundingClientRect().top).toBe(
          parseFloat(resolve("round(8vh, 1px)", "top")),
        );
      }

      // The focus leaves what a tooltip would cover in the capture, which comes before the pointer
      // rests on what is cut.
      if (document.querySelector('[role="tooltip"]') !== null) {
        (document.activeElement as HTMLElement | null)?.blur();
        await vi.waitFor(() => {
          if (document.querySelector('[role="tooltip"]') !== null) {
            throw new Error("a tooltip is open");
          }
        });
      }
      await capture(
        `dialogs-${one.name}${one.variant === "" ? "" : `-${one.variant}`}-${width}-${theme}`,
        area,
      );

      // What the top layer cuts says its whole text in a tooltip; behind a modal the screen can't
      // be reached by the pointer.
      expect(await withoutTooltip(cutTexts(open ?? area))).toEqual([]);

      // The dialogs have no primary, since the confirmation is dangerous; a screen has one at most.
      if (open !== null) {
        expect(visiblePrimaries(open)).toEqual([]);
      }
      expect(visiblePrimaries(open ?? document).length).toBeLessThanOrEqual(1);

      // Cancel and the confirmation stand on the same line, the confirmation at the right, with the
      // failure of the call and without it.
      if (open !== null && one.confirm !== undefined && one.fail !== undefined) {
        const confirm = one.busy === true ? /^Deleting…$/ : one.confirm;
        const { cancel, primary } = footerPlaces(open, confirm);
        expect(cancel.top).toBe(primary.top);
        expect(primary.right).toBeLessThan(cancel.right);
        if (one.busy !== true) {
          const before = beforeFailure ?? placesOf(open, confirm);
          if (within(open).queryByRole("alert") === null) {
            one.fail();
            await user.click(within(open).getByRole("button", { name: confirm }));
            await within(open).findByRole("alert");
          }
          expect(placesOf(open, confirm)).toEqual(before);
        }
      }

      // The pause says why it is off, or what it does, on the button of the header.
      if (one.name === "pause") {
        const button = within(band).getByRole("button", {
          name: one.variant === "" ? "Resume" : /^Paus/,
        });
        expect(button.getBoundingClientRect().height).toBeGreaterThan(0);
        if (one.variant === "blocked") {
          expect(button).toHaveAttribute("aria-disabled", "true");
          expect(button).toHaveAccessibleDescription(/^Nothing is running to pause/);
        }
      }
    });
  });
});

describe("Discard step, its box", () => {
  it.each(WIDTHS)(
    "changes the words and never the height of the dialog at the main area of %ipx",
    async (width) => {
      setTheme("light");
      const { user } = await draw({ ...DISCARD, variant: "" }, width);
      const open = dialog() as HTMLElement;
      const footer = () =>
        open.querySelector("[data-dialog-footer]")?.getBoundingClientRect().top ?? Number.NaN;
      const checked = footer();
      const box = within(open).getByRole("checkbox", { name: /^Also clean/ });
      expect(box).toHaveAccessibleDescription("Discards the 3 uncommitted files in the worktree.");

      await user.click(box);
      await settle();

      expect(box).toHaveAccessibleDescription(
        "The 3 uncommitted files stay, and the step starts blocked until the worktree is clean.",
      );
      expect(footer()).toBe(checked);
    },
  );
});
