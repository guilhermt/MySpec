import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepList } from "@/features/task/StepList";
import { renderWithStore } from "@/test/render";
import { makeSituation, makeState, makeStep } from "@/test/wails-mock";

const state = makeState();

// The dot has no role of its own: it is the hidden element that carries the tone.
function dotOf(element: HTMLElement): Element | null {
  return element.querySelector('[aria-hidden="true"]');
}

describe("StepList", () => {
  it("lists the steps in order, with the name the tree gives the repository", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({ repository: "apps/web", repoPath: "/home/dev/projects/web" }),
          makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" }),
        ]}
        problems={[]}
        currentStep={0}
      />,
      { state },
    );

    expect(screen.getByText("Add the login form")).toBeInTheDocument();
    expect(screen.getByText("Check the token")).toBeInTheDocument();
    expect(screen.getAllByText("web")).toHaveLength(2);
    expect(screen.getAllByText("Not started")).toHaveLength(2);
  });

  it("shows the value of the file when it names no repository of the task", () => {
    renderWithStore(
      <StepList
        steps={[makeStep({ repository: "mobile", repoPath: "" })]}
        problems={[]}
        currentStep={0}
      />,
      { state },
    );

    expect(screen.getByText("mobile")).toHaveClass("text-destructive");
  });

  it("opens a step when the list is there to be read", async () => {
    const onOpen = vi.fn();
    const step = makeStep();
    const { user } = renderWithStore(
      <StepList steps={[step]} problems={[]} currentStep={1} onOpen={onOpen} />,
      {
        state,
      },
    );

    await user.click(screen.getByRole("button", { name: /Add the login form/ }));

    expect(onOpen).toHaveBeenCalledWith(step);
  });

  it("lets a step that has not started pick its model", async () => {
    const onModelChange = vi.fn();
    const step = makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" });
    const { user } = renderWithStore(
      <StepList
        steps={[makeStep({ status: "done" }), step]}
        problems={[]}
        currentStep={1}
        onOpen={vi.fn()}
        onModelChange={onModelChange}
      />,
      { state },
    );

    await user.click(screen.getByRole("button", { name: "Step 2 model: Opus 5 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));

    // The picker hands back the value it was given with the choice changed, and
    // the value of a step is the step itself.
    expect(onModelChange).toHaveBeenCalledWith(
      step,
      expect.objectContaining({ model: "claude-opus-5", effort: "xhigh" }),
    );
  });

  it("sets a step with a choice of its own apart from one that follows Implementation", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({ adjusted: true }),
          makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" }),
        ]}
        problems={[]}
        currentStep={0}
        onOpen={vi.fn()}
        onModelChange={vi.fn()}
      />,
      { state },
    );

    expect(screen.getByRole("button", { name: "Step 1 model: Opus 5 · high" })).not.toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.getByRole("button", { name: "Step 2 model: Opus 5 · high" })).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("shows the model of a step that started as a value", () => {
    renderWithStore(
      <StepList
        steps={[makeStep({ status: "implementing", modelEditable: false })]}
        problems={[]}
        currentStep={1}
        onOpen={vi.fn()}
        onModelChange={vi.fn()}
      />,
      { state },
    );

    expect(screen.getByText("Opus 5 · high")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /model:/ })).not.toBeInTheDocument();
  });

  it("lets a step that has not started pick its review mode", async () => {
    const onReviewModeChange = vi.fn();
    const step = makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" });
    const { user } = renderWithStore(
      <StepList
        steps={[makeStep({ status: "done", reviewModeEditable: false }), step]}
        problems={[]}
        currentStep={1}
        onOpen={vi.fn()}
        onReviewModeChange={onReviewModeChange}
      />,
      { state },
    );

    expect(screen.queryByRole("button", { name: /Step 1 review mode:/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Step 2 review mode: Manual" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Agent" }));

    expect(onReviewModeChange).toHaveBeenCalledWith(step, "agent");
  });

  it("sets a step with a mode of its own apart from one that follows the task", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({ reviewMode: "agent", reviewModeAdjusted: true }),
          makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" }),
        ]}
        problems={[]}
        currentStep={0}
        onOpen={vi.fn()}
        onReviewModeChange={vi.fn()}
      />,
      { state },
    );

    expect(screen.getByRole("button", { name: "Step 1 review mode: Agent" })).not.toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.getByRole("button", { name: "Step 2 review mode: Manual" })).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("says why a started step was reviewed by the user", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({
            status: "done",
            reviewModeEditable: false,
            reviewFallback: "taken_over",
          }),
          makeStep({
            number: 2,
            file: "2-check-the-token.md",
            title: "Check the token",
            status: "agent_review",
            reviewMode: "agent",
            reviewModeEditable: false,
          }),
        ]}
        problems={[]}
        currentStep={2}
        onOpen={vi.fn()}
        onReviewModeChange={vi.fn()}
      />,
      { state },
    );

    const [taken, held] = screen.getAllByRole("listitem") as [HTMLElement, HTMLElement];
    expect(taken).toHaveTextContent("Manual");
    expect(within(taken).getByText("Taken over from the agent review")).toBeInTheDocument();
    expect(held).toHaveTextContent("Agent");
    expect(within(held).queryByText(/Taken over|didn't/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review mode:/ })).not.toBeInTheDocument();
  });

  it("opens a report of the agent review", async () => {
    const onOpenReport = vi.fn();
    const report = { pass: 1, file: "1-review-1.md", clean: false };
    const step = makeStep({
      status: "addressing_review",
      reviewMode: "agent",
      reviewModeEditable: false,
      reviewRound: 1,
      reports: [report, { pass: 2, file: "1-review-2.md", clean: true }],
    });
    const { user } = renderWithStore(
      <StepList
        steps={[step]}
        problems={[]}
        currentStep={1}
        onOpen={vi.fn()}
        onOpenReport={onOpenReport}
      />,
      { state },
    );

    expect(screen.getByRole("button", { name: "Review 2 · clean" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));

    expect(onOpenReport).toHaveBeenCalledWith(step, report);
  });

  it("is a plain list when there is nothing to open", () => {
    renderWithStore(<StepList steps={[makeStep()]} problems={[]} currentStep={0} />, { state });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the state of every step, and marks the one being run", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({ status: "awaiting_review" }),
          makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" }),
        ]}
        problems={[]}
        currentStep={1}
      />,
      { state },
    );

    expect(screen.getByText("Awaiting review")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();

    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveAttribute("aria-current", "step");
    expect(second).not.toHaveAttribute("aria-current");
  });

  it("colours the step being run with its situation, and every other step with its state", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({ status: "done" }),
          makeStep({
            number: 2,
            file: "2-check-the-token.md",
            title: "Check the token",
            status: "blocked",
            block: { reason: "dirty_worktree", detail: "", files: 2 },
          }),
          makeStep({ number: 3, file: "3-log-out.md", title: "Log out" }),
        ]}
        problems={[]}
        currentStep={2}
        situation={makeSituation({
          kind: "step_blocked",
          group: "error",
          place: { kind: "step", stage: "", step: 2, repoPath: "", repository: "" },
        })}
      />,
      { state },
    );

    const [done, blocked, next] = screen.getAllByRole("listitem") as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(dotOf(blocked)).toHaveClass("bg-destructive");
    expect(dotOf(done)).toHaveClass("bg-[var(--status-success)]");
    expect(dotOf(next)).toHaveClass("bg-muted-foreground");
  });

  it("shows what a committed step delivered", () => {
    renderWithStore(
      <StepList
        steps={[
          makeStep({
            status: "done",
            commitSha: "9f1c2ab3d4e5f60718293a4b5c6d7e8f90123456",
            commitSubject: "Render the sign-in fields",
          }),
          makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" }),
        ]}
        problems={[]}
        currentStep={2}
      />,
      { state },
    );

    expect(screen.getByText("9f1c2ab")).toBeInTheDocument();
    expect(screen.getByText("Render the sign-in fields")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("says what keeps the step files from being a plan", () => {
    renderWithStore(
      <StepList
        steps={[]}
        currentStep={0}
        problems={[
          { file: "", message: "step 2 is missing" },
          { file: "1-add-the-login-form.md", message: "no repository" },
        ]}
      />,
      { state },
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The step files aren't a valid plan");
    expect(alert).toHaveTextContent("(plan): step 2 is missing");
    expect(alert).toHaveTextContent("1-add-the-login-form.md: no repository");
  });
});
