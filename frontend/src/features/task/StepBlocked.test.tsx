import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepBlocked } from "@/features/task/StepBlocked";
import { api, type StepBlock } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

function blocked(block: Partial<StepBlock> = {}) {
  const step = makeStep({
    status: "blocked",
    block: { reason: "dirty_worktree", detail: "", files: 2, ...block },
  });
  const task = makeTask({ stage: "implementation", steps: [step], currentStep: 1 });
  return renderWithStore(<StepBlocked task={task} step={step} />, {
    state: makeState({ tasks: [task] }),
  });
}

describe("StepBlocked", () => {
  it("says what a dirty worktree is and what to do about it", () => {
    blocked();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The worktree has uncommitted changes");
    expect(alert).toHaveTextContent("2 changed files in the worktree.");
  });

  it("names every other reason a step is blocked", () => {
    blocked({ reason: "fetch_failed" });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't fetch origin");
  });

  it("shows what git said, as git said it", () => {
    blocked({ reason: "fetch_failed", detail: "fatal: could not read Username" });

    expect(screen.getByText("fatal: could not read Username").tagName).toBe("PRE");
  });

  it("starts the step over", async () => {
    const { user } = blocked({ reason: "fetch_failed" });

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.retryStep).toHaveBeenCalledWith("task-1");
  });

  it("cleans the worktree and starts, only for a dirty one", async () => {
    const { user } = blocked();

    await user.click(screen.getByRole("button", { name: "Clean and start" }));

    expect(api.cleanAndStartStep).toHaveBeenCalledWith("task-1");
  });

  it("has nothing to clean when the block is not dirt", () => {
    blocked({ reason: "branch_exists" });

    expect(screen.queryByRole("button", { name: "Clean and start" })).not.toBeInTheDocument();
  });
});
