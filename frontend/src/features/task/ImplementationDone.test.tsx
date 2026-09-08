import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImplementationDone } from "@/features/task/ImplementationDone";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

describe("ImplementationDone", () => {
  it("says every step is committed, and where the commits are", () => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 0,
      steps: [
        makeStep({ status: "done" }),
        makeStep({
          number: 2,
          file: "2-wire-the-api.md",
          status: "done",
          repository: "api",
          repoPath: "/home/dev/projects/api",
        }),
      ],
    });

    renderWithStore(<ImplementationDone task={task} />, { state: makeState({ tasks: [task] }) });

    expect(screen.getByText("Every step is committed")).toBeInTheDocument();
    expect(screen.getByText("2 steps in web, api.")).toBeInTheDocument();
    expect(screen.getByText(/PR stage doesn't exist in this version/)).toBeInTheDocument();
  });

  it("counts one step as one, and names each repository once", () => {
    const task = makeTask({ stage: "implementation", currentStep: 0, steps: [makeStep()] });

    renderWithStore(<ImplementationDone task={task} />, { state: makeState({ tasks: [task] }) });

    expect(screen.getByText("1 step in web.")).toBeInTheDocument();
  });
});
