import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/wails";
import {
  DISCUSSION_SCENES,
  type DiscussionFlags,
  type DiscussionSceneName,
  discussionScene,
  fixDiscussionSceneClock,
} from "@/test/discussion-scenes";
import { capture, setTheme, THEMES } from "@/test/painted";
import { atWindow, proveScene, renderShell, SWEEP_TIMEOUT, windowsIn } from "@/test/widths";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

// A scene rests the pointer on every text it cuts, one by one.
vi.setConfig({ testTimeout: SWEEP_TIMEOUT });

/** Case is a scene of the discussion with its flags, named as the mock's query names it: "drafts?panel=Details". */
type Case = { name: DiscussionSceneName; flags: DiscussionFlags; label: string };

const scene = (name: DiscussionSceneName, flags: DiscussionFlags = {}): Case => {
  const on = Object.entries(flags).map(([flag, value]) =>
    value === true ? flag : `${flag}=${String(value)}`,
  );
  return { name, flags, label: on.length === 0 ? name : `${name}?${on.join("&")}` };
};

/** CASES are the scenes of the mock with the flags of the material: the dialog that starts the discussion, and its screen. */
const CASES: Case[] = [
  ...DISCUSSION_SCENES.map((name) => scene(name)),
  scene("start", { home: true }),
  scene("talk", { error: true }),
  scene("drafts", { edit: true }),
  scene("drafts", { delete: true }),
  scene("drafts", { panel: "Details" }),
  scene("drafts", { panel: "Documents" }),
  scene("drafts", { menu: true }),
  scene("publish", { after: true }),
  scene("published", { archive: true }),
  scene("many", { group: true }),
  scene("done", { archive: true }),
  scene("done", { panel: "Details" }),
  scene("done", { panel: "Documents" }),
];

/** CONTEXT is the context the discussion opens with once started: the message that opens the conversation of the scene talk. */
const CONTEXT =
  Object.values(discussionScene("talk").transcripts)
    .flatMap((transcript) => transcript.entries)
    .find((entry) => entry.user?.prompt === true)?.user?.text ?? "";
const CONTEXT_WITHOUT_CARDS = CONTEXT.split("\n## #")[0] ?? "";

/** REFERENCE are the scenes whose captures go to the pull request. */
const REFERENCE = ["drafts", "start"];

describe.each(THEMES)("The discussion in every window, in the %s theme", (theme) => {
  describe.each(CASES)("the $label scene", ({ name, flags, label }) => {
    const sceneOf = discussionScene(name, flags);
    fixDiscussionSceneClock(sceneOf);

    beforeEach(() => {
      // The line of the context counts what the Go side assembles for the cards picked.
      vi.mocked(api.discussionContext).mockImplementation((request) =>
        Promise.resolve((request.cards ?? []).length > 0 ? CONTEXT : CONTEXT_WITHOUT_CARDS),
      );
    });

    it.each(windowsIn(theme, { reference: REFERENCE.includes(label) }))(
      "holds the checks of every screen at %ipx",
      async (window) => {
        setTheme(theme);
        await atWindow(window);
        for (const [key, value] of Object.entries(sceneOf.storage)) {
          localStorage.setItem(key, value);
        }
        const { main, user } = renderShell({
          state: sceneOf.state,
          ui: { location: sceneOf.location, transcripts: sceneOf.transcripts },
        });
        await sceneOf.after?.(user);

        expect(await proveScene(main)).toEqual({});
        if (REFERENCE.includes(label)) {
          await capture(`ref-discussion-${name}-${window}-${theme}`, main);
        }
      },
    );
  });
});
