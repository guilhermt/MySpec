import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeploysView } from "@/features/deploys/DeploysView";
import { api, type DeployEnvironment } from "@/lib/wails";
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

  describe("Enter, Esc, O and D", () => {
    const RUN = {
      id: 1,
      status: "succeeded",
      conclusion: "success",
      url: "https://github.com/dev/api/actions/runs/1",
      startedAt: "2026-09-16T10:00:00Z",
      endedAt: "2026-09-16T10:03:00Z",
    };
    const promotion = (deployPr: NonNullable<DeployEnvironment["promotion"]>["deployPr"]) => ({
      commits: 2,
      partial: false,
      ahead: 2,
      pendingSince: "",
      pullRequests: [],
      deployPr,
      otherDeployPrs: 0,
    });

    function acting(staging: Partial<Parameters<typeof makeDeployEnvironment>[0]> = {}) {
      return renderWithStore(<DeploysView />, {
        ui: { location: { kind: "deploys" } },
        state: makeState({
          deploys: makeDeploys({
            readAt: "2026-09-16T12:00:00Z",
            boards: [
              makeDeployBoard({
                repositories: [
                  makeDeployRepository({
                    id: "api",
                    name: "api",
                    fullName: "dev/api",
                    readAt: "2026-09-16T12:00:00Z",
                    environments: [
                      makeDeployEnvironment({ lastRun: RUN }),
                      makeDeployEnvironment({
                        position: 1,
                        name: "Staging",
                        previousName: "Development",
                        compareUrl: "https://github.com/dev/api/compare/staging...dev",
                        ...staging,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        }),
      });
    }

    it("opens the panel with Enter on a slot, and closes it with Enter again", async () => {
      const { user } = acting();
      slot(/^api · Staging ·/).focus();

      await user.keyboard("{Enter}");
      expect(
        screen.getByRole("complementary", { name: "Deploy api to Staging" }),
      ).toBeInTheDocument();

      slot(/^api · Staging ·/).focus();
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("closes the panel with Esc and gives the focus back to the slot that opened it", async () => {
      const { user } = acting();
      await user.click(slot(/^api · Development to Staging/));
      await user.click(screen.getByRole("button", { name: "Close" }));
      await user.click(slot(/^api · Development to Staging/));
      screen.getByRole("button", { name: /Open Development → Staging on GitHub/ }).focus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(slot(/^api · Development to Staging/)).toHaveFocus();
    });

    it("does nothing with Esc when no panel is open", async () => {
      const { user } = acting();
      slot(/^api · Staging ·/).focus();

      await user.keyboard("{Escape}");

      expect(slot(/^api · Staging ·/)).toHaveFocus();
    });

    it("opens the last run with O on a cell", async () => {
      const { user } = acting();
      slot(/^api · Development ·/).focus();

      await user.keyboard("o");

      expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(RUN.url);
    });

    it("opens the comparison with O on a passage, and the deploy pull request when one is open", async () => {
      const { user } = acting();
      slot(/^api · Development to Staging/).focus();
      await user.keyboard("o");
      expect(api.openExternal).toHaveBeenLastCalledWith(
        "https://github.com/dev/api/compare/staging...dev",
      );
    });

    it("opens the deploy pull request with O on a passage that has one", async () => {
      const { user } = acting({
        prReady: true,
        available: "merge",
        promotion: promotion({
          number: 88,
          title: "Deploy",
          url: "https://github.com/dev/api/pull/88",
          draft: false,
          createdAt: "2026-09-16T11:00:00Z",
        }),
      });
      slot(/^api · Development to Staging/).focus();

      await user.keyboard("o");

      expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(
        "https://github.com/dev/api/pull/88",
      );
    });

    it("says there is no run with O on a cell that never deployed", async () => {
      const { user } = acting();
      slot(/^api · Staging ·/).focus();

      await user.keyboard("o");

      expect(api.openExternal).not.toHaveBeenCalled();
      expect(await screen.findAllByText(/No deploy run yet\./)).not.toHaveLength(0);
    });

    it("deploys with D on a slot when changes wait", async () => {
      const { user } = acting({ available: "deploy", pending: true, promotion: promotion(null) });
      slot(/^api · Staging ·/).focus();

      await user.keyboard("d");

      expect(api.deploy).toHaveBeenCalledExactlyOnceWith("api", 1);
    });

    it("merges with D from inside the panel when a pull request is ready", async () => {
      const { user } = acting({ available: "merge", prReady: true, promotion: promotion(null) });
      await user.click(slot(/^api · Staging ·/));
      screen.getByRole("button", { name: "Close" }).focus();

      await user.keyboard("d");

      expect(api.merge).toHaveBeenCalledExactlyOnceWith("api", 1);
    });

    it("says why D does nothing from inside the panel", async () => {
      const { user } = acting();
      await user.click(slot(/^api · Staging ·/));
      screen.getByRole("button", { name: "Close" }).focus();

      await user.keyboard("d");

      expect(api.deploy).not.toHaveBeenCalled();
      // The notice is the text on the tooltip surface, apart from the panel's own reason.
      await waitFor(() =>
        expect(document.body.querySelector(".text-tooltip-ink-2")).toHaveTextContent(
          "Nothing to deploy to Staging.",
        ),
      );
    });

    it("says why D does nothing", async () => {
      const { user } = acting();
      slot(/^api · Staging ·/).focus();

      await user.keyboard("d");
      expect(api.deploy).not.toHaveBeenCalled();
      expect(await screen.findAllByText(/Nothing to deploy to Staging\./)).not.toHaveLength(0);

      slot(/^api · Development ·/).focus();
      await user.keyboard("d");
      expect(
        await screen.findAllByText(
          /The first environment receives the pull requests of the tasks\./,
        ),
      ).not.toHaveLength(0);
    });

    it("closes the notice with Esc before the panel", async () => {
      const { user } = acting();
      await user.click(slot(/^api · Staging ·/));
      slot(/^api · Staging ·/).focus();
      await user.keyboard("d");
      expect(await screen.findAllByText(/Nothing to deploy to Staging\./)).not.toHaveLength(0);

      await user.keyboard("{Escape}");

      // The panel keeps its own reason; the notice is the text on the tooltip surface.
      expect(document.body.querySelector(".text-tooltip-ink-2")).toBeNull();
      expect(screen.getByRole("complementary")).toBeInTheDocument();
    });

    it("shows the refusal of Go as a notice", async () => {
      vi.mocked(api.deploy).mockRejectedValueOnce(new Error("Already deploying"));
      const { user } = acting({ available: "deploy", pending: true, promotion: promotion(null) });
      slot(/^api · Staging ·/).focus();

      await user.keyboard("d");

      expect(await screen.findAllByText(/Already deploying/)).not.toHaveLength(0);
    });
  });
});
