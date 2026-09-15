import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepTabs } from "@/features/task/StepTabs";
import type { Situation, Step, TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import { makeSituation, makeState, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

const REVIEWER_QUESTION = makeSituation({
  id: "reviewer-question",
  kind: "question",
  place: { kind: "step_review", stage: "", step: 1, repoPath: "", repository: "" },
});

function tabs(
  step: Partial<Step>,
  overrides: Partial<TaskSummary> = {},
  ui: NonNullable<StoreOptions["ui"]> = {},
) {
  const current = makeStep({ status: "agent_review", reviewMode: "agent", reviewPass: 1, ...step });
  const task = makeTask({
    stage: "implementation",
    steps: [current],
    currentStep: 1,
    sessionStatus: "working",
    ...overrides,
  });
  return renderWithStore(<StepTabs task={task} step={current} />, {
    state: makeState({ tasks: [task] }),
    ui,
  });
}

// The dot has no role of its own: it is the hidden element that carries the tone.
function dotOf(tab: HTMLElement): Element | null {
  return tab.querySelector('[aria-hidden="true"]');
}

function situations(...list: Situation[]): Partial<TaskSummary> {
  return { situations: list };
}

describe("StepTabs", () => {
  it("shows nothing while the step has no reviewer", () => {
    const { container } = tabs({ status: "implementing", reviewer: null });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the implementer and the reviewer, on the implementer until the user picks", () => {
    tabs(
      { reviewer: makeStepReviewer({ sessionStatus: "working" }) },
      { sessionStatus: "waiting" },
    );

    expect(screen.getByRole("tablist", { name: "Conversations" })).toBeInTheDocument();
    const implementer = screen.getByRole("tab", { name: "Implementer Waiting" });
    expect(implementer).toHaveAttribute("aria-selected", "true");
    expect(within(implementer).getByText("Waiting")).toHaveClass("sr-only");
    expect(dotOf(implementer)).toHaveClass("bg-muted-foreground");
    const reviewer = screen.getByRole("tab", { name: "Reviewer Working" });
    expect(reviewer).toHaveAttribute("aria-selected", "false");
    expect(dotOf(reviewer)).toHaveClass("bg-[var(--status-working)]");
  });

  it("moves to the tab the user picks", async () => {
    const { user } = tabs({ reviewer: makeStepReviewer() });

    await user.click(screen.getByRole("tab", { name: /Reviewer/ }));

    expect(useAppStore.getState().openStepTab["task-1|1"]).toBe("reviewer");
    expect(screen.getByRole("tab", { name: /Reviewer/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Implementer/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("shows the situation of a conversation next to its name, in its tone", () => {
    tabs(
      { reviewer: makeStepReviewer({ sessionStatus: "needs_answer" }) },
      situations(
        REVIEWER_QUESTION,
        makeSituation({
          id: "implementer-error",
          kind: "session_error",
          group: "error",
          place: { kind: "step", stage: "", step: 1, repoPath: "", repository: "" },
        }),
      ),
    );

    const reviewer = screen.getByRole("tab", { name: "Reviewer Question" });
    expect(within(reviewer).getByText("Question")).not.toHaveClass("sr-only");
    expect(dotOf(reviewer)).toHaveClass("bg-[var(--status-attention)]");
    const implementer = screen.getByRole("tab", { name: "Implementer Session error" });
    expect(dotOf(implementer)).toHaveClass("bg-destructive");
  });

  it("highlights the tab the user is not on when its situation starts", () => {
    tabs(
      { reviewer: makeStepReviewer({ sessionStatus: "needs_answer" }) },
      situations(REVIEWER_QUESTION),
      { flashing: new Set([REVIEWER_QUESTION.id]) },
    );

    const reviewer = screen.getByRole("tab", { name: /Reviewer/ });
    expect(reviewer).toHaveClass("attention-flash");
    expect(reviewer).toHaveAttribute("data-tone", "attention");
    expect(screen.getByRole("tab", { name: /Implementer/ })).not.toHaveClass("attention-flash");
  });

  it("does not highlight the tab the user is on", () => {
    tabs(
      { reviewer: makeStepReviewer({ sessionStatus: "needs_answer" }) },
      situations(REVIEWER_QUESTION),
      { flashing: new Set([REVIEWER_QUESTION.id]), openStepTab: { "task-1|1": "reviewer" } },
    );

    const reviewer = screen.getByRole("tab", { name: /Reviewer/ });
    expect(reviewer).toHaveAttribute("aria-selected", "true");
    expect(reviewer).not.toHaveClass("attention-flash");
    expect(reviewer).not.toHaveAttribute("data-tone");
  });
});
