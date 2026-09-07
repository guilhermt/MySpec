import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepList } from "@/features/task/StepList";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep } from "@/test/wails-mock";

const state = makeState();

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
