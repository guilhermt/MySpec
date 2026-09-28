import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewMode, Step } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeStep } from "@/test/wails-mock";
import { StepModeChip } from "./StepModeChip";

function renderChip(step: Step, taskMode: ReviewMode = "agent") {
  const onChange = vi.fn();
  const onFollow = vi.fn();
  const rendered = renderWithStore(
    <StepModeChip step={step} taskMode={taskMode} onChange={onChange} onFollow={onFollow} />,
  );
  return { ...rendered, onChange, onFollow };
}

const FOLLOWS = makeStep({ number: 5, reviewMode: "agent", reviewModeAdjusted: false });
const OWN = makeStep({ number: 4, reviewMode: "manual", reviewModeAdjusted: true });

describe("StepModeChip", () => {
  it("names the mode of the step and says it opens a menu", () => {
    renderChip(FOLLOWS);
    const chip = screen.getByRole("button", { name: "Review mode of step 5: Agent" });
    expect(chip).toHaveAttribute("aria-haspopup", "menu");
    expect(chip).toHaveTextContent("Agent");
  });

  it("says a step that follows the task follows it, in the tooltip and the description", async () => {
    const { user } = renderChip(FOLLOWS);
    const chip = screen.getByRole("button", { name: "Review mode of step 5: Agent" });
    expect(chip).toHaveAccessibleDescription("Follows the task");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Follows the task");
  });

  it("says a mode of its own sets the mode of the task aside", async () => {
    const { user } = renderChip(OWN);
    const chip = screen.getByRole("button", { name: "Review mode of step 4: Manual" });
    expect(chip).toHaveAccessibleDescription("Its own mode · the task reviews with Agent");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Its own mode · the task reviews with Agent",
    );
  });

  it("offers Agent and Manual, the mode of the step checked, and nothing to follow when it follows", async () => {
    const { user } = renderChip(FOLLOWS);
    await user.click(screen.getByRole("button", { name: /Review mode of step 5/ }));
    const choices = await screen.findAllByRole("menuitemradio");
    expect(choices.map((choice) => choice.textContent)).toEqual(["Agent", "Manual"]);
    expect(screen.getByRole("menuitemradio", { name: "Agent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByRole("menuitem", { name: /Follow the task/ })).not.toBeInTheDocument();
  });

  it("gives the step a mode of its own", async () => {
    const { user, onChange } = renderChip(FOLLOWS);
    await user.click(screen.getByRole("button", { name: /Review mode of step 5/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Manual" }));
    expect(onChange).toHaveBeenCalledWith("manual");
  });

  it("changes nothing when the mode chosen is the one it has", async () => {
    const { user, onChange } = renderChip(FOLLOWS);
    await user.click(screen.getByRole("button", { name: /Review mode of step 5/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Agent" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers to follow the task again, with the mode of the task, after a separator", async () => {
    const { user, onFollow } = renderChip(OWN, "agent");
    await user.click(screen.getByRole("button", { name: /Review mode of step 4/ }));
    expect(await screen.findByRole("separator")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Follow the task · Agent" }));
    expect(onFollow).toHaveBeenCalledOnce();
  });

  it("closes its menu on Escape and gives the focus back to the chip", async () => {
    const { user } = renderChip(OWN);
    const chip = screen.getByRole("button", { name: /Review mode of step 4/ });
    await user.click(chip);
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(chip).toHaveFocus();
  });
});
