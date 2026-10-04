import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { TaskMenu } from "@/features/task/TaskMenu";
import { api, type DeletePreview, type Step } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeDeletePreview,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

const WORKTREE = {
  path: "/home/dev/.local/share/myspec/worktrees/dev/web/add-login",
  dirty: true,
  files: 3,
  error: "",
};

function previewing(preview: Partial<DeletePreview>) {
  vi.mocked(api.previewDelete).mockResolvedValue(makeDeletePreview(preview));
}

function dialog(onOpenChange = vi.fn(), overrides: Partial<Step> = {}, taskOverrides = {}) {
  const step = makeStep({ number: 3, status: "awaiting_review", ...overrides });
  const task = makeTask({
    stage: "implementation",
    steps: [step],
    currentStep: 3,
    worktreePath: WORKTREE.path,
    ...taskOverrides,
  });
  return {
    task,
    ...renderWithStore(
      <DiscardStepDialog task={task} step={step} open onOpenChange={onOpenChange} />,
      { state: makeState({ tasks: [task] }) },
    ),
  };
}

describe("DiscardStepDialog", () => {
  it("asks with the number of the step and cleans the worktree unless told otherwise", async () => {
    previewing({ worktree: WORKTREE });
    const { user } = dialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discard step 3 and start over?" })).toBeVisible();
    expect(await screen.findByRole("checkbox", { name: "Also clean the worktree" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Discard step" }));

    expect(api.discardStep).toHaveBeenCalledWith("task-1", true);
  });

  it("leaves the worktree alone when the user unchecks the box", async () => {
    previewing({ worktree: WORKTREE });
    const { user } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "Also clean the worktree" }));
    await user.click(screen.getByRole("button", { name: "Discard step" }));

    expect(api.discardStep).toHaveBeenCalledWith("task-1", false);
  });

  it("counts the uncommitted files in the description of the box, which changes with it", async () => {
    previewing({ worktree: WORKTREE });
    const { user } = dialog();

    const box = await screen.findByRole("checkbox", { name: "Also clean the worktree" });
    expect(box).toHaveAccessibleDescription("Discards the 3 uncommitted files in the worktree.");
    await user.click(box);

    expect(box).toHaveAccessibleDescription(
      "The 3 uncommitted files stay, and the step starts blocked until the worktree is clean.",
    );
  });

  it("starts checked at every opening", async () => {
    previewing({});
    const onOpenChange = vi.fn();
    const view = dialog(onOpenChange);
    await view.user.click(await screen.findByRole("checkbox", { name: "Also clean the worktree" }));
    expect(screen.getByRole("checkbox", { name: "Also clean the worktree" })).not.toBeChecked();
    const step = makeStep({ number: 3 });

    view.rerender(
      <DiscardStepDialog task={view.task} step={step} open={false} onOpenChange={onOpenChange} />,
    );
    view.rerender(
      <DiscardStepDialog task={view.task} step={step} open onOpenChange={onOpenChange} />,
    );

    expect(await screen.findByRole("checkbox", { name: "Also clean the worktree" })).toBeChecked();
  });

  it("says it is reading the files, and Discard step is already enabled", async () => {
    vi.mocked(api.previewDelete).mockReturnValue(new Promise(() => {}));
    dialog();

    expect(screen.getByRole("button", { name: "Discard step" })).toBeEnabled();
    expect(screen.getByText("Discards every uncommitted change in the worktree.")).toHaveClass(
      "shimmer-text",
    );
  });

  it("says the count failed under the box, and still discards", async () => {
    vi.mocked(api.previewDelete).mockRejectedValue(new Error("git is busy"));
    const { user } = dialog();

    expect(
      await screen.findByText("Couldn't count the uncommitted files: git is busy"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Discard step" }));

    expect(api.discardStep).toHaveBeenCalledWith("task-1", true);
  });

  it("asks nothing of git for a task without a worktree", async () => {
    dialog(vi.fn(), {}, { worktreePath: "" });

    expect(await screen.findByText("The worktree has no uncommitted changes.")).toBeVisible();
    expect(api.previewDelete).not.toHaveBeenCalled();
  });

  it("says only the conversation of the step goes, when it had no agent review", async () => {
    previewing({});
    dialog();

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "This ends the session and deletes the conversation of step 3. The step starts again from scratch right away.",
    );
  });

  it("says the reviewer and its reports go too", async () => {
    previewing({});
    dialog(vi.fn(), {
      reviewer: makeStepReviewer(),
      reports: [{ pass: 1, file: "3-review-1.md", clean: false, findings: -1 }],
    });

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the report of the agent review.",
    );
  });

  it("words the dialog of a One-Shot implementation", async () => {
    previewing({});
    dialog(vi.fn(), {}, { mode: "one_shot" });

    expect(
      screen.getByRole("heading", { name: "Discard the implementation and start over?" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard the implementation" })).toBeVisible();
  });

  it("says the answer in progress that is interrupted", async () => {
    previewing({});
    dialog(vi.fn(), {}, { sessionStatus: "working" });

    expect(
      await screen.findByText("The implementer's answer in progress is interrupted."),
    ).toBeVisible();
  });

  it("closes and asks for the focus on the task once the step starts over", async () => {
    previewing({});
    const onOpenChange = vi.fn();
    const { user } = dialog(onOpenChange);

    await user.click(await screen.findByRole("button", { name: "Discard step" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(useAppStore.getState().pendingFocus).toBe("request");
  });

  it("keeps the refusal in the footer, the dialog open, and the button back", async () => {
    previewing({});
    vi.mocked(api.discardStep).mockRejectedValueOnce(new Error("the clone is missing"));
    const onOpenChange = vi.fn();
    const { user } = dialog(onOpenChange);

    await user.click(await screen.findByRole("button", { name: "Discard step" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't discard step 3: the clone is missing",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Discard step" })).toBeEnabled();
    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("says the implementation in the refusal of a One-Shot task", async () => {
    previewing({});
    vi.mocked(api.discardStep).mockRejectedValueOnce(new Error("busy"));
    const { user } = dialog(vi.fn(), {}, { mode: "one_shot" });

    await user.click(screen.getByRole("button", { name: "Discard the implementation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't discard the implementation: busy",
    );
  });

  it("keeps Cancel, × and Esc inert while it discards, and discards once", async () => {
    previewing({});
    let finish: () => void = () => {};
    vi.mocked(api.discardStep).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve();
      }),
    );
    const onOpenChange = vi.fn();
    const { user } = dialog(onOpenChange);

    await user.click(await screen.findByRole("button", { name: "Discard step" }));

    const busy = await screen.findByRole("button", { name: "Discarding…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(busy);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.discardStep).toHaveBeenCalledOnce();

    await act(async () => finish());
  });

  it("does nothing when the user backs out, and does not discard with Ctrl+Enter", async () => {
    previewing({});
    const onOpenChange = vi.fn();
    const { user } = dialog(onOpenChange);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(api.discardStep).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.discardStep).not.toHaveBeenCalled();
  });

  it("opens from the ⋯ on Cancel and gives the focus back to it when cancelled", async () => {
    previewing({ worktree: WORKTREE });
    const step = makeStep({ number: 3, status: "awaiting_review" });
    const task = makeTask({
      stage: "implementation",
      steps: [step],
      currentStep: 3,
      sessionStatus: "waiting",
    });
    const { user } = renderWithStore(<TaskMenu task={task} />, {
      state: makeState({ tasks: [task] }),
    });

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard step 3…" }));
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
  });
});
