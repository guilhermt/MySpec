import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchivedTaskView } from "@/features/history/ArchivedTaskView";
import { type ArchivedTask, api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeState } from "@/test/wails-mock";

const STEP_FILE = "---\nrepository: web\n---\n# Step 1: Add the login form\n";

function view(overrides: Partial<ArchivedTask> = {}) {
  const task = makeArchivedTask(overrides);
  return renderWithStore(<ArchivedTaskView taskId={task.id} />, {
    state: makeState({ history: [task] }),
    ui: { historyOpen: true, openArchivedId: task.id },
  });
}

describe("ArchivedTaskView", () => {
  it("names the task and says it is archived", async () => {
    view();

    expect(await screen.findByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("1 step")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "#12" })).toBeInTheDocument();
  });

  it("opens on the PRD and reads it back from the artifacts", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");

    view();

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Login");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "PRD.md");
  });

  it("lets the user read the tech spec and the steps", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    const { user } = view();
    await screen.findByTestId("markdown");

    vi.mocked(api.readArtifact).mockResolvedValue("# Spec");
    await user.click(screen.getByRole("button", { name: "Tech spec" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Spec");
    expect(api.readArtifact).toHaveBeenLastCalledWith("task-1", "tech-spec.md");

    await user.click(screen.getByRole("button", { name: "Steps (1)" }));

    expect(screen.getByText("Add the login form")).toBeInTheDocument();
  });

  it("reads one step file and comes back to the list", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue(STEP_FILE);
    const { user } = view({ hasPrd: false, hasTechSpec: false });

    await user.click(screen.getByRole("button", { name: /Add the login form/ }));

    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "steps/1-add-the-login-form.md");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Step 1: Add the login form");

    await user.click(screen.getByRole("button", { name: "← Steps" }));

    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("reads a report of the agent review of a step and comes back to the list", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Nothing to change");
    const { user } = view({
      hasPrd: false,
      hasTechSpec: false,
      steps: [
        {
          number: 1,
          file: "1-add-the-login-form.md",
          title: "Add the login form",
          repository: "web",
          reports: [{ pass: 1, file: "1-review-1.md", clean: true }],
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Review 1 · clean" }));

    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "step-reviews/1-review-1.md");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Nothing to change");
    expect(screen.getByText("Step 1 · Review 1 · clean")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← Steps" }));

    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review 1 · clean" })).toBeInTheDocument();
  });

  it("offers only the documents the task left behind", () => {
    view({ hasTechSpec: false, steps: [] });

    expect(screen.getByRole("button", { name: "PRD" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tech spec" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Steps" })).toBeDisabled();
  });

  it("shows a failed read and lets it be dismissed", async () => {
    vi.mocked(api.readArtifact).mockRejectedValue(new Error("read failed"));
    const { user } = view();

    expect(await screen.findByRole("status")).toHaveTextContent("read failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("goes back to the history", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "← History" }));

    expect(useAppStore.getState().openArchivedId).toBeNull();
    expect(useAppStore.getState().historyOpen).toBe(true);
  });

  it("offers the deletion of the archived task", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "This removes the archived task and its documents from the history.",
    );
    expect(api.previewDelete).not.toHaveBeenCalled();
  });

  it("shows nothing for a task the history no longer has", () => {
    const { container } = renderWithStore(<ArchivedTaskView taskId="gone" />, {
      state: makeState(),
    });

    expect(container).not.toHaveTextContent("Archived");
    expect(api.readArtifact).not.toHaveBeenCalled();
  });
});
