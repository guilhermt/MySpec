import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { api, type Step } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

function dialog(onOpenChange = vi.fn(), overrides: Partial<Step> = {}) {
  const step = makeStep({ status: "awaiting_review", ...overrides });
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

  it("says only the conversation of the step goes, when it had no agent review", async () => {
    dialog();

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "This ends the session and deletes the conversation of the step. The step starts again from scratch right away.",
    );
  });

  it.each([
    [{ reviewer: makeStepReviewer() }],
    [{ reviewer: null, reports: [{ pass: 1, file: "1-review-1.md", clean: false, findings: -1 }] }],
  ])("says the reviewer and its reports go too, when the step has them %#", async (overrides) => {
    dialog(vi.fn(), overrides);

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "This ends the sessions and deletes the conversations of the step and of its reviewer, with the reports of the agent review. The step starts again from scratch right away.",
    );
  });

  it("does nothing when the user backs out", async () => {
    const onOpenChange = vi.fn();
    const { user } = dialog(onOpenChange);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(api.discardStep).not.toHaveBeenCalled();
  });
});
