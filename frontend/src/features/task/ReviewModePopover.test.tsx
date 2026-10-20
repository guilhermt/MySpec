import { screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeStep, makeTask } from "@/test/wails-mock";
import { ReviewModePopover } from "./ReviewModePopover";

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
        Review mode chip
      </button>
      <ReviewModePopover
        task={task}
        open={open}
        onOpenChange={setOpen}
        anchor={anchor}
        {...(returnElsewhere ? { finalFocus: chip } : {})}
      />
    </>
  );
}

const STEPS = [
  makeStep({ number: 3, status: "implementing" }),
  makeStep({ number: 4, status: "not_started", reviewModeAdjusted: true, reviewMode: "manual" }),
  makeStep({ number: 5, status: "not_started" }),
  makeStep({ number: 6, status: "not_started" }),
];

async function open(task: TaskSummary = makeTask({ reviewMode: "agent", steps: STEPS })) {
  const rendered = renderWithStore(<Subject task={task} />);
  await rendered.user.click(screen.getByRole("button", { name: "More actions" }));
  await screen.findByRole("dialog", { name: "Review mode" });
  return rendered;
}

const stepGroup = () => screen.getByRole("radiogroup", { name: "Review mode of the task" });
const prGroup = () => screen.getByRole("radiogroup", { name: "PR review mode of the task" });
const agent = () => within(stepGroup()).getByRole("radio", { name: /^Agent/ });
const manual = () => within(stepGroup()).getByRole("radio", { name: /^Manual/ });
const prAgent = () => within(prGroup()).getByRole("radio", { name: /^Agent/ });
const prManual = () => within(prGroup()).getByRole("radio", { name: /^Manual/ });

describe("ReviewModePopover", () => {
  it("offers the two modes, each with what it does, in a named group", async () => {
    await open();
    expect(screen.getByRole("radiogroup", { name: "Review mode of the task" })).toBeInTheDocument();
    expect(agent()).toHaveAccessibleName(
      "Agent An agent reviews each step with the implementer; clean steps are committed.",
    );
    expect(manual()).toHaveAccessibleName(
      "Manual You review each step in VS Code, stage the files and approve.",
    );
  });

  it("offers the PR review in a group of its own, under its own caption", async () => {
    await open();
    expect(screen.getByText("Step review")).toBeInTheDocument();
    expect(screen.getByText("PR review")).toBeInTheDocument();
    expect(prAgent()).toHaveAccessibleName(
      "Agent A reviewer and an implementer iterate on the pull request; a clean report is pushed.",
    );
    expect(prManual()).toHaveAccessibleName(
      "Manual You decide each finding, stage the fixes in VS Code and approve each push.",
    );
    expect(prManual()).toHaveAttribute("aria-checked", "true");
    expect(prGroup()).toHaveAccessibleDescription(
      "Applies to the review of the pull request, before it starts.",
    );
  });

  it("saves the PR review mode chosen, apart from the steps", async () => {
    const { user } = await open();
    await user.click(prAgent());
    expect(api.setPRReviewMode).toHaveBeenCalledWith("task-1", "agent");
    expect(api.setReviewMode).not.toHaveBeenCalled();
  });

  it("says in its own note that the PR review mode wasn't saved", async () => {
    vi.mocked(api.setPRReviewMode).mockRejectedValueOnce(new Error("started"));
    const { user } = await open();
    await user.click(prAgent());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save the mode · Try again",
    );
    expect(prManual()).toHaveAttribute("aria-checked", "true");
    expect(stepGroup()).toHaveAccessibleDescription(
      "Applies to the steps not started that follow the task: 5, 6. Step 4 has its own mode.",
    );
  });

  it("can't change the PR review mode once it started, and says why", async () => {
    const { user } = await open(
      makeTask({ reviewMode: "agent", steps: STEPS, prReviewModeEditable: false }),
    );
    expect(prGroup()).toHaveAttribute("aria-disabled", "true");
    expect(prGroup()).toHaveAccessibleDescription(
      "The PR review has started, so the mode can't change.",
    );
    await user.click(prAgent());
    expect(api.setPRReviewMode).not.toHaveBeenCalled();
    expect(manual()).not.toHaveAttribute("aria-disabled");
  });

  it("says the review fell back to Manual, and gives the focus to the steps' group only when it can change", async () => {
    await open(
      makeTask({
        reviewMode: "agent",
        reviewModeEditable: false,
        steps: STEPS,
        prReviewMode: "manual",
        prReviewModeEditable: false,
        prReviewFallback: "rounds_exhausted",
      }),
    );
    expect(prGroup()).toHaveAccessibleDescription(
      "The review fell back to Manual: the agent review didn't come clean after five rounds.",
    );
  });

  it("opens the focus on the PR group when the steps can't change", async () => {
    await open(
      makeTask({
        reviewMode: "agent",
        reviewModeEditable: false,
        steps: [makeStep({ number: 1, status: "done" })],
        prReviewMode: "agent",
      }),
    );
    await waitFor(() => expect(prAgent()).toHaveFocus());
  });

  it("checks the mode of the task and gives it the focus", async () => {
    await open();
    expect(agent()).toHaveAttribute("aria-checked", "true");
    expect(manual()).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(agent()).toHaveFocus());
  });

  it("says what the choice applies to, as the description of the group", async () => {
    await open();
    expect(stepGroup()).toHaveAccessibleDescription(
      "Applies to the steps not started that follow the task: 5, 6. Step 4 has its own mode.",
    );
  });

  it("says a choice before the plan applies to the steps the plan writes", async () => {
    await open(makeTask({ reviewMode: "manual", steps: [] }));
    expect(screen.getByText("Applies to the steps the plan writes.")).toBeInTheDocument();
  });

  it("saves the mode chosen", async () => {
    const { user } = await open();
    await user.click(manual());
    expect(api.setReviewMode).toHaveBeenCalledWith("task-1", "manual");
  });

  it("changes the mode with the arrows", async () => {
    const { user } = await open();
    await waitFor(() => expect(agent()).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(api.setReviewMode).toHaveBeenCalledWith("task-1", "manual");
  });

  it("saves with the spinner in place of the check and Saving… in the note", async () => {
    let finish = () => {};
    vi.mocked(api.setReviewMode).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = await open();
    await user.click(manual());
    expect(manual()).toHaveAttribute("aria-checked", "true");
    expect(manual()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    finish();
    await waitFor(() => expect(screen.queryByText("Saving…")).not.toBeInTheDocument());
    expect(stepGroup()).toHaveAccessibleDescription(
      "Applies to the steps not started that follow the task: 5, 6. Step 4 has its own mode.",
    );
  });

  it("says in the note that the mode wasn't saved, and Try again makes the choice again", async () => {
    vi.mocked(api.setReviewMode).mockRejectedValueOnce(new Error("the step started"));
    const { user } = await open();
    await user.click(manual());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save the mode · Try again",
    );
    expect(agent()).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.setReviewMode).toHaveBeenLastCalledWith("task-1", "manual");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("clears a saved failure when it reopens, since it stays mounted while closed", async () => {
    vi.mocked(api.setReviewMode).mockRejectedValueOnce(new Error("the step started"));
    const { user } = await open();
    await user.click(manual());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save the mode · Try again",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("dialog", { name: "Review mode" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("can't change the mode when no step is left to start, and says why", async () => {
    const task = makeTask({
      reviewMode: "agent",
      reviewModeEditable: false,
      steps: [makeStep({ number: 1, status: "done" })],
    });
    const { user } = await open(task);
    const group = stepGroup();
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAccessibleDescription(
      "No step is left to start, so the mode can't change.",
    );
    await user.click(manual());
    expect(api.setReviewMode).not.toHaveBeenCalled();
    expect(agent()).toHaveAttribute("aria-checked", "true");
  });

  it("says a One-Shot task applies the mode to its implementation", async () => {
    await open(makeTask({ mode: "one_shot", reviewMode: "agent", steps: [] }));
    expect(stepGroup()).toHaveAccessibleDescription(
      "Applies to the implementation, before it starts.",
    );
  });

  it("closes on Escape and returns the focus to the anchor", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });

  it("returns the focus to finalFocus when given", async () => {
    const task = makeTask({ reviewMode: "agent", steps: STEPS });
    const { user } = renderWithStore(<Subject task={task} returnElsewhere />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("dialog", { name: "Review mode" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Review mode chip" })).toHaveFocus();
  });
});
