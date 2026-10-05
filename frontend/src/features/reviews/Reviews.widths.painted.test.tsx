import { describe, expect, it, vi } from "vitest";
import { capture, setTheme, THEMES } from "@/test/painted";
import {
  fixReviewSceneClock,
  REVIEW_SCENES,
  type ReviewFlags,
  type ReviewSceneName,
  reviewScene,
} from "@/test/review-scenes";
import { atWindow, proveScene, renderShell, SWEEP_TIMEOUT, windowsIn } from "@/test/widths";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

// A scene rests the pointer on every text it cuts, one by one.
vi.setConfig({ testTimeout: SWEEP_TIMEOUT });

/** Case is a scene of Reviews or of the review with its flags, named as the mock's query names it: "publish?own". */
type Case = { name: ReviewSceneName; flags: ReviewFlags; label: string };

const scene = (name: ReviewSceneName, flags: ReviewFlags = {}): Case => {
  const on = Object.keys(flags);
  return { name, flags, label: on.length === 0 ? name : `${name}?${on.join("&")}` };
};

/** CASES are the eleven scenes and the variations of the flags the mock has. */
const CASES: Case[] = [
  ...REVIEW_SCENES.map((name) => scene(name)),
  scene("start", { own: true }),
  scene("publish", { own: true }),
  scene("clean", { own: true }),
  scene("publish", { stale: true }),
  scene("findings", { stale: true }),
  scene("findings", { apply: true }),
  scene("publish", { apply: true }),
  scene("findings", { checkerr: true }),
  scene("checks", { checkerr: true }),
];

/** REFERENCE are the scenes whose captures go to the pull request. */
const REFERENCE = ["list", "findings"];

describe.each(THEMES)("Reviews and the review in every window, in the %s theme", (theme) => {
  describe.each(CASES)("the $label scene", ({ name, flags, label }) => {
    const sceneOf = reviewScene(name, flags);
    fixReviewSceneClock(sceneOf);

    // draw draws the shell at the place of the scene, and does what the scene has the user do.
    const draw = async () => {
      for (const [key, value] of Object.entries(sceneOf.storage)) {
        localStorage.setItem(key, value);
      }
      const { main, user } = renderShell({
        state: sceneOf.state,
        ui: { location: sceneOf.location, transcripts: sceneOf.transcripts },
      });
      await sceneOf.after?.(user);
      return main;
    };

    it.each(windowsIn(theme, { reference: REFERENCE.includes(label) }))(
      "holds the checks of every screen at %ipx",
      async (window) => {
        setTheme(theme);
        await atWindow(window);
        const main = await draw();

        expect(await proveScene(main)).toEqual({});
        if (REFERENCE.includes(label)) {
          await capture(`ref-${name}-${window}-${theme}`, main);
        }
      },
    );
  });
});
