import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewDiscussionDialog } from "@/features/discussion/NewDiscussionDialog";
import { api } from "@/lib/wails";
import {
  type DiscussionFlags,
  discussionScene,
  fixDiscussionSceneClock,
} from "@/test/discussion-scenes";
import {
  capture,
  cutTexts,
  mainArea,
  offWholePixels,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

/** DIALOG_WIDTH is --size-dialog-wide, the width of the dialog, as the material fixes it. */
const DIALOG_WIDTH = 576;

/** Case is the start scene with its flags: from the board with two cards, or from the Home. */
type Case = { flags: DiscussionFlags; label: string };

const CASES: Case[] = [
  { flags: {}, label: "start" },
  { flags: { home: true }, label: "start?home" },
];

/**
 * CONTEXT is the context the discussion opens with once started: the message that opens the
 * conversation of the scene talk. Without cards it is the board and the text, the part before them.
 */
const CONTEXT =
  Object.values(discussionScene("talk").transcripts)
    .flatMap((transcript) => transcript.entries)
    .find((entry) => entry.user?.prompt === true)?.user?.text ?? "";
const CONTEXT_WITHOUT_CARDS = CONTEXT.split("\n## #")[0] ?? "";

// draw draws the dialog of a case over a main area of a width, written as the scene writes it.
async function draw(flags: DiscussionFlags, width: number) {
  const drawn = discussionScene("start", flags);
  const { user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <NewDiscussionDialog />
    </div>,
    { state: drawn.state, ui: { location: drawn.location } },
  );
  await drawn.after?.(user);
  await settle();
  return screen.getByRole("dialog", { name: "New discussion" });
}

describe.each(THEMES)("NewDiscussionDialog, the scenes in the %s theme", (theme) => {
  describe.each(CASES)("the $label scene", ({ flags, label }) => {
    fixDiscussionSceneClock(discussionScene("start", flags));

    beforeEach(() => {
      // The line of the context counts what the Go side assembles for the cards picked.
      vi.mocked(api.discussionContext).mockImplementation((request) =>
        Promise.resolve((request.cards ?? []).length > 0 ? CONTEXT : CONTEXT_WITHOUT_CARDS),
      );
    });

    it.each([WIDE_MAIN, HALF_MAIN])("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const dialog = await draw(flags, width);

      // The dialog is the wide one, and it and every part of its body stand on whole pixels.
      expect(dialog.getBoundingClientRect().width).toBe(DIALOG_WIDTH);
      const body = dialog.querySelectorAll(
        "label, input, textarea, button, li, [role='status'], [role='alert']",
      );
      expect(offWholePixels([dialog, ...body])).toEqual([]);

      // The board is asked for only from the Home; from the board it is the line of the board.
      expect(screen.queryByRole("button", { name: /^Board/ }) !== null).toBe(flags.home === true);

      // What the dialog cuts says its whole text in a tooltip.
      expect(await withoutTooltip(cutTexts(dialog))).toEqual([]);

      // Start discussion is the one primary of the dialog.
      const primaries = visiblePrimaries(dialog);
      expect(primaries).toHaveLength(1);
      expect(primaries[0]).toHaveAccessibleName(/^Start discussion/);

      await capture(`discussion-${label.replace("?", "-")}-${width}-${theme}`, dialog);
    });
  });
});
