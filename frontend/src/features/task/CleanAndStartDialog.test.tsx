import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CleanAndStartDialog } from "@/features/task/CleanAndStartDialog";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

function dialog(detail: string, overrides: Partial<TaskSummary> = {}) {
  const step = makeStep({
    number: 5,
    status: "blocked",
    block: { reason: "dirty_worktree", detail, files: 2 },
  });
  const task = makeTask({ stage: "implementation", currentStep: 5, steps: [step], ...overrides });
  const onOpenChange = vi.fn();
  const result = renderWithStore(
    <CleanAndStartDialog task={task} step={step} open onOpenChange={onOpenChange} />,
    { state: makeState({ tasks: [task] }) },
  );
  return { ...result, onOpenChange };
}

describe("CleanAndStartDialog", () => {
  it("opens on Cancel, with the changes thrown away", async () => {
    dialog(" M src/app.ts\n?? notes.md");

    const alert = await screen.findByRole("alertdialog", {
      name: "Clean the worktree and start step 5?",
    });
    await waitFor(() =>
      expect(within(alert).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    expect(alert).toHaveTextContent("These changes are thrown away:");
    expect(
      within(alert)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([" M src/app.ts", "?? notes.md"]);
    expect(alert).toHaveTextContent("Nothing else in the repository changes.");
  });

  it("lists twelve changes and counts the rest", async () => {
    const lines = Array.from({ length: 15 }, (_, index) => `?? file-${index}.ts`);
    dialog(lines.join("\n"));

    const alert = await screen.findByRole("alertdialog");
    const items = within(alert).getAllByRole("listitem");
    expect(items).toHaveLength(13);
    expect(items.at(-1)).toHaveTextContent("and 3 more");
  });

  it("names the implementation of a One-Shot task", async () => {
    dialog(" M a.ts", { mode: "one_shot" });

    expect(
      await screen.findByRole("alertdialog", {
        name: "Clean the worktree and start the implementation?",
      }),
    ).toBeInTheDocument();
  });

  it("cleans and starts the step, and closes", async () => {
    const { user, onOpenChange } = dialog(" M a.ts");

    await user.click(await screen.findByRole("button", { name: "Clean and start" }));

    expect(api.cleanAndStartStep).toHaveBeenCalledWith("task-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says why it couldn't clean, and offers to try again", async () => {
    vi.mocked(api.cleanAndStartStep).mockRejectedValueOnce(new Error("git clean failed"));
    const { user, onOpenChange } = dialog(" M a.ts");

    await user.click(await screen.findByRole("button", { name: "Clean and start" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("git clean failed");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
