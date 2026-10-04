import { waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";

/** MENU_EXIT_MS is how long the exit animation the test gives a menu lasts. */
const MENU_EXIT_MS = 50;

/**
 * withMenuExitAnimation runs a test with the menus given an exit animation, which jsdom doesn't play.
 * A menu gives the focus back once its exit animation ends, after the dialog one of its items opened
 * took it: with the animation, that order happens in the test as in the app, and only the guard of
 * the menu keeps the focus in the dialog.
 */
export async function withMenuExitAnimation(run: () => Promise<void>): Promise<void> {
  vi.stubGlobal("BASE_UI_ANIMATIONS_DISABLED", false);
  const animations = vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (
    this: Element,
  ) {
    if (this.getAttribute("role") !== "menu") return [];
    const finished = new Promise((done) => setTimeout(done, MENU_EXIT_MS));
    return [{ finished, pending: false, playState: "finished" } as unknown as Animation];
  });
  try {
    await run();
  } finally {
    animations.mockRestore();
    vi.stubGlobal("BASE_UI_ANIMATIONS_DISABLED", true);
  }
}

/** menuGone waits for the menu to leave, and for the frame after it, when it gives the focus back. */
export async function menuGone(): Promise<void> {
  await waitFor(() => expect(document.querySelector("[role='menu']")).toBeNull());
  await new Promise((done) => requestAnimationFrame(done));
}
