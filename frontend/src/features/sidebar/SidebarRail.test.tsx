import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarRail } from "@/features/sidebar/SidebarRail";
import { taskRow } from "@/features/sidebar/sidebar-tree";
import type { Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

// A review, then a board with two tasks: add-login idle, fix-header waiting on a question.
function state(): State {
  return makeState({
    repositories: [makeRepository({ id: "repo-1", boardId: "board-1" })],
    boards: [makeBoard({ id: "board-1", title: "Product", repositoryIds: ["repo-1"] })],
    reviewCenter: makeReviewCenter({ pendingCount: 4 }),
    reviews: [makeReviewSummary({ id: "review-1", title: "Rate limit" })],
    tasks: [
      makeTask({ id: "task-1", name: "add-login", repositoryId: "repo-1" }),
      makeTask({
        id: "task-2",
        name: "fix-header",
        repositoryId: "repo-1",
        situations: [makeSituation({ id: "s2", taskId: "task-2", kind: "question" })],
      }),
    ],
  });
}

function rail(ui: { location?: Location; sidebarCollapsed?: Set<string> } = {}) {
  return renderWithStore(<SidebarRail />, { state: state(), ui });
}

function blocks() {
  return within(screen.getByRole("tree", { name: "Active items" })).getAllByRole("treeitem");
}

describe("SidebarRail", () => {
  it("draws a block per item in the order of the tree, the collapsed nodes included", () => {
    rail({ sidebarCollapsed: new Set(["board:board-1"]) });

    expect(blocks().map((block) => block.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^pull request review Rate limit\./),
      expect.stringMatching(/^task add-login\./),
      expect.stringMatching(/^task fix-header\./),
    ]);
  });

  it("names each block as its row, with Ctrl+J on the next one", () => {
    const app = state();
    const [idle, waiting] = app.tasks ?? [];
    if (idle === undefined || waiting === undefined) throw new Error("two tasks");
    rail();

    const now = Date.now();
    expect(
      screen.getByRole("treeitem", { name: taskRow(app, idle, now).label }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", {
        name: `${taskRow(app, waiting, now).label} Ctrl+J opens this next.`,
      }),
    ).toBeInTheDocument();
  });

  it("shows the clock or the word of each block", () => {
    rail();

    const [, idle, waiting] = blocks();
    expect(idle).toHaveTextContent("idle");
    expect(waiting).not.toHaveTextContent("idle");
  });

  it("draws the error rail on the block of an item that failed, and on no other", () => {
    const app = state();
    app.tasks = [
      makeTask({
        id: "task-1",
        name: "add-login",
        repositoryId: "repo-1",
        situations: [
          makeSituation({ id: "s1", taskId: "task-1", kind: "session_error", group: "error" }),
        ],
      }),
      ...(app.tasks ?? []).slice(1),
    ];
    renderWithStore(<SidebarRail />, { state: app });

    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveClass(
      "error-rail-bar",
    );
    expect(screen.getByRole("treeitem", { name: /^task fix-header\./ })).not.toHaveClass(
      "error-rail-bar",
    );
  });

  it("shows the item on screen open", () => {
    rail({ location: { kind: "task", id: "task-1" } });

    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens an item on a click", async () => {
    const { user } = rail();

    await user.click(screen.getByRole("treeitem", { name: /^pull request review Rate limit\./ }));

    expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" });
  });

  it("walks the blocks by keyboard as one Tab stop, and opens with Enter", async () => {
    const { user } = rail({ location: { kind: "task", id: "task-1" } });

    // Expand the sidebar, New, then the one stop of the strip.
    await user.tab();
    await user.tab();
    await user.tab();

    const [review, open, waiting] = blocks();
    expect(open).toHaveFocus();
    expect(review).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowDown}");
    expect(waiting).toHaveFocus();
    await user.keyboard("{Home}");
    expect(review).toHaveFocus();
    await user.keyboard("{End}");
    expect(waiting).toHaveFocus();
    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });

    await user.keyboard("{Enter}");

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-2" });
    expect(waiting).toHaveFocus();
  });

  it("tells the name and what the item says in the tooltip of a block", async () => {
    const { user } = rail();

    await user.hover(screen.getByRole("treeitem", { name: /^task add-login\./ }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("add-login");
  });

  it("counts the pending pull requests on the separator of Reviews", () => {
    rail();

    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("expands the sidebar again", async () => {
    const { user } = renderWithStore(<SidebarRail />, {
      state: state(),
      ui: { sidebarRail: true },
    });

    await user.click(screen.getByRole("button", { name: "Expand the sidebar" }));

    expect(useAppStore.getState().sidebarRail).toBe(false);
  });

  it("stacks New and the foot as icon buttons", () => {
    rail();

    expect(
      screen.getByRole("button", { name: "New task, review or discussion" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^History/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
