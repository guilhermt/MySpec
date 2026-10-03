import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { RepositoryRow } from "@/features/repositories/RepositoryRow";
import { setTheme, THEMES } from "@/test/painted";
import { resetAppStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * withAnimations runs a test with the exit animations of the popups, which the suite turns off: a
 * menu gives the focus back when its animation ends, after the dialog an item opened took it.
 */
async function withAnimations(test: () => Promise<void>) {
  const settled = [...document.head.querySelectorAll("style")].filter((style) =>
    style.textContent?.includes("transition-duration: 0s"),
  );
  for (const style of settled) style.remove();
  Object.assign(globalThis, { BASE_UI_ANIMATIONS_DISABLED: false });
  try {
    await test();
  } finally {
    Object.assign(globalThis, { BASE_UI_ANIMATIONS_DISABLED: true });
    document.head.append(...settled);
  }
}

/** nextFrame waits for the frame the focus guards of a popup move the focus in. */
const nextFrame = () => new Promise((done) => requestAnimationFrame(() => done(undefined)));

describe.each(THEMES)("RepositoryRow in the %s theme", (theme) => {
  it("opens Remove from the ⋯ with the focus on Cancel, held in the dialog", () =>
    withAnimations(async () => {
      setTheme(theme);
      const repository = makeRepository();
      resetAppStore({ state: makeState({ repositories: [repository] }) });
      render(
        <ul>
          <RepositoryRow repository={repository} inNeedsAClone={false} onRemoved={() => {}} />
        </ul>,
      );

      await userEvent.click(screen.getByRole("button", { name: "More for dev/web" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Remove…" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Remove dev/web?" });
      // The focus the menu would give back comes once its exit animation ends: the test waits for
      // the menu to leave and a frame more, to prove it never comes.
      await expect.poll(() => document.querySelector("[role='menu']")).toBeNull();
      await nextFrame();

      const cancel = within(dialog).getByRole("button", { name: "Cancel" });
      expect(document.activeElement).toBe(cancel);
      for (let press = 0; press < 4; press++) {
        await userEvent.tab();
        // A Tab past the last control lands on a focus guard, which hands the focus back in a frame.
        await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);
      }
    }));
});

describe("RepositoryRow, the actions of its block lines", () => {
  it("puts Try again of a failed clone at the right, where Clone stands", () => {
    const missing = makeRepository({ id: "repo-1", name: "web", cloned: false, path: "" });
    const failed = makeRepository({
      id: "repo-2",
      name: "api",
      cloned: false,
      path: "",
      cloneError: "gh: repository not found",
    });
    resetAppStore({ state: makeState({ repositories: [missing, failed] }) });
    render(
      <ul style={{ width: "40rem" }}>
        <RepositoryRow repository={missing} />
        <RepositoryRow repository={failed} />
      </ul>,
    );

    const right = (name: string) =>
      screen.getByRole("button", { name }).getBoundingClientRect().right;
    expect(right("Try again")).toBe(right("Clone"));
  });
});
