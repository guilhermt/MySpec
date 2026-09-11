import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceTree } from "@/features/tree/WorkspaceTree";
import { onStateChanged } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { emitState, makeSituation, makeState, makeTask } from "@/test/wails-mock";

const TASKS = [
  makeTask({ id: "t-root", name: "add-login", repoPath: "" }),
  makeTask({
    id: "t-web",
    name: "fix-header",
    repoPath: "/home/dev/projects/web",
    sessionStatus: "working",
  }),
];

function labels(): string[] {
  return screen.getAllByRole("treeitem").map((row) => row.textContent ?? "");
}

describe("WorkspaceTree", () => {
  it("opens with the root selected and expanded", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState() });

    const root = screen.getByRole("treeitem", { name: "projects Root" });
    expect(root).toHaveAttribute("aria-selected", "true");
    expect(root).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("lists the repositories in the order the scan produced", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState() });

    expect(labels()).toEqual(["projects Root", "api", "web"]);
  });

  it("says so when the workspace has no repositories", () => {
    renderWithStore(<WorkspaceTree />, {
      state: makeState({ workspace: { name: "empty", path: "/home/dev/empty", repos: [] } }),
    });

    expect(
      screen.getByText("No repositories found among the direct children of this folder."),
    ).toBeInTheDocument();
    expect(labels()).toEqual(["empty Root"]);
  });

  it("moves the selection down and up with the arrow keys", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}");

    const api = screen.getByRole("treeitem", { name: "api" });
    expect(api).toHaveAttribute("aria-selected", "true");
    expect(api).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("collapses the root with ArrowLeft and hides the repositories", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(labels()).toEqual(["projects Root"]);

    await user.keyboard("{ArrowRight}");

    expect(labels()).toEqual(["projects Root", "api", "web"]);
  });

  it("goes back to the root with ArrowLeft on a collapsed repository", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "web" }).focus();
    await user.keyboard("{End}{ArrowLeft}");

    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("toggles the focused node with Enter", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    const api = screen.getByRole("treeitem", { name: "api" });
    expect(api).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("No tasks yet")).toHaveLength(2);

    await user.keyboard("{Enter}");

    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-expanded", "false");
  });

  it("selects the row that is clicked without expanding it", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    await user.click(screen.getByRole("treeitem", { name: "web" }));

    const web = screen.getByRole("treeitem", { name: "web" });
    expect(web).toHaveAttribute("aria-selected", "true");
    expect(web).toHaveAttribute("aria-expanded", "false");
  });

  it("expands from the chevron without moving the selection", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    // The chevron carries no role of its own, which is why it is found by test id.
    const chevron = within(screen.getByRole("treeitem", { name: "api" })).getByTestId("chevron");
    await user.click(chevron);

    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("expands a repository with ArrowRight and returns to the root with Home", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}{ArrowRight}");

    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Home}");

    const root = screen.getByRole("treeitem", { name: "projects Root" });
    expect(root).toHaveAttribute("aria-selected", "true");
    expect(root).toHaveFocus();
  });

  it("goes back to the root when the workspace changes", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState() });
    // The same wiring bootstrap installs, so the reset runs through the event.
    onStateChanged((state) => useAppStore.getState().applyState(state));
    await user.click(screen.getByRole("treeitem", { name: "web" }));

    act(() => {
      emitState(
        makeState({
          workspace: {
            name: "labs",
            path: "/home/dev/labs",
            repos: [{ name: "cli", path: "/home/dev/labs/cli" }],
          },
        }),
      );
    });

    expect(screen.getByRole("treeitem", { name: "labs Root" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(labels()).toEqual(["labs Root", "cli"]);
  });

  it("lists the tasks of a node under it", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState({ tasks: TASKS }) });

    expect(labels()).toEqual(["projects Root", "add-login Waiting", "api", "web"]);

    await user.click(within(screen.getByRole("treeitem", { name: "web" })).getByTestId("chevron"));

    expect(labels()).toEqual([
      "projects Root",
      "add-login Waiting",
      "api",
      "web",
      "fix-header Working",
    ]);
  });

  it("opens the task that is clicked and takes the selection from the node", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState({ tasks: TASKS }) });

    await user.click(screen.getByRole("treeitem", { name: "add-login Waiting" }));

    expect(useAppStore.getState().openTaskId).toBe("t-root");
    expect(screen.getByRole("treeitem", { name: "add-login Waiting" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("treeitem", { name: "projects Root" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("closes the open task when a node is clicked", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, {
      state: makeState({ tasks: TASKS }),
      ui: { openTaskId: "t-root" },
    });

    await user.click(screen.getByRole("treeitem", { name: "api" }));

    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-selected", "true");
  });

  it("walks through the tasks with the arrow keys and opens them", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState({ tasks: TASKS }) });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}");

    const task = screen.getByRole("treeitem", { name: "add-login Waiting" });
    expect(useAppStore.getState().openTaskId).toBe("t-root");
    expect(task).toHaveFocus();
    expect(task).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");

    expect(useAppStore.getState().openTaskId).toBeNull();
    expect(screen.getByRole("treeitem", { name: "api" })).toHaveAttribute("aria-selected", "true");
  });

  it("steps into the first task of the root with ArrowRight", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, { state: makeState({ tasks: TASKS }) });

    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(useAppStore.getState().openTaskId).toBe("t-root");
    expect(screen.getByRole("treeitem", { name: "add-login Waiting" })).toHaveFocus();
  });

  it("leaves a task alone on the horizontal arrows and opens it with Enter", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, {
      state: makeState({ tasks: TASKS }),
      ui: { openTaskId: "t-root" },
    });

    screen.getByRole("treeitem", { name: "add-login Waiting" }).focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");

    expect(labels()).toEqual(["projects Root", "add-login Waiting", "api", "web"]);
    expect(useAppStore.getState().openTaskId).toBe("t-root");

    useAppStore.getState().closeTask();
    screen.getByRole("treeitem", { name: "projects Root" }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(useAppStore.getState().openTaskId).toBe("t-root");
  });

  it("gives the tree an accessible name", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState() });

    expect(
      within(screen.getByRole("tree", { name: "Workspace" })).getAllByRole("treeitem"),
    ).toHaveLength(3);
  });
});

describe("WorkspaceTree situations", () => {
  const WEB = "/home/dev/projects/web";

  const DRAFT = makeSituation({
    id: "draft",
    taskId: "t-root",
    kind: "draft",
    startedAt: "2026-09-05T09:00:00Z",
  });
  const FINDINGS = makeSituation({
    id: "findings",
    taskId: "t-root",
    kind: "findings",
    startedAt: "2026-09-05T10:00:00Z",
  });
  const WEB_ERROR = makeSituation({
    id: "web-error",
    taskId: "t-web",
    kind: "session_error",
    group: "error",
    startedAt: "2026-09-05T11:00:00Z",
  });

  const SITUATION_TASKS = [
    makeTask({ id: "t-root", name: "add-login", repoPath: "", situations: [DRAFT, FINDINGS] }),
    makeTask({ id: "t-web", name: "fix-header", repoPath: WEB, situations: [WEB_ERROR] }),
  ];

  // The counter has no role of its own; it is the element that carries the tone
  // around its text.
  function counterOf(row: HTMLElement, text: string): HTMLElement | null {
    return within(row).getByText(text).closest<HTMLElement>("[data-tone]");
  }

  it("reads the most urgent situation of a task and how many others it has", () => {
    renderWithStore(<WorkspaceTree />, { state: makeState({ tasks: SITUATION_TASKS }) });

    expect(
      screen.getByRole("treeitem", { name: "add-login Draft to approve +1" }),
    ).toBeInTheDocument();
  });

  it("counts what a collapsed repository hides and drops the count once it is expanded", async () => {
    const { user } = renderWithStore(<WorkspaceTree />, {
      state: makeState({ tasks: SITUATION_TASKS }),
    });

    const web = screen.getByRole("treeitem", { name: "web 1 waiting for you" });
    expect(counterOf(web, "1 waiting for you")).toHaveAttribute("data-tone", "error");

    await user.click(within(web).getByTestId("chevron"));

    expect(screen.getByRole("treeitem", { name: "web" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("1 waiting for you")).not.toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: "fix-header Session error" })).toBeInTheDocument();
  });

  it("counts every situation of the workspace on the collapsed root, in the most urgent tone", () => {
    renderWithStore(<WorkspaceTree />, {
      state: makeState({ tasks: SITUATION_TASKS }),
      ui: { expandedNodeIds: new Set() },
    });

    const root = screen.getByRole("treeitem", { name: "projects Root 3 waiting for you" });
    expect(counterOf(root, "3 waiting for you")).toHaveAttribute("data-tone", "error");
  });

  it("highlights a task that is not open in the tone of its most urgent situation", () => {
    const blocked = makeSituation({
      id: "blocked",
      taskId: "t-root",
      kind: "pr_blocked",
      group: "error",
      startedAt: "2026-09-05T11:00:00Z",
    });
    renderWithStore(<WorkspaceTree />, {
      state: makeState({
        tasks: [makeTask({ id: "t-root", name: "add-login", situations: [blocked, DRAFT] })],
      }),
      ui: { flashing: new Set(["draft"]) },
    });

    const row = screen.getByRole("treeitem", { name: "add-login PR blocked +1" });
    expect(row).toHaveClass("attention-flash");
    expect(row).toHaveAttribute("data-tone", "error");
  });

  it("does not highlight the open task", () => {
    renderWithStore(<WorkspaceTree />, {
      state: makeState({ tasks: SITUATION_TASKS }),
      ui: { flashing: new Set(["findings"]), openTaskId: "t-root" },
    });

    const row = screen.getByRole("treeitem", { name: "add-login Draft to approve +1" });
    expect(row).not.toHaveClass("attention-flash");
    expect(row).not.toHaveAttribute("data-tone");
  });

  it("rings the counter of the collapsed node that hides the situation that started", () => {
    renderWithStore(<WorkspaceTree />, {
      state: makeState({ tasks: SITUATION_TASKS }),
      ui: { flashing: new Set(["web-error"]) },
    });

    const web = screen.getByRole("treeitem", { name: "web 1 waiting for you" });
    expect(counterOf(web, "1 waiting for you")).toHaveClass("attention-flash-ring");
    expect(web).not.toHaveClass("attention-flash");
    expect(screen.getByRole("treeitem", { name: "add-login Draft to approve +1" })).not.toHaveClass(
      "attention-flash",
    );
  });
});
