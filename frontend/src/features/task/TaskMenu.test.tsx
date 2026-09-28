import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskMenu } from "@/features/task/TaskMenu";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeStep, makeTask } from "@/test/wails-mock";

function menu(overrides: Partial<TaskSummary> = {}) {
  const task = makeTask(overrides);
  return renderWithStore(<TaskMenu task={task} />, { state: makeState({ tasks: [task] }) });
}

async function openMenu(user: ReturnType<typeof menu>["user"]) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  return screen.findByRole("menu");
}

const IMPLEMENTING: Partial<TaskSummary> = {
  stage: "implementation",
  currentStep: 1,
  worktreePath: "/w/api/add-login",
  steps: [makeStep({ status: "implementing", worktreePath: "/w/api/add-login" })],
};

describe("TaskMenu", () => {
  it("groups the actions by subject, the deletion last after a separator", async () => {
    const { user } = menu(IMPLEMENTING);

    const opened = await openMenu(user);

    const groups = within(opened).getAllByRole("group");
    expect(groups.map((group) => group.textContent)).toEqual([
      expect.stringMatching(/^Step 1 · Add the login form/),
      expect.stringMatching(/^Task/),
      "Delete task…",
    ]);
    expect(within(opened).getByRole("separator")).toBeInTheDocument();
  });

  it("opens the worktree in VS Code, with its key", async () => {
    const { user } = menu(IMPLEMENTING);
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Open in VS Code/ });
    expect(item).toHaveTextContent("Ctrl+E");
    await user.click(item);

    expect(api.openInEditor).toHaveBeenCalledWith("task-1");
  });

  it("takes the review back from the agent at once", async () => {
    const { user } = menu({
      ...IMPLEMENTING,
      steps: [makeStep({ status: "agent_review", reviewMode: "agent" })],
    });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Review myself" }));

    expect(api.reviewStepMyself).toHaveBeenCalledWith("task-1");
  });

  it("asks before discarding the step", async () => {
    const { user } = menu(IMPLEMENTING);
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Discard step 1…" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Discard step 1");
  });

  it("reopens a stage after the confirmation", async () => {
    const { user } = menu({ stage: "plan" });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Back to Tech spec…" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Back to the Tech spec?");
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(api.backToStage).toHaveBeenCalledWith("task-1", "tech_spec");
  });

  it("restarts the stage the task is in after the confirmation", async () => {
    const { user } = menu({ stage: "tech_spec" });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Discard and restart the tech spec…" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Discard the Tech spec and start over?",
    );
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(api.discardStage).toHaveBeenCalledWith("task-1", "tech_spec");
  });

  it("keeps the stage when the confirmation is refused", async () => {
    const { user } = menu({ stage: "tech_spec" });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Back to PRD…" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(api.backToStage).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks before deleting the task", async () => {
    const { user } = menu();
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Delete task…" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent('Delete "add-login"?');
  });

  it("opens the review mode popover from the ⋯ and returns the focus to it", async () => {
    const { user } = menu({ reviewMode: "agent" });
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Review mode/ });
    expect(item).toHaveTextContent("Agent");
    await user.click(item);

    expect(await screen.findByRole("dialog", { name: "Review mode" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Review mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  it("opens the models popover from the ⋯", async () => {
    const { user } = menu();
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: /^Models/ }));

    expect(await screen.findByRole("dialog", { name: "Models" })).toBeInTheDocument();
  });

  it("acts on the open pull request", async () => {
    const pr = makePullRequest({
      status: "in_review",
      prNumber: 1284,
      prUrl: "https://github.com/acme/web/pull/1284",
    });
    const { user } = menu({ stage: "pr", pr });

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /^Open PR/ }));
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Refresh PR" }));
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Review again" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/acme/web/pull/1284");
    expect(api.refreshPR).toHaveBeenCalledWith("task-1");
    expect(api.reviewAgain).toHaveBeenCalledWith("task-1");
  });

  it("throws the draft of the pull request away", async () => {
    const { user } = menu({ stage: "pr", pr: makePullRequest({ status: "draft_ready" }) });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Discard draft" }));

    expect(api.discardDraft).toHaveBeenCalledWith("task-1");
  });
});
