import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewMenu } from "@/features/sidebar/NewMenu";
import type { Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeState } from "@/test/wails-mock";

async function openMenu(options: { rail?: boolean; state?: State; location?: Location } = {}) {
  const rendered = renderWithStore(<NewMenu rail={options.rail ?? false} />, {
    state: options.state ?? makeState({ boards: [makeBoard({ id: "board-1" })] }),
    ...(options.location !== undefined ? { ui: { location: options.location } } : {}),
  });
  await rendered.user.click(
    screen.getByRole("button", { name: options.rail ? "New task, review or discussion" : "New" }),
  );
  await screen.findByRole("menu");
  return rendered;
}

describe("NewMenu", () => {
  it("tells what it creates and its key", async () => {
    const { user } = renderWithStore(<NewMenu />, { state: makeState() });

    await user.tab();

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("New task, review or discussion");
    expect(tooltip).toHaveTextContent("Ctrl+N");
  });

  it("opens the creation dialog from New task", async () => {
    const { user } = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "New task Ctrl N" }));

    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });

  it("goes to Reviews to review a pull request", async () => {
    const { user } = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Review a pull request" }));

    expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
  });

  it("opens a new discussion of the board on screen", async () => {
    const { user } = await openMenu({
      state: makeState({ boards: [makeBoard({ id: "board-1" }), makeBoard({ id: "board-2" })] }),
      location: { kind: "board", id: "board-2" },
    });

    await user.click(screen.getByRole("menuitem", { name: "New discussion" }));

    expect(useAppStore.getState().newDiscussion).toEqual({
      boardId: "board-2",
      cardKeys: [],
      askBoard: false,
    });
  });

  it("disables New discussion without a board, with the reason", async () => {
    await openMenu({ state: makeState({ boards: [] }) });

    expect(
      screen.getByRole("menuitem", {
        name: "New discussion · Add a board to discuss its cards.",
      }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("asks the board from a place without one, with several boards", async () => {
    const { user } = await openMenu({
      state: makeState({ boards: [makeBoard({ id: "board-1" }), makeBoard({ id: "board-2" })] }),
    });

    await user.click(screen.getByRole("menuitem", { name: "New discussion" }));

    expect(useAppStore.getState().newDiscussion).toEqual({
      boardId: "board-1",
      cardKeys: [],
      askBoard: true,
    });
  });

  it("disables New discussion while no board was read, with the reason", async () => {
    await openMenu({ state: makeState({ boards: [makeBoard({ readAt: "" })] }) });

    expect(
      screen.getByRole("menuitem", {
        name: "New discussion · The board hasn't been read yet.",
      }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("opens the same menu from the + of the strip", async () => {
    const { user } = await openMenu({ rail: true });

    await user.click(screen.getByRole("menuitem", { name: "New task Ctrl N" }));

    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });
});
