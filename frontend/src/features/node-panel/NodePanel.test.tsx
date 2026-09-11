import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodePanel } from "@/features/node-panel/NodePanel";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeSituation, makeState, makeTask } from "@/test/wails-mock";

const TASKS = [
  makeTask({ id: "t-root", name: "add-login", repoPath: "", contextPercent: 42 }),
  makeTask({
    id: "t-web",
    name: "fix-header",
    repoPath: "/home/dev/projects/web",
    stage: "tech_spec",
    sessionStatus: "working",
  }),
];

const REPO_NODE = { selectedNodeId: "repo:/home/dev/projects/web" } as const;

describe("NodePanel", () => {
  it("describes the workspace root", () => {
    renderWithStore(<NodePanel />, { state: makeState() });

    expect(screen.getByRole("heading", { name: "projects" })).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects")).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("No tasks in this workspace root")).toBeInTheDocument();
    expect(
      screen.getByText("Tasks created here will be the ones that touch more than one repository."),
    ).toBeInTheDocument();
  });

  it("describes the selected repository", () => {
    renderWithStore(<NodePanel />, { state: makeState(), ui: REPO_NODE });

    expect(screen.getByRole("heading", { name: "web" })).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects/web")).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
    expect(screen.getByText("No tasks in web")).toBeInTheDocument();
    expect(
      screen.getByText("Tasks created here will be the ones that touch only this repository."),
    ).toBeInTheDocument();
  });

  it("copies the full path of the node", async () => {
    const { user } = renderWithStore(<NodePanel />, { state: makeState(), ui: REPO_NODE });

    await user.click(screen.getByRole("button", { name: "Copy path" }));

    await expect(navigator.clipboard.readText()).resolves.toBe("/home/dev/projects/web");
  });

  it("lists the tasks of the selected node", () => {
    renderWithStore(<NodePanel />, { state: makeState({ tasks: TASKS }) });

    expect(screen.queryByText("No tasks in this workspace root")).not.toBeInTheDocument();
    const tasks = screen.getAllByRole("listitem");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toHaveTextContent("add-login");
    expect(tasks[0]).toHaveTextContent("PRD");
    expect(tasks[0]).toHaveTextContent("Waiting");
    expect(tasks[0]).toHaveTextContent("42%");
  });

  it("reads what a task waits on the user for, as its row in the tree does", () => {
    const task = makeTask({
      id: "t-root",
      name: "add-login",
      situations: [
        makeSituation({ id: "draft", taskId: "t-root", kind: "draft" }),
        makeSituation({ id: "findings", taskId: "t-root", kind: "findings" }),
      ],
    });
    renderWithStore(<NodePanel />, { state: makeState({ tasks: [task] }) });

    const [row] = screen.getAllByRole("listitem");
    expect(row).toHaveTextContent("Draft to approve +1");
    expect(row?.querySelector('[aria-hidden="true"]')).toHaveClass("bg-[var(--status-attention)]");
  });

  it("lists only the tasks of the repository that is selected", () => {
    renderWithStore(<NodePanel />, { state: makeState({ tasks: TASKS }), ui: REPO_NODE });

    const tasks = screen.getAllByRole("listitem");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toHaveTextContent("fix-header");
    expect(tasks[0]).toHaveTextContent("Tech spec");
    expect(tasks[0]).toHaveTextContent("Working");
  });

  it("opens the task that is clicked", async () => {
    const { user } = renderWithStore(<NodePanel />, { state: makeState({ tasks: TASKS }) });

    await user.click(screen.getByRole("button", { name: /add-login/ }));

    expect(useAppStore.getState().openTaskId).toBe("t-root");
  });

  it("offers the new task dialog from the header and from the empty state", async () => {
    const { user } = renderWithStore(<NodePanel />, { state: makeState(), ui: REPO_NODE });

    const buttons = screen.getAllByRole("button", { name: "New task" });
    expect(buttons).toHaveLength(2);

    await user.click(buttons[1] as HTMLElement);

    expect(useAppStore.getState().newTaskFor).toBe("repo:/home/dev/projects/web");
  });

  it("keeps the new task action in the header once there are tasks", async () => {
    const { user } = renderWithStore(<NodePanel />, { state: makeState({ tasks: TASKS }) });

    await user.click(screen.getByRole("button", { name: "New task" }));

    expect(useAppStore.getState().newTaskFor).toBe("root");
  });

  it("carries the notice above the header", async () => {
    const { user } = renderWithStore(<NodePanel />, {
      state: makeState({ notice: { path: "/home/dev/gone", reason: "not_found" } }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("/home/dev/gone doesn't exist.");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(api.dismissNotice).toHaveBeenCalledOnce();
  });
});
