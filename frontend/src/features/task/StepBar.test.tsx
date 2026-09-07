import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepBar } from "@/features/task/StepBar";
import { api, type Step, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

function bar(step: Partial<Step> = {}, overrides: Partial<TaskSummary> = {}) {
  const task = makeTask({
    stage: "implementation",
    steps: [makeStep(step), makeStep({ number: 2, file: "2-check-the-token.md" })],
    currentStep: 1,
    ...overrides,
  });
  return renderWithStore(<StepBar task={task} />, { state: makeState({ tasks: [task] }) });
}

describe("StepBar", () => {
  it("places the step in the plan, with its title and repository", () => {
    bar({ status: "awaiting_review", worktreePath: "/w/api/add-login" });

    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Add the login form")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Awaiting review");
  });

  it("names the phase of a step that is preparing", () => {
    const { container } = bar({ status: "preparing", phase: "fetching" });

    expect(screen.getByRole("status")).toHaveTextContent("Fetching origin…");
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the session behind a step that is implementing", () => {
    bar({ status: "implementing", worktreePath: "/w/api/add-login" }, { sessionStatus: "paused" });

    expect(screen.getByRole("status")).toHaveTextContent("Paused");
  });

  it("opens the worktree in VS Code", async () => {
    const { user } = bar({ status: "awaiting_review", worktreePath: "/w/api/add-login" });

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    expect(api.openInEditor).toHaveBeenCalledWith("task-1");
  });

  it("has nothing to open before the worktree exists", () => {
    bar({ status: "preparing", phase: "fetching" });

    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeDisabled();
  });

  it("has no step to discard before the session exists", () => {
    bar({ status: "preparing", phase: "fetching" });

    expect(screen.queryByRole("button", { name: "Discard step" })).not.toBeInTheDocument();
  });

  it("asks before discarding the step", async () => {
    const { user } = bar({ status: "awaiting_review", worktreePath: "/w/api/add-login" });

    await user.click(screen.getByRole("button", { name: "Discard step" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Discard step 1 and start over?",
    );
  });

  it("shows nothing when the task has no step to run", () => {
    const { container } = bar({}, { steps: [], currentStep: 0 });

    expect(container).toBeEmptyDOMElement();
  });
});
