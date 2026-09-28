import { screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask, makeTaskModels } from "@/test/wails-mock";
import { ModelsPopover } from "./ModelsPopover";

// Subject opens the popover from a button that is not its trigger, as the ⋯ does once its menu has
// closed, and returns the focus to it, or to the chip in Details.
function Subject({
  task,
  returnElsewhere = false,
}: {
  task: TaskSummary;
  returnElsewhere?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={anchor} onClick={() => setOpen(true)}>
        More actions
      </button>
      <button type="button" ref={chip}>
        Models per stage
      </button>
      <ModelsPopover
        task={task}
        open={open}
        onOpenChange={setOpen}
        anchor={anchor}
        {...(returnElsewhere ? { finalFocus: chip } : {})}
      />
    </>
  );
}

async function open(task: TaskSummary = makeTask(), returnElsewhere = false) {
  const rendered = renderWithStore(<Subject task={task} returnElsewhere={returnElsewhere} />, {
    state: makeState({ tasks: [task] }),
  });
  await rendered.user.click(screen.getByRole("button", { name: "More actions" }));
  const popover = await screen.findByRole("dialog", { name: "Models" });
  return { ...rendered, popover };
}

const rowNames = (popover: HTMLElement) =>
  within(popover)
    .getAllByRole("listitem")
    .map((row) => row.firstElementChild?.firstElementChild?.textContent);

describe("ModelsPopover", () => {
  it("has a row per stage of the task, in order, with its name", async () => {
    const { popover } = await open();
    expect(rowNames(popover)).toEqual([
      "PRD",
      "Tech spec",
      "Plan",
      "Implementation",
      "Step review",
      "PR",
      "PR review",
    ]);
  });

  it("calls the planning of a One-Shot task Planning", async () => {
    const models = makeTaskModels().filter(
      (row) => !["prd", "tech_spec", "plan"].includes(row.stage),
    );
    const planning = {
      stage: "one_shot",
      model: "claude-opus-5-5[1m]",
      effort: "high",
      editable: true,
      live: false,
    };
    const task = makeTask({ mode: "one_shot", models: [planning, ...models] });
    const { popover } = await open(task);
    expect(rowNames(popover)[0]).toBe("Planning");
    expect(
      within(popover).getByRole("button", { name: "Planning model: Opus 5.5 (1M) · high" }),
    ).toBeInTheDocument();
  });

  it("gives the first chip the focus", async () => {
    await open();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Tech spec model:/ })).toHaveFocus(),
    );
  });

  it("writes the choice of a started stage, with why it can't change here", async () => {
    const task = makeTask({
      models: makeTaskModels({ tech_spec: { editable: false, live: false } }),
    });
    const { popover } = await open(task);
    const [prd, techSpec] = within(popover).getAllByRole("listitem");
    expect(within(popover).queryByRole("button", { name: /^PRD model:/ })).not.toBeInTheDocument();
    expect(prd).toHaveTextContent(
      "PRDFable 5.1 · high · started. Change it in the conversation, from the composer",
    );
    expect(techSpec).toHaveTextContent(
      "Tech specFable 5.1 · high · started. The stage has started; its session keeps this model",
    );
  });

  it("shows why a started stage can't change in the tooltip, on keyboard focus", async () => {
    const { user } = await open();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Tech spec model:/ })).toHaveFocus(),
    );
    await user.tab({ shift: true });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Change it in the conversation, from the composer",
    );
  });

  it("saves the choice of a stage", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: /^Plan model:/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Sonnet 5" }));
    expect(api.setStageModel).toHaveBeenCalledWith("task-1", "plan", "claude-sonnet-5", "high");
  });

  it("shows Saving… on the chip while the choice saves", async () => {
    let finish = () => {};
    vi.mocked(api.setStageModel).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: /^Plan model:/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Sonnet 5" }));
    const chip = screen.getByRole("button", { name: /^Plan model:/ });
    expect(chip).toHaveTextContent("Saving…");
    expect(chip).toHaveAttribute("aria-busy", "true");
    finish();
    await waitFor(() => expect(chip).not.toHaveTextContent("Saving…"));
  });

  it("says under the row why a choice wasn't saved, and Try again makes it again", async () => {
    vi.mocked(api.setStageModel).mockRejectedValueOnce(new Error("The stage has started"));
    const { user, popover } = await open();
    await user.click(screen.getByRole("button", { name: /^Plan model:/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Sonnet 5" }));

    const alert = await within(popover).findByRole("alert");
    expect(alert).toHaveTextContent("The stage has started · Try again");
    const planRow = within(popover).getAllByRole("listitem")[2];
    expect(planRow).toContainElement(alert);

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(api.setStageModel).toHaveBeenCalledTimes(2);
    expect(api.setStageModel).toHaveBeenLastCalledWith("task-1", "plan", "claude-sonnet-5", "high");
    await waitFor(() => expect(within(popover).queryByRole("alert")).not.toBeInTheDocument());
  });

  it("says a stage takes its model when it starts, and that a step can have its own", async () => {
    const { popover } = await open();
    expect(popover).toHaveTextContent(
      "A stage takes its model when it starts. Each step not started can have its own, in Details.",
    );
  });

  it("says only the first sentence in a One-Shot task", async () => {
    const { popover } = await open(makeTask({ mode: "one_shot" }));
    expect(popover).toHaveTextContent("A stage takes its model when it starts.");
    expect(popover).not.toHaveTextContent("Each step not started");
  });

  it("closes the menu of a chip on Escape first, then the popover, and returns the focus to the anchor", async () => {
    const { user } = await open();
    const chip = screen.getByRole("button", { name: /^Plan model:/ });
    await user.click(chip);
    await screen.findByRole("menu");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Models" })).toBeInTheDocument();
    expect(chip).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  it("returns the focus to finalFocus when given", async () => {
    const { user } = await open(makeTask(), true);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Models per stage" })).toHaveFocus();
  });
});
