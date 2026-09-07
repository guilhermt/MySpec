import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

function dialog(onOpenChange = vi.fn()) {
  const step = makeStep({ status: "awaiting_review" });
  const task = makeTask({ stage: "implementation", steps: [step], currentStep: 1 });
  return renderWithStore(
    <DiscardStepDialog task={task} step={step} open onOpenChange={onOpenChange} />,
    { state: makeState({ tasks: [task] }) },
  );
}

describe("DiscardStepDialog", () => {
  it("cleans the worktree unless the user says otherwise", async () => {
    const { user } = dialog();

    expect(await screen.findByRole("checkbox", { name: "Also clean the worktree" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(api.discardStep).toHaveBeenCalledWith("task-1", true);
  });

  it("leaves the worktree alone when the user unchecks it", async () => {
    const { user } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "Also clean the worktree" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(api.discardStep).toHaveBeenCalledWith("task-1", false);
  });

  it("does nothing when the user backs out", async () => {
    const onOpenChange = vi.fn();
    const { user } = dialog(onOpenChange);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(api.discardStep).not.toHaveBeenCalled();
  });
});
