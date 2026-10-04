import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageActionDialog } from "@/features/task/StageActionDialog";
import { TaskMenu } from "@/features/task/TaskMenu";
import { api, type DeletePreview, type TaskStage, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeDeletePreview,
  makePullRequest,
  makeState,
  makeStep,
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

function dialog(
  action: "back" | "discard",
  stage: TaskStage,
  overrides: Partial<TaskSummary> = {},
  onOpenChange = vi.fn(),
) {
  const task = makeTask({ stage: "tech_spec", ...overrides });
  return {
    onOpenChange,
    ...renderWithStore(
      <StageActionDialog
        task={task}
        action={action}
        stage={stage}
        open
        onOpenChange={onOpenChange}
      />,
      { state: makeState({ tasks: [task] }) },
    ),
  };
}

const IMPLEMENTING: Partial<TaskSummary> = {
  stage: "implementation",
  branch: "add-login",
  worktreePath: WORKTREE.path,
  currentStep: 1,
  steps: [makeStep({ number: 1, status: "implementing" })],
};

describe("StageActionDialog", () => {
  it("lists what going back deletes and what stays", async () => {
    dialog("back", "prd");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Back to the PRD?" })).toBeVisible();
    expect(screen.getByText("This deletes:")).toBeVisible();
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["the tech spec conversation and document"]);
    expect(
      screen.getByText(
        "The PRD stays, and the tech spec starts again from scratch when you continue.",
      ),
    ).toBeVisible();
  });

  it("lists what discarding deletes, the worktree and its count last", async () => {
    previewing({ worktree: WORKTREE });
    dialog("discard", "plan", IMPLEMENTING);

    expect(screen.getByRole("heading", { name: "Discard the Plan and start over?" })).toBeVisible();
    expect(await screen.findByText(/with 3 uncommitted files/)).toBeVisible();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "the plan conversation and the step file",
      "the conversation of step 1",
      "the worktree and the branch add-login, with 3 uncommitted files",
    ]);
    expect(
      screen.getByText("A new plan session starts right away, from the tech spec."),
    ).toBeVisible();
  });

  it("says any uncommitted work while the worktree is read or unreadable", async () => {
    vi.mocked(api.previewDelete).mockRejectedValue(new Error("git is busy"));
    dialog("back", "prd", IMPLEMENTING);

    expect(
      screen.getByText(/the worktree and the branch add-login, with any uncommitted work in them/),
    ).toBeVisible();
    await waitFor(() => expect(api.previewDelete).toHaveBeenCalled());
    expect(
      await screen.findByText(
        /the worktree and the branch add-login, with any uncommitted work in them/,
      ),
    ).toBeVisible();
  });

  it("notes the pull request that stays open and opens it on GitHub", async () => {
    previewing({});
    const pr = makePullRequest({
      prNumber: 1284,
      prUrl: "https://github.com/o/r/pull/1284",
      prState: "open",
    });
    const { user } = dialog("back", "prd", { ...IMPLEMENTING, stage: "pr", pr });

    expect(screen.getByText("PR #1284 stays open on GitHub.")).toBeVisible();
    expect(screen.getByText(/Close it there if you don't need it\./)).toBeVisible();
    await user.click(screen.getByRole("link", { name: /Open #1284/ }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/1284");
  });

  it("has no note for a pull request that is not open", async () => {
    previewing({});
    const pr = makePullRequest({ prNumber: 1284, prState: "merged" });
    dialog("back", "prd", { stage: "pr", pr });

    expect(screen.queryByText(/stays open on GitHub/)).not.toBeInTheDocument();
  });

  it("words a One-Shot task", async () => {
    dialog("discard", "one_shot", { mode: "one_shot", stage: "one_shot" });

    expect(
      screen.getByRole("heading", { name: "Discard the planning and start over?" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard the planning" })).toBeVisible();
    expect(
      screen.getByText("A new planning session starts right away, from your description."),
    ).toBeVisible();
  });

  it("says the answer in progress that is interrupted", async () => {
    dialog("discard", "tech_spec", { sessionStatus: "working" });

    expect(
      screen.getByText("The tech spec agent's answer in progress is interrupted."),
    ).toBeVisible();
  });

  it.each([
    ["back", "tech_spec", "Back to the Tech spec", "backToStage"],
    ["discard", "tech_spec", "Discard the Tech spec", "discardStage"],
  ] as const)(
    "%s: closes and asks for the focus on the task when it is done",
    async (action, stage, confirm, call) => {
      const { user, onOpenChange } = dialog(action, stage, { stage: "plan" });

      await user.click(screen.getByRole("button", { name: confirm }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(api[call]).toHaveBeenCalledWith("task-1", "tech_spec");
      expect(useAppStore.getState().pendingFocus).toBe("request");
    },
  );

  it.each([
    ["back", "backToStage", "Back to the Tech spec", "Couldn't go back to the Tech spec: busy"],
    ["discard", "discardStage", "Discard the Tech spec", "Couldn't discard the Tech spec: busy"],
  ] as const)(
    "%s: keeps the refusal in the footer with the dialog open",
    async (action, call, confirm, message) => {
      vi.mocked(api[call]).mockRejectedValueOnce(new Error("busy"));
      const { user, onOpenChange } = dialog(action, "tech_spec", { stage: "plan" });

      await user.click(screen.getByRole("button", { name: confirm }));

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: confirm })).toBeEnabled();
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().pendingFocus).toBeNull();
    },
  );

  it("says the planning in the refusal of a One-Shot task", async () => {
    vi.mocked(api.discardStage).mockRejectedValueOnce(new Error("busy"));
    const { user } = dialog("discard", "one_shot", { mode: "one_shot", stage: "one_shot" });

    await user.click(screen.getByRole("button", { name: "Discard the planning" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't discard the planning: busy",
    );
  });

  it("keeps Cancel, × and Esc inert while it works, and works once", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.backToStage).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve();
      }),
    );
    const { user, onOpenChange } = dialog("back", "prd");

    await user.click(screen.getByRole("button", { name: "Back to the PRD" }));

    const busy = await screen.findByRole("button", { name: "Going back…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(busy);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.backToStage).toHaveBeenCalledOnce();

    await act(async () => finish());
  });

  it("does not confirm with Ctrl+Enter", async () => {
    const { user } = dialog("discard", "tech_spec");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.discardStage).not.toHaveBeenCalled();
  });

  it("opens from the ⋯ on Cancel and gives the focus back to it when cancelled", async () => {
    const task = makeTask({ stage: "plan" });
    const { user } = renderWithStore(<TaskMenu task={task} />, {
      state: makeState({ tasks: [task] }),
    });

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Back to Tech spec…" }));
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
    expect(api.backToStage).not.toHaveBeenCalled();
  });
});
