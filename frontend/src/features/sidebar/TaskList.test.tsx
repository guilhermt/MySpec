import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskList } from "@/features/sidebar/TaskList";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState, makeTask } from "@/test/wails-mock";

const WEB = makeRepository();
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

const WEB_TASK = makeTask();
const API_TASK = makeTask({
  id: "task-2",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
});

function list(filter = "", tasks = [WEB_TASK, API_TASK]) {
  return renderWithStore(<TaskList />, {
    state: makeState({ repositories: [WEB, API], repositoryFilter: filter, tasks }),
  });
}

describe("TaskList", () => {
  it("lists every task with its name, state and repository", () => {
    list();

    const [first, second] = screen.getAllByRole("option");
    expect(first).toHaveAccessibleName("add-login, dev/web, Waiting");
    expect(second).toHaveAccessibleName("fix-header, dev/api, Waiting");
    // The row is crowded: the short name shows, with owner/name in the tooltip.
    expect(screen.getByText("web")).toHaveAttribute("title", "dev/web");
    expect(screen.getByText("api")).toHaveAttribute("title", "dev/api");
  });

  it("opens the task that is clicked", async () => {
    const { user } = list();

    await user.click(screen.getByRole("option", { name: /^fix-header,/ }));

    expect(useAppStore.getState().openTaskId).toBe("task-2");
  });

  it("moves along the list with the arrows, opening what it lands on", async () => {
    const { user } = list();
    const [first] = screen.getAllByRole("option");
    first?.focus();

    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().openTaskId).toBe("task-1");

    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().openTaskId).toBe("task-2");

    // The list does not wrap around.
    await user.keyboard("{ArrowDown}");
    expect(useAppStore.getState().openTaskId).toBe("task-2");

    await user.keyboard("{Home}");
    expect(useAppStore.getState().openTaskId).toBe("task-1");

    await user.keyboard("{End}");
    expect(useAppStore.getState().openTaskId).toBe("task-2");
  });

  it("moves back up the list with ArrowUp, opening what it lands on", async () => {
    const { user } = list();
    const [first] = screen.getAllByRole("option");
    first?.focus();

    await user.keyboard("{End}");
    expect(useAppStore.getState().openTaskId).toBe("task-2");

    await user.keyboard("{ArrowUp}");
    expect(useAppStore.getState().openTaskId).toBe("task-1");

    // The list does not wrap around.
    await user.keyboard("{ArrowUp}");
    expect(useAppStore.getState().openTaskId).toBe("task-1");
  });

  it("opens the focused task with Enter when no task is open", async () => {
    const { user } = list();
    screen.getAllByRole("option")[0]?.focus();

    await user.keyboard("{Enter}");

    expect(useAppStore.getState().openTaskId).toBe("task-1");
  });

  it("opens the focused task with Space when no task is open", async () => {
    const { user } = list();
    screen.getAllByRole("option")[0]?.focus();

    await user.keyboard("{ }");

    expect(useAppStore.getState().openTaskId).toBe("task-1");
  });

  it("keeps only the tasks of the repository of the filter", () => {
    list("repo-2");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /^fix-header,/ })).toBeInTheDocument();
  });

  it("says when the repository of the filter has no task", () => {
    list("repo-1", [API_TASK]);

    expect(screen.getByText("No tasks in web.")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("says when there is no task at all", () => {
    list("", []);

    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  });
});
