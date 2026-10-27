import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeploysView } from "@/features/deploys/DeploysView";
import { api, type Deploys } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeDeployBoard,
  makeDeployEnvironment,
  makeDeployRepository,
  makeDeploys,
  makeState,
} from "@/test/wails-mock";

const READ_AT = "2026-09-16T12:00:00Z";

function view(deploys: Partial<Deploys> = {}) {
  return renderWithStore(<DeploysView />, {
    ui: { location: { kind: "deploys" } },
    state: makeState({
      deploys: makeDeploys({ boards: [makeDeployBoard()], readAt: READ_AT, ...deploys }),
    }),
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("DeploysView", () => {
  it("is the place of Deploys, with its header and Refresh", () => {
    view();

    expect(screen.getByRole("region", { name: "Deploys" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deploys" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("reads the deploys as it opens", () => {
    view();

    expect(api.refreshDeploys).toHaveBeenCalledOnce();
  });

  it("reads them again on Refresh, which is dashed during a reading", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(api.refreshDeploys).toHaveBeenCalledTimes(2);

    act(() =>
      useAppStore.getState().applyState(
        makeState({
          deploys: makeDeploys({ boards: [makeDeployBoard()], readAt: READ_AT, reading: true }),
        }),
      ),
    );

    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("reads them again every minute while it is on screen, and stops when it leaves", () => {
    vi.useFakeTimers();
    const { unmount } = view();
    expect(api.refreshDeploys).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(60_000));
    expect(api.refreshDeploys).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(120_000));
    expect(api.refreshDeploys).toHaveBeenCalledTimes(4);

    unmount();
    act(() => vi.advanceTimersByTime(180_000));
    expect(api.refreshDeploys).toHaveBeenCalledTimes(4);
  });

  describe("before anything is read", () => {
    it("draws the skeleton of the matrix, a row for each repository, and no bar nor strip", () => {
      view({
        readAt: "",
        boards: [
          makeDeployBoard({
            repositories: [makeDeployRepository({ id: "a" }), makeDeployRepository({ id: "b" })],
          }),
        ],
      });

      const skeleton = screen.getByRole("group", { name: "Reading the deploys…" });
      expect(skeleton).toHaveAttribute("aria-busy", "true");
      // A bar for the title of the board and, for each repository, its name and three cells.
      expect(skeleton.querySelectorAll("[data-slot='skeleton']")).toHaveLength(1 + 2 * 4);
      expect(screen.queryByRole("search")).not.toBeInTheDocument();
    });

    it("draws the skeleton before the snapshot arrives", () => {
      renderWithStore(<DeploysView />, { state: null });

      expect(screen.getByRole("group", { name: "Reading the deploys…" })).toBeInTheDocument();
    });

    it("stops being a skeleton once a repository was read on its own", () => {
      view({
        readAt: "",
        boards: [makeDeployBoard({ repositories: [makeDeployRepository({ readAt: READ_AT })] })],
      });

      expect(screen.queryByRole("group", { name: "Reading the deploys…" })).not.toBeInTheDocument();
    });
  });

  it("says that no board has deploys, and opens the boards of Settings", async () => {
    const { user } = view({ boards: [], readAt: "" });

    expect(screen.getByText("No board has deploys.")).toBeInTheDocument();
    expect(
      screen.getByText("Turn on the deploys of a board in Settings › Boards."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Settings" }));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "boards" });
  });

  describe("the board of the filter left", () => {
    it.each([
      ["no_deploys", "The board in the filter has no deploys."],
      ["removed", "The board in the filter was removed."],
    ])("says so for %s, keeps the bar, and clears the filter", async (filterGone, title) => {
      const { user } = view({
        filter: { boardId: "board-9", title: "Ops" },
        filterGone,
      });

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByRole("search", { name: "Filter the deploys" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Clear filter" }));

      expect(api.setDeployFilter).toHaveBeenCalledWith("");
    });
  });

  describe("the whole reading failing", () => {
    const failure = { reason: "gh_failed", message: "gh is not signed in", failedAt: "" };

    it("puts a strip with the reason above the bar, and reads again on Try again", async () => {
      const { user } = view({
        readAt: "",
        failure,
        boards: [makeDeployBoard({ id: "a" }), makeDeployBoard({ id: "b", title: "Ops" })],
      });

      const strip = screen.getByText("Couldn't read the deploys").closest("div");
      expect(strip).toHaveTextContent("gh is not signed in");
      expect(screen.getByRole("search", { name: "Filter the deploys" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Reading the deploys…" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try again" }));

      // Once on opening, once on Try again.
      expect(api.refreshDeploys).toHaveBeenCalledTimes(2);
    });

    it("says Reading… instead of Try again while a reading runs", () => {
      view({ failure, reading: true });

      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      const strip = screen.getByText("Couldn't read the deploys").closest("div");
      expect(strip).toHaveTextContent("Reading…");
    });

    it("is not an alert when it was there as the place opened", () => {
      view({ failure });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("is an alert when it arrives after the place opened", () => {
      view();

      act(() =>
        useAppStore.getState().applyState(
          makeState({
            deploys: makeDeploys({ boards: [makeDeployBoard()], readAt: READ_AT, failure }),
          }),
        ),
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read the deploys");
    });
  });

  describe("the matrix", () => {
    const REPO = {
      id: "api",
      name: "api",
      fullName: "dev/api",
      readAt: READ_AT,
      environments: [
        makeDeployEnvironment({ state: "up_to_date" }),
        makeDeployEnvironment({
          position: 1,
          name: "Staging",
          previousName: "Development",
          state: "pending",
          pending: true,
          promotion: {
            commits: 3,
            partial: false,
            ahead: 3,
            pendingSince: "",
            pullRequests: [],
            deployPr: null,
            otherDeployPrs: 0,
          },
        }),
      ],
    };

    function matrix(repository = {}, deploys: Partial<Deploys> = {}) {
      return view({
        boards: [
          makeDeployBoard({
            title: "Roadmap",
            repositories: [makeDeployRepository({ ...REPO, ...repository })],
          }),
        ],
        ...deploys,
      });
    }

    it("draws a grid for the board with a cell for each environment and a passage between", () => {
      matrix();

      const grid = screen.getByRole("grid", { name: "Roadmap deploys" });
      expect(within(grid).getByRole("rowheader")).toHaveTextContent("api");
      expect(
        within(grid).getByRole("gridcell", { name: "api · Development · deployed" }),
      ).toBeInTheDocument();
      expect(
        within(grid).getByRole("gridcell", {
          name: "api · Development to Staging · 3 commits to deploy",
        }),
      ).toBeInTheDocument();
      expect(
        within(grid).getByRole("gridcell", { name: "api · Staging · pending: 3 commits" }),
      ).toBeInTheDocument();
    });

    it("shows the failed row with its old reading and Try again, which reads that repository", async () => {
      const { user } = matrix({
        failure: { reason: "failed", message: "rate limited", failedAt: "" },
      });

      expect(
        screen.getByRole("gridcell", { name: /^api · Staging · pending/ }),
      ).toHaveAccessibleName(/from the reading of/);
      const line = screen.getByText("Couldn't read api").closest("div");
      expect(line).toHaveTextContent("rate limited");
      await user.click(within(line as HTMLElement).getByRole("button", { name: "Try again" }));

      expect(api.refreshDeployRepository).toHaveBeenCalledWith("api");
    });

    it("says Reading… instead of Try again while the failed row is read", () => {
      matrix({ reading: true, failure: { reason: "failed", message: "x", failedAt: "" } });

      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      expect(screen.getByText("Couldn't read api").closest("div")).toHaveTextContent("Reading…");
    });

    it("records the cell or the passage that was clicked as the open one", async () => {
      const { user } = matrix();
      const cell = screen.getByRole("gridcell", { name: /^api · Staging/ });
      const passage = screen.getByRole("gridcell", { name: /^api · Development to Staging/ });

      await user.click(cell);
      expect(cell).toHaveAttribute("aria-selected", "true");
      expect(passage).toHaveAttribute("aria-selected", "false");

      await user.click(passage);
      expect(passage).toHaveAttribute("aria-selected", "true");
      expect(cell).toHaveAttribute("aria-selected", "false");

      await user.click(passage);
      expect(passage).toHaveAttribute("aria-selected", "false");
    });

    it("opens the panel of the environment on a click, and the passage switches its content to the same environment", async () => {
      const { user } = matrix();
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

      await user.click(screen.getByRole("gridcell", { name: /^api · Staging/ }));
      const panel = screen.getByRole("complementary", { name: "Deploy api to Staging" });
      expect(within(panel).getByRole("heading", { name: "Deploy to Staging" })).toBeInTheDocument();

      await user.click(screen.getByRole("gridcell", { name: /^api · Development ·/ }));
      expect(screen.getByRole("complementary", { name: "api · Development" })).toBeInTheDocument();
      expect(
        screen.queryByRole("complementary", { name: "Deploy api to Staging" }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("gridcell", { name: /^api · Development to Staging/ }));
      expect(
        screen.getByRole("complementary", { name: "Deploy api to Staging" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("closes the panel of an environment that leaves the state", async () => {
      const { user } = matrix();
      await user.click(screen.getByRole("gridcell", { name: /^api · Staging/ }));
      expect(screen.getByRole("complementary")).toBeInTheDocument();

      act(() =>
        useAppStore.getState().applyState(
          makeState({
            deploys: makeDeploys({
              readAt: READ_AT,
              boards: [
                makeDeployBoard({
                  title: "Roadmap",
                  repositories: [
                    makeDeployRepository({
                      ...REPO,
                      environments: [REPO.environments[0] ?? makeDeployEnvironment()],
                    }),
                  ],
                }),
              ],
            }),
          }),
        ),
      );

      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("flashes the cell that changed between two readings, and announces it", () => {
      vi.useFakeTimers();
      matrix();
      const staging = () => screen.getByRole("gridcell", { name: /^api · Staging/ });
      expect(staging()).not.toHaveClass("row-flash");

      act(() =>
        useAppStore.getState().applyState(
          makeState({
            deploys: makeDeploys({
              readAt: READ_AT,
              boards: [
                makeDeployBoard({
                  title: "Roadmap",
                  repositories: [
                    makeDeployRepository({
                      ...REPO,
                      environments: [
                        REPO.environments[0] ?? makeDeployEnvironment(),
                        {
                          ...(REPO.environments[1] ?? makeDeployEnvironment()),
                          state: "up_to_date",
                          pending: false,
                        },
                      ],
                    }),
                  ],
                }),
              ],
            }),
          }),
        ),
      );

      expect(staging()).toHaveClass("row-flash");
      expect(useAppStore.getState().announcement?.text).toBe("api · Staging is up to date");

      act(() => vi.advanceTimersByTime(2_000));
      expect(staging()).not.toHaveClass("row-flash");
    });

    it("opens the panel of the target it arrives with and puts the focus on its cell", () => {
      renderWithStore(<DeploysView />, {
        ui: { location: { kind: "deploys", target: { repositoryId: "api", position: 1 } } },
        state: makeState({
          deploys: makeDeploys({
            readAt: READ_AT,
            boards: [
              makeDeployBoard({
                title: "Roadmap",
                repositories: [makeDeployRepository(REPO)],
              }),
            ],
          }),
        }),
      });

      expect(
        screen.getByRole("complementary", { name: "Deploy api to Staging" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("gridcell", { name: /^api · Staging/ })).toHaveFocus();
    });

    it("neither flashes nor announces the first snapshot", () => {
      matrix();

      expect(screen.getByRole("gridcell", { name: /^api · Staging/ })).not.toHaveClass("row-flash");
      expect(useAppStore.getState().announcement).toBeNull();
    });
  });
});
