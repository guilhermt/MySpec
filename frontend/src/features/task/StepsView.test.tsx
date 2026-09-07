import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepsView } from "@/features/task/StepsView";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

const state = makeState();

describe("StepsView", () => {
  it("shows the plan the task is going to be built from", () => {
    renderWithStore(
      <StepsView task={makeTask({ stage: "implementation", steps: [makeStep()] })} />,
      { state },
    );

    expect(screen.getByRole("heading", { name: "Steps" })).toBeInTheDocument();
    expect(
      screen.getByText("Planned in order. Running them comes in a later version."),
    ).toBeInTheDocument();
    expect(screen.getByText("Add the login form")).toBeInTheDocument();
  });

  it("says so when the folder holds no step at all", () => {
    renderWithStore(<StepsView task={makeTask({ stage: "implementation" })} />, { state });

    expect(screen.getByText("No steps were found.")).toBeInTheDocument();
  });

  it("shows the problems of a plan that stopped being valid", () => {
    renderWithStore(
      <StepsView
        task={makeTask({
          stage: "implementation",
          planProblems: [{ file: "", message: "step 2 is missing" }],
        })}
      />,
      { state },
    );

    expect(screen.getByRole("alert")).toHaveTextContent("(plan): step 2 is missing");
    expect(screen.queryByText("No steps were found.")).not.toBeInTheDocument();
  });
});
