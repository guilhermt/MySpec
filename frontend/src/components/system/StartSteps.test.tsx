import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { StartSteps, type StartStepView } from "./StartSteps";

const STEPS: StartStepView[] = [
  { id: "open", label: "Opening your data", state: "done", elapsed: "0.4s", reason: "" },
  {
    id: "clones",
    label: "Checking the clones",
    state: "running",
    elapsed: "3s",
    reason: "~/code/infra doesn't answer",
  },
  { id: "load", label: "Loading your work", state: "todo", elapsed: "", reason: "" },
];

describe("StartSteps", () => {
  it("lists each step in order", () => {
    renderWithStore(<StartSteps steps={STEPS} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Opening your data0.4s",
      "Checking the clones3s · ~/code/infra doesn't answer",
      "Loading your work",
    ]);
  });

  it("marks only the running step with a spinner", () => {
    const { container } = renderWithStore(<StartSteps steps={STEPS} />);
    expect(container.querySelectorAll("[data-tone='work']")).toHaveLength(1);
    const [, running] = screen.getAllByRole("listitem");
    expect(running && within(running).getByText("Checking the clones")).toHaveClass("font-medium");
  });

  it("draws the circle of a step still to do", () => {
    const { container } = renderWithStore(<StartSteps steps={STEPS} />);
    expect(container.querySelectorAll("[data-state='todo']")).toHaveLength(1);
  });
});
