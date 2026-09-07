import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactPanel } from "@/features/task/ArtifactPanel";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

const state = makeState();

function panel(overrides: Partial<TaskSummary> = {}) {
  return renderWithStore(<ArtifactPanel task={makeTask(overrides)} />, { state });
}

const STEP_FILE = "---\nrepository: web\n---\n# Step 1: Add the login form\n";

describe("ArtifactPanel", () => {
  it("says there is nothing to read before the PRD exists", () => {
    panel();

    expect(screen.getByText("No artifacts yet")).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });

  it("offers only the artifacts the task already has", () => {
    panel({ hasPrd: true });

    expect(screen.getByRole("button", { name: "PRD" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tech spec" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Steps" })).toBeDisabled();
  });

  it("renders the PRD once it is written", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    panel({ hasPrd: true, artifactVersion: 1 });

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Login");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "PRD.md");
  });

  it("reads the file again when the agent rewrites it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("first");
    const task = makeTask({ hasPrd: true, artifactVersion: 1 });
    const { rerender } = renderWithStore(<ArtifactPanel task={task} />, { state });
    expect(await screen.findByTestId("markdown")).toHaveTextContent("first");

    vi.mocked(api.readArtifact).mockResolvedValue("second");
    rerender(<ArtifactPanel task={{ ...task, artifactVersion: 2 }} />);

    expect(await screen.findByTestId("markdown")).toHaveTextContent("second");
    expect(api.readArtifact).toHaveBeenCalledTimes(2);
  });

  it("opens the document the current stage works from", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Spec");
    panel({ stage: "plan", hasPrd: true, hasTechSpec: true, artifactVersion: 2 });

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Spec");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "tech-spec.md");
  });

  it("lets the user switch to another artifact", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    const { user } = panel({ hasPrd: true, hasTechSpec: true, artifactVersion: 1 });
    await screen.findByTestId("markdown");

    vi.mocked(api.readArtifact).mockResolvedValue("# Spec");
    await user.click(screen.getByRole("button", { name: "Tech spec" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Spec");
    expect(api.readArtifact).toHaveBeenLastCalledWith("task-1", "tech-spec.md");
  });

  it("shows the steps of a task in implementation, with their count", () => {
    panel({ stage: "implementation", hasPrd: true, hasTechSpec: true, steps: [makeStep()] });

    expect(screen.getByRole("button", { name: "Steps (1)" })).toBeInTheDocument();
    expect(screen.getByText("Add the login form")).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });

  it("marks the step being run in the list", () => {
    panel({
      stage: "implementation",
      steps: [makeStep({ status: "implementing" })],
      currentStep: 1,
    });

    expect(screen.getByText("Implementing")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveAttribute("aria-current", "step");
  });

  it("reads one step file, with its header shown as metadata", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue(STEP_FILE);
    const { user } = panel({
      stage: "implementation",
      steps: [makeStep()],
      artifactVersion: 3,
    });

    await user.click(screen.getByRole("button", { name: /Add the login form/ }));

    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "steps/1-add-the-login-form.md");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Step 1: Add the login form");
    expect(screen.getByText("web")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← Steps" }));

    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("shows a failed read and lets it be dismissed", async () => {
    vi.mocked(api.readArtifact).mockRejectedValue(new Error("read failed"));
    const { user } = panel({ hasPrd: true, artifactVersion: 1 });

    expect(await screen.findByRole("status")).toHaveTextContent("read failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
