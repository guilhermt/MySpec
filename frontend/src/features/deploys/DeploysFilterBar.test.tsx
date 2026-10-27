import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeploysFilterBar, filterBarShows } from "@/features/deploys/DeploysFilterBar";
import { api, type Deploys } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDeployBoard, makeDeploys } from "@/test/wails-mock";

const TWO = [
  makeDeployBoard({ id: "board-1", title: "Roadmap" }),
  makeDeployBoard({ id: "board-2", title: "Ops" }),
];

function bar(deploys: Partial<Deploys> = {}) {
  return renderWithStore(<DeploysFilterBar deploys={makeDeploys({ boards: TWO, ...deploys })} />);
}

describe("filterBarShows", () => {
  it.each<[string, Partial<Deploys>, boolean]>([
    ["one board and no filter", { boards: [makeDeployBoard()] }, false],
    ["two boards", { boards: TWO }, true],
    [
      "one board and a filter",
      { boards: [makeDeployBoard()], filter: { boardId: "board-1", title: "Roadmap" } },
      true,
    ],
    ["no board and a filter", { boards: [], filter: { boardId: "board-9", title: "Ops" } }, true],
  ])("tells %s: %s", (_, overrides, shows) => {
    expect(filterBarShows(makeDeploys(overrides))).toBe(shows);
  });
});

describe("DeploysFilterBar", () => {
  it("is the search landmark of the deploys, with the Filter menu and no chip", () => {
    bar();

    expect(screen.getByRole("search", { name: "Filter the deploys" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove the filter/ })).not.toBeInTheDocument();
  });

  it("offers each board as a single choice", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByRole("menuitemcheckbox", { name: "Roadmap" })).not.toBeChecked();
    expect(screen.getByRole("menuitemcheckbox", { name: "Ops" })).not.toBeChecked();
  });

  it("chooses a board, and shows its chip at once", async () => {
    const { user } = bar();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Ops" }));

    expect(api.setDeployFilter).toHaveBeenCalledWith("board-2");
    expect(screen.getByText("Board: Ops")).toBeInTheDocument();
  });

  it("clears the board that is chosen when it is picked again", async () => {
    const { user } = bar({ filter: { boardId: "board-1", title: "Roadmap" } });

    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Roadmap" })).toBeChecked();
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Roadmap" }));

    expect(api.setDeployFilter).toHaveBeenCalledWith("");
  });

  it("clears the filter with the × of the chip", async () => {
    const { user } = bar({ filter: { boardId: "board-1", title: "Roadmap" } });

    expect(screen.getByText("Board: Roadmap")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove the filter Board: Roadmap" }));

    expect(api.setDeployFilter).toHaveBeenCalledWith("");
    expect(screen.queryByText("Board: Roadmap")).not.toBeInTheDocument();
  });

  it("gives the chip back to the snapshot when Go refuses the choice", async () => {
    const { user } = bar();
    vi.mocked(api.setDeployFilter).mockRejectedValueOnce(new Error("disk full"));

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Ops" }));

    await screen.findByRole("button", { name: "Filter" });
    expect(screen.queryByText("Board: Ops")).not.toBeInTheDocument();
  });

  it.each([
    ["no_deploys", "This board no longer has deploys."],
    ["removed", "This board was removed."],
  ])("marks the chip of a board that left with ◇ and says why: %s", async (filterGone, why) => {
    const { user } = bar({
      boards: [makeDeployBoard({ id: "board-1", title: "Roadmap" })],
      filter: { boardId: "board-9", title: "Ops" },
      filterGone,
    });

    const chip = screen.getByRole("button", { name: `Board: Ops, ${why}` });
    expect(chip).toBeInTheDocument();
    await user.hover(chip);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(why);
  });
});
