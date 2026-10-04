import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { TaskMenu } from "@/features/task/TaskMenu";
import { api, type DeletePreview } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDeletePreview, makeState, makeTask } from "@/test/wails-mock";

const WORKTREE = {
  path: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
  dirty: true,
  files: 3,
  error: "",
};
const BRANCH = { name: "add-login", merged: false, ahead: 2, error: "" };
const PR = { number: 12, url: "https://github.com/o/r/pull/12", state: "open" };

const TASK = makeTask({ name: "Rate limit per API key" });

function dialog(task = TASK) {
  const onOpenChange = vi.fn();
  const view = renderWithStore(<DeleteTaskDialog task={task} open onOpenChange={onOpenChange} />, {
    state: makeState({ tasks: [task] }),
  });
  return { ...view, onOpenChange };
}

function previewing(preview: Partial<DeletePreview>) {
  vi.mocked(api.previewDelete).mockResolvedValue(makeDeletePreview(preview));
}

describe("DeleteTaskDialog", () => {
  it("asks with the name of the task and says what the deletion removes", async () => {
    previewing({});
    dialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete “Rate limit per API key”?" })).toBeVisible();
    expect(
      screen.getByText(
        "This removes the documents, the steps and every record of the task. It can't be undone.",
      ),
    ).toBeInTheDocument();
    expect(api.previewDelete).toHaveBeenCalledWith(TASK.id);
  });

  it("lists the worktree, the branch and the pull request that stays", async () => {
    previewing({ worktree: WORKTREE, branch: BRANCH, pr: PR });
    dialog();

    const list = await screen.findByRole("list", { name: "What will be destroyed" });
    expect(within(list).getByText("The worktree is removed")).toBeInTheDocument();
    expect(within(list).getByText("3 uncommitted files")).toBeInTheDocument();
    expect(
      within(list).getByText("~/.local/share/myspec/worktrees/dev/web/add-login"),
    ).toBeVisible();
    expect(within(list).getByText("add-login")).toHaveClass("font-mono");
    expect(within(list).getByText("add-login").parentElement).toHaveTextContent(
      "The branch add-login is deleted",
    );
    expect(within(list).getByText("not merged · 2 commits")).toBeInTheDocument();
    expect(within(list).getByText("PR #12 stays open on GitHub")).toBeInTheDocument();
  });

  it("says it is reading, and Delete task is already enabled", async () => {
    vi.mocked(api.previewDelete).mockReturnValue(new Promise(() => {}));
    dialog();

    expect(screen.getByRole("status")).toHaveTextContent("Reading the worktree and the branch…");
    expect(screen.getByRole("button", { name: "Delete task" })).toBeEnabled();
  });

  it("says when the whole reading failed, and still deletes", async () => {
    vi.mocked(api.previewDelete).mockRejectedValue(new Error("git is busy"));
    const { user } = dialog();

    expect(await screen.findByText("Couldn't read the worktree and the branch")).toBeVisible();
    expect(screen.getByText("git is busy. Deleting still removes them.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(api.deleteTask).toHaveBeenCalledWith(TASK.id);
  });

  it("draws no list for a task with nothing to lose", async () => {
    previewing({});
    dialog();

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("list", { name: "What will be destroyed" })).not.toBeInTheDocument();
  });

  it("says the answer in progress that is interrupted", async () => {
    previewing({});
    dialog(makeTask({ stage: "prd", sessionStatus: "working", name: "Rate limit" }));

    expect(
      await screen.findByText("The PRD agent's answer in progress is interrupted"),
    ).toBeVisible();
  });

  it("keeps the refusal in the footer, the dialog open, and the button back", async () => {
    previewing({});
    vi.mocked(api.deleteTask).mockRejectedValueOnce(new Error("the database is locked"));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete the task: the database is locked",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete task" })).toBeEnabled();
    expect(useAppStore.getState().error).toBeNull();
  });

  it("keeps Cancel, × and Esc inert while it deletes, and deletes once", async () => {
    previewing({});
    let finish: () => void = () => {};
    vi.mocked(api.deleteTask).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve({ leftover: null });
      }),
    );
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    const busy = await screen.findByRole("button", { name: "Deleting…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(busy);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.deleteTask).toHaveBeenCalledOnce();

    await act(async () => finish());
  });

  it("stays as it is when the state with the task gone arrives, and the page takes the area", async () => {
    previewing({});
    const { user } = dialog();
    useAppStore.getState().openTask(TASK.id);

    await user.click(screen.getByRole("button", { name: "Delete task" }));
    act(() => useAppStore.getState().applyState(makeState({ tasks: [] })));

    expect(useAppStore.getState().location).toMatchObject({ kind: "gone", id: TASK.id });
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
  });

  it("does not delete with Ctrl+Enter", async () => {
    previewing({});
    const { user } = dialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.deleteTask).not.toHaveBeenCalled();
  });

  it("opens from the ⋯ on Cancel, keeps the Tab inside and gives the focus back", async () => {
    previewing({ worktree: WORKTREE });
    const task = makeTask({ name: "Rate limit per API key" });
    const { user } = renderWithStore(<TaskMenu task={task} />, {
      state: makeState({ tasks: [task] }),
    });

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete task…" }));
    const opened = await screen.findByRole("alertdialog");

    await waitFor(() =>
      expect(within(opened).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    await user.tab();
    await user.tab();
    await user.tab();
    await expect.poll(() => opened.contains(document.activeElement)).toBe(true);
    await user.click(within(opened).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus());
    expect(api.deleteTask).not.toHaveBeenCalled();
  });

  it("reads again each time it opens and drops the answer of a closed opening", async () => {
    let first: (preview: DeletePreview) => void = () => {};
    vi.mocked(api.previewDelete)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          first = resolve;
        }),
      )
      .mockResolvedValue(makeDeletePreview({ branch: BRANCH }));
    const onOpenChange = vi.fn();
    const state = makeState({ tasks: [TASK] });
    const view = renderWithStore(
      <DeleteTaskDialog task={TASK} open onOpenChange={onOpenChange} />,
      {
        state,
      },
    );
    view.rerender(<DeleteTaskDialog task={TASK} open={false} onOpenChange={onOpenChange} />);
    view.rerender(<DeleteTaskDialog task={TASK} open onOpenChange={onOpenChange} />);

    expect(await screen.findByText("not merged · 2 commits")).toBeInTheDocument();
    await act(async () => first(makeDeletePreview({ worktree: WORKTREE })));

    expect(screen.queryByText("The worktree is removed")).not.toBeInTheDocument();
    expect(api.previewDelete).toHaveBeenCalledTimes(2);
  });
});
