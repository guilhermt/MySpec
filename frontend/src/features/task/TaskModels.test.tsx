import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskModelsButton } from "@/features/task/TaskModels";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask, makeTaskModels } from "@/test/wails-mock";

function models(overrides: Partial<TaskSummary> = {}) {
  const task = makeTask(overrides);
  return renderWithStore(<TaskModelsButton task={task} />, {
    state: makeState({ tasks: [task] }),
  });
}

describe("TaskModelsButton", () => {
  it("lists the six stages with the models of the task", async () => {
    const { user } = models();

    await user.click(screen.getByRole("button", { name: "Models" }));

    expect(await screen.findByRole("heading", { name: "Models" })).toBeInTheDocument();
    for (const label of ["PRD", "Tech spec", "Plan", "Implementation", "PR", "PR review"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Only the PRD has a session running, so it is the one line without a picker.
    expect(screen.getAllByRole("button", { name: /model:/ })).toHaveLength(5);
  });

  it("changes a stage still to start", async () => {
    const { user } = models();

    await user.click(screen.getByRole("button", { name: "Models" }));
    await user.click(await screen.findByRole("button", { name: "Plan model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Sonnet 5" }));

    expect(api.setStageModel).toHaveBeenCalledWith("task-1", "plan", "claude-sonnet-5", "high");
    // The menu is a child popup of the panel: a click in it leaves the panel open.
    expect(screen.getByRole("heading", { name: "Models" })).toBeInTheDocument();
  });

  it("shows a stage that started as its value, with where to change it while it runs", async () => {
    const { user } = models({
      models: makeTaskModels({ tech_spec: { editable: false, live: false } }),
    });

    await user.click(screen.getByRole("button", { name: "Models" }));

    const [prd, techSpec] = (await screen.findAllByRole("listitem")) as [HTMLElement, HTMLElement];
    expect(prd).toHaveTextContent("Fable 5.1 · high");
    expect(within(prd).queryByRole("button")).not.toBeInTheDocument();
    expect(prd).toHaveTextContent("Change it in the conversation");
    // The tech spec is no longer editable and no longer runs: only its value.
    expect(techSpec).toHaveTextContent("Fable 5.1 · high");
    expect(techSpec).not.toHaveTextContent("Change it in the conversation");
  });
});
