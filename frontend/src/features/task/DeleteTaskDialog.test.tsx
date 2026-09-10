import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDeletePreview, makeState } from "@/test/wails-mock";

const WORKTREE = {
  repository: "web",
  repoPath: "/home/dev/projects/web",
  path: "/home/dev/.local/share/myspec/worktrees/add-login-web",
  dirty: true,
  files: 3,
  error: "",
};

const BRANCH = {
  repository: "web",
  repoPath: "/home/dev/projects/web",
  name: "add-login",
  merged: false,
  error: "",
};

const PR = {
  repository: "web",
  repoPath: "/home/dev/projects/web",
  number: 12,
  url: "https://github.com/o/r/pull/12",
  state: "open",
};

function dialog(archived = false) {
  return renderWithStore(
    <DeleteTaskDialog
      taskId="task-1"
      name="add-login"
      archived={archived}
      open={true}
      onOpenChange={vi.fn()}
    />,
    { state: makeState() },
  );
}

describe("DeleteTaskDialog", () => {
  it("spells out what the deletion would destroy", async () => {
    vi.mocked(api.previewDelete).mockResolvedValue(
      makeDeletePreview({
        sessionRunning: true,
        worktrees: [WORKTREE],
        branches: [BRANCH],
        prs: [PR],
      }),
    );

    dialog();

    expect(
      await screen.findByText("The conversation in progress will be interrupted."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 worktree will be removed · 1 with uncommitted changes"),
    ).toBeInTheDocument();
    expect(screen.getByText("3 uncommitted")).toBeInTheDocument();
    expect(screen.getByText("1 branch will be deleted · 1 not merged")).toBeInTheDocument();
    expect(screen.getByText("not merged")).toBeInTheDocument();
    expect(screen.getByText("This pull request stays open on GitHub:")).toBeInTheDocument();
  });

  it("counts the worktrees and the branches of every repository", async () => {
    vi.mocked(api.previewDelete).mockResolvedValue(
      makeDeletePreview({
        worktrees: [WORKTREE, { ...WORKTREE, repository: "api", repoPath: "/a", dirty: false }],
        branches: [BRANCH, { ...BRANCH, repoPath: "/a", merged: true }],
      }),
    );

    dialog();

    expect(
      await screen.findByText("2 worktrees will be removed · 1 with uncommitted changes"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 branches will be deleted · 1 not merged")).toBeInTheDocument();
  });

  it("reads nothing from git for a task of the history", async () => {
    dialog(true);

    expect(
      await screen.findByText(
        "This removes the archived task and its documents from the history. It can't be undone.",
      ),
    ).toBeInTheDocument();
    expect(api.previewDelete).not.toHaveBeenCalled();
  });

  it("still deletes when the preview couldn't be read", async () => {
    vi.mocked(api.previewDelete).mockRejectedValue(new Error("git failed"));

    const { user } = dialog();

    expect(await screen.findByText("git failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
  });

  it("deletes the task on the confirmation", async () => {
    const { user } = dialog();
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
  });
});
