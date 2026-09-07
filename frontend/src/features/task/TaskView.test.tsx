import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

const SEEN_KEY = "myspec.artifacts.seen:task-1";

function view(overrides: Partial<TaskSummary> = {}) {
  return renderWithStore(<TaskView taskId="task-1" />, {
    state: makeState({ tasks: [makeTask(overrides)] }),
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("TaskView", () => {
  it("puts the conversation, the composer and the header together", async () => {
    view();

    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1");
    });
  });

  it("puts the stage track under the header", () => {
    view({ stage: "tech_spec" });

    const chips = screen.getAllByRole("button", { name: "PRD" });
    expect(chips.some((chip) => chip.getAttribute("aria-haspopup") === "menu")).toBe(true);
    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("shows the steps instead of a conversation once the task is implementing", () => {
    view({ stage: "implementation", steps: [makeStep()] });

    expect(screen.getByRole("heading", { name: "Steps" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("warns above the composer when the plan stayed invalid", () => {
    view({
      stage: "plan",
      corrections: 3,
      planProblems: [{ file: "", message: "no step files were written" }],
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The plan is still invalid after three automatic corrections.",
    );
  });

  it("fetches the conversation only the first time the task is opened", async () => {
    const { rerender } = view();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledOnce();
    });

    rerender(<TaskView taskId="task-1" />);

    expect(api.getTranscript).toHaveBeenCalledOnce();
  });

  it("remembers that the artifacts of the task have been shown", async () => {
    view({ hasPrd: true, artifactVersion: 1 });

    await waitFor(() => {
      expect(localStorage.getItem(SEEN_KEY)).not.toBeNull();
    });
  });

  it("opens the panel for a tech spec of a task that never had a PRD read", async () => {
    view({ hasTechSpec: true, stage: "plan", artifactVersion: 1 });

    await waitFor(() => {
      expect(localStorage.getItem(SEEN_KEY)).not.toBeNull();
    });
  });

  it("has nothing to show, and nothing to remember, without a PRD", () => {
    view();

    expect(screen.getByText("No artifacts yet")).toBeInTheDocument();
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it("toggles the artifact panel from the header", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Artifacts" }));

    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute("aria-pressed");
  });

  it("shows nothing for a task that is no longer there", () => {
    renderWithStore(<TaskView taskId="task-1" />, { state: makeState() });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });
});
