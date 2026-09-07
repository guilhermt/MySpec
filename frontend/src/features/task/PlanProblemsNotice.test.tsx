import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanProblemsNotice } from "@/features/task/PlanProblemsNotice";
import { MAX_CORRECTIONS } from "@/features/task/stage-actions";
import type { TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeTask } from "@/test/wails-mock";

const PROBLEMS = [
  { file: "", message: "no step files were written" },
  { file: "2-api.md", message: "no repository" },
];

function stuck(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "plan",
    planProblems: PROBLEMS,
    corrections: MAX_CORRECTIONS,
    ...overrides,
  });
}

describe("PlanProblemsNotice", () => {
  it("hands the plan back once the corrections ran out", () => {
    renderWithStore(<PlanProblemsNotice task={stuck()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The plan is still invalid after three automatic corrections.",
    );
    expect(screen.getByText("(plan): no step files were written")).toBeInTheDocument();
    expect(screen.getByText("2-api.md: no repository")).toBeInTheDocument();
  });

  it("stays quiet while the app still has corrections left", () => {
    renderWithStore(<PlanProblemsNotice task={stuck({ corrections: MAX_CORRECTIONS - 1 })} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stays quiet when the plan is valid", () => {
    renderWithStore(<PlanProblemsNotice task={stuck({ planProblems: [] })} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stays quiet outside the plan stage", () => {
    renderWithStore(<PlanProblemsNotice task={stuck({ stage: "implementation" })} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
