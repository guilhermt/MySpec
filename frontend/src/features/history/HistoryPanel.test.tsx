import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeState } from "@/test/wails-mock";

const LOGIN = makeArchivedTask();
const HEADER = makeArchivedTask({
  id: "task-2",
  name: "fix-header",
  repoPath: "/home/dev/projects/web",
  steps: [],
  repos: [
    {
      repository: "web",
      repoPath: "/home/dev/projects/web",
      prNumber: 0,
      prUrl: "",
      prState: "",
    },
  ],
});

function panel(history = [LOGIN, HEADER]) {
  return renderWithStore(<HistoryPanel />, { state: makeState({ history }) });
}

describe("HistoryPanel", () => {
  it("lists every archived task with what it touched", () => {
    panel();

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("add-login");
    expect(first).toHaveTextContent("Root");
    expect(first).toHaveTextContent("1 step");
    expect(second).toHaveTextContent("fix-header");
    expect(second).toHaveTextContent("web");
    expect(second).toHaveTextContent("0 steps");
  });

  it("labels a One-Shot task in place of its count of steps", () => {
    panel([makeArchivedTask({ mode: "one_shot", repoPath: "/home/dev/projects/web" })]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("One-Shot");
    expect(row).not.toHaveTextContent("1 step");
  });

  it("says when each task began and when it ended", () => {
    panel([LOGIN]);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent(new Date(LOGIN.createdAt).getFullYear().toString());
    expect(row).toHaveTextContent(new Date(LOGIN.archivedAt).getFullYear().toString());
  });

  it("opens the pull request of a repository without opening the task", async () => {
    const { user } = panel([LOGIN]);

    await user.click(screen.getByRole("button", { name: "#12" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/12");
    expect(useAppStore.getState().openArchivedId).toBeNull();
  });

  it("opens the task the user picks", async () => {
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: /fix-header/ }));

    expect(useAppStore.getState().openArchivedId).toBe("task-2");
  });

  it("opens the task from the keyboard", async () => {
    const { user } = panel([LOGIN]);

    screen.getByRole("button", { name: /add-login/ }).focus();
    await user.keyboard("{Enter}");

    expect(useAppStore.getState().openArchivedId).toBe("task-1");
  });

  it("keeps only the tasks whose name carries what was typed", async () => {
    const { user } = panel();

    await user.type(screen.getByRole("textbox", { name: "Search history" }), "login");

    expect(screen.getByRole("listitem")).toHaveTextContent("add-login");
    expect(useAppStore.getState().historyQuery).toBe("login");
  });

  it("says when the search finds nothing", async () => {
    const { user } = panel();

    await user.type(screen.getByRole("textbox", { name: "Search history" }), "nothing");

    expect(screen.getByText("No task matches “nothing”")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("says when nothing was ever archived", () => {
    panel([]);

    expect(screen.getByText("Nothing archived yet")).toBeInTheDocument();
    expect(
      screen.getByText("A task comes here when its last repository is closed."),
    ).toBeInTheDocument();
  });
});
