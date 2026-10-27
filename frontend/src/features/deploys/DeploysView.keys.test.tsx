import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeploysView } from "@/features/deploys/DeploysView";
import { renderWithStore } from "@/test/render";
import {
  makeDeployBoard,
  makeDeployEnvironment,
  makeDeployRepository,
  makeDeploys,
  makeState,
} from "@/test/wails-mock";

const environments = (count: number) =>
  Array.from({ length: count }, (_, position) =>
    makeDeployEnvironment({
      position,
      name: ["Development", "Staging", "Production"][position] ?? "Env",
      previousName: position === 0 ? "" : "Development",
    }),
  );

const repository = (id: string, count: number) =>
  makeDeployRepository({
    id,
    name: id,
    fullName: `dev/${id}`,
    readAt: "2026-09-16T12:00:00Z",
    environments: environments(count),
  });

function view() {
  return renderWithStore(<DeploysView />, {
    ui: { location: { kind: "deploys" } },
    state: makeState({
      deploys: makeDeploys({
        readAt: "2026-09-16T12:00:00Z",
        boards: [
          makeDeployBoard({
            id: "a",
            title: "Alpha",
            repositories: [repository("api", 3), repository("web", 2)],
          }),
          makeDeployBoard({ id: "b", title: "Beta", repositories: [repository("jobs", 3)] }),
        ],
      }),
    }),
  });
}

const slot = (name: RegExp | string) => screen.getByRole("gridcell", { name });

describe("DeploysView keys", () => {
  it("has a single Tab stop, on the first cell", () => {
    view();

    const stops = screen
      .getAllByRole("gridcell", { hidden: false })
      .filter((cell) => cell.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName(/^api · Development ·/);
  });

  it("moves the Tab stop with the focus", async () => {
    const { user } = view();

    await user.click(slot(/^api · Development to Staging/));
    await user.keyboard("{ArrowRight}");

    expect(slot(/^api · Staging ·/)).toHaveFocus();
    expect(slot(/^api · Staging ·/)).toHaveAttribute("tabindex", "0");
    expect(slot(/^api · Development ·/)).toHaveAttribute("tabindex", "-1");
  });

  it("walks the cells and the passages of a row with the left and right arrows", async () => {
    const { user } = view();
    slot(/^api · Development ·/).focus();

    await user.keyboard("{ArrowRight}");
    expect(slot(/^api · Development to Staging/)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(slot(/^api · Staging ·/)).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(slot(/^api · Development ·/)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(slot(/^api · Development ·/)).toHaveFocus();
  });

  it("goes down and up across the repositories and the boards, keeping the column", async () => {
    const { user } = view();
    slot(/^api · Staging ·/).focus();

    await user.keyboard("{ArrowDown}");
    expect(slot(/^web · Staging ·/)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(slot(/^jobs · Staging ·/)).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(slot(/^api · Staging ·/)).toHaveFocus();
  });

  it("takes the greatest column below when the next row is shorter", async () => {
    const { user } = view();
    slot(/^api · Production ·/).focus();

    await user.keyboard("{ArrowDown}");

    expect(slot(/^web · Staging ·/)).toHaveFocus();
  });

  it("goes to the ends of the row with Home and End", async () => {
    const { user } = view();
    slot(/^api · Development to Staging/).focus();

    await user.keyboard("{End}");
    expect(slot(/^api · Production ·/)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(slot(/^api · Development ·/)).toHaveFocus();
  });

  it("goes to the ends of the whole grid with Ctrl+Home and Ctrl+End", async () => {
    const { user } = view();
    slot(/^web · Development ·/).focus();

    await user.keyboard("{Control>}{End}{/Control}");
    expect(slot(/^jobs · Production ·/)).toHaveFocus();
    await user.keyboard("{Control>}{Home}{/Control}");
    expect(slot(/^api · Development ·/)).toHaveFocus();
  });
});
