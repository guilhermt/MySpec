import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDeletePreview, makeState } from "@/test/wails-mock";

const WORKTREE = {
  path: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
  dirty: true,
  files: 3,
  error: "",
};

const BRANCH = { name: "add-login", merged: false, error: "" };

const PR = { number: 12, url: "https://github.com/o/r/pull/12", state: "open" };

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
        worktree: WORKTREE,
        branch: BRANCH,
        pr: PR,
      }),
    );

    dialog();

    expect(
      await screen.findByText("The conversation in progress will be interrupted."),
    ).toBeInTheDocument();
    expect(screen.getByText("The worktree will be removed")).toBeInTheDocument();
    expect(screen.getByText(WORKTREE.path)).toBeInTheDocument();
    expect(screen.getByText("3 uncommitted")).toBeInTheDocument();
    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("not merged")).toBeInTheDocument();
    expect(screen.getByText("This pull request stays open on GitHub:")).toBeInTheDocument();
  });

  it("leaves out what the task does not have", async () => {
    vi.mocked(api.previewDelete).mockResolvedValue(makeDeletePreview({ branch: BRANCH }));

    dialog();

    expect(await screen.findByText("not merged")).toBeInTheDocument();
    expect(screen.queryByText("The worktree will be removed")).not.toBeInTheDocument();
    expect(screen.queryByText("This pull request stays open on GitHub:")).not.toBeInTheDocument();
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
