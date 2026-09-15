import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactPanel } from "@/features/task/ArtifactPanel";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeSituation, makeState, makeStep, makeTask } from "@/test/wails-mock";

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
    expect(screen.getByRole("button", { name: "PR" })).toBeDisabled();
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

  it("colours the step being run in the list with its situation", () => {
    panel({
      stage: "implementation",
      steps: [
        makeStep({ status: "blocked", block: { reason: "git_failed", detail: "", files: 0 } }),
      ],
      currentStep: 1,
      situations: [
        makeSituation({
          kind: "step_blocked",
          group: "error",
          place: { kind: "step", stage: "", step: 1, repoPath: "", repository: "" },
        }),
      ],
    });

    expect(screen.getByRole("listitem").querySelector('[aria-hidden="true"]')).toHaveClass(
      "bg-destructive",
    );
  });

  it("changes the model of a step from the list of steps", async () => {
    const { user } = panel({
      stage: "implementation",
      steps: [
        makeStep({ status: "done" }),
        makeStep({ number: 2, file: "2-check-the-token.md", title: "Check the token" }),
      ],
      currentStep: 1,
    });

    await user.click(screen.getByRole("button", { name: "Step 2 model: Opus 5 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));

    expect(api.setStepModel).toHaveBeenCalledWith("task-1", 2, "claude-opus-5", "xhigh");
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

  it("opens a report of the agent review under its step and comes back to the steps", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Findings");
    const { user } = panel({
      stage: "implementation",
      steps: [
        makeStep({
          status: "addressing_review",
          reviewMode: "agent",
          reviewRound: 1,
          reports: [{ pass: 1, file: "1-review-1.md", clean: false }],
        }),
      ],
      currentStep: 1,
      artifactVersion: 3,
    });

    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));

    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "step-reviews/1-review-1.md");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Findings");
    expect(screen.getByText("Step 1 · Review 1 · changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Steps (1)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "← Steps" }));

    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review 1 · changes" })).toBeInTheDocument();
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

  // The pull request documents live in the pr folder, grouped by repository.
  const DRAFT = { title: "Add the login form", body: "Closes #12", file: "web-draft.md" };

  function prTask() {
    return {
      stage: "pr",
      repos: [
        makeRepoPR({
          draft: DRAFT,
          reports: [
            { pass: 1, file: "web-review-1.md", clean: false },
            { pass: 2, file: "web-review-2.md", clean: true },
          ],
        }),
        makeRepoPR({
          repository: "api",
          repoPath: "/home/dev/projects/api",
          slug: "api",
          draft: { title: "Wire the api", body: "why", file: "api-draft.md" },
        }),
      ],
    };
  }

  it("opens on the PR tab in the PR stage, one section per repository", () => {
    panel(prTask());

    expect(screen.getByRole("button", { name: "PR" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "web" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "api" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Draft" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Pass 1 · changes requested" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pass 2 · nothing to change" })).toBeInTheDocument();
  });

  it("reads a pull request document out of the pr folder", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Add the login form");
    const { user } = panel(prTask());

    await user.click(screen.getAllByRole("button", { name: "Draft" })[0] as HTMLElement);

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Add the login form");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "pr/web-draft.md");
  });

  it("comes back from a pull request document to the list", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Add the login form");
    const { user } = panel(prTask());

    await user.click(screen.getAllByRole("button", { name: "Draft" })[0] as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "← PR" }));

    expect(screen.getByRole("heading", { name: "web" })).toBeInTheDocument();
  });

  it("has no PR tab before anything of a pull request is written", () => {
    panel({ stage: "pr", repos: [makeRepoPR({ status: "preparing" })] });

    expect(screen.getByRole("button", { name: "PR" })).toBeDisabled();
  });

  // A One-Shot task has one document, and its single step lists the reports of its review.
  const ONE_SHOT = { mode: "one_shot", repoPath: "/home/dev/projects/web" };
  const REPORT = { pass: 1, file: "1-review-1.md", clean: false };

  function oneShotStep(reports = [REPORT]) {
    return makeStep({ file: "one-shot.md", reports });
  }

  it("offers the One-Shot document and the PR, and nothing of the structured flow", () => {
    panel({ ...ONE_SHOT, stage: "one_shot", hasOneShot: true });

    expect(screen.getByRole("button", { name: "One-Shot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "PR" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "PRD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tech spec" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Steps/ })).not.toBeInTheDocument();
  });

  it("says where the One-Shot document will appear before the agent writes it", () => {
    panel({ ...ONE_SHOT, stage: "one_shot" });

    expect(screen.getByRole("button", { name: "One-Shot" })).toBeDisabled();
    expect(
      screen.getByText("The One-Shot document will appear here as soon as the agent writes it."),
    ).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });

  it("renders the One-Shot document once it is written", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Add login — One-Shot");
    panel({ ...ONE_SHOT, stage: "one_shot", hasOneShot: true, artifactVersion: 1 });

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Add login — One-Shot");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "one-shot.md");
  });

  it("opens a report of the review above the One-Shot document and comes back to it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Findings");
    const { user } = panel({
      ...ONE_SHOT,
      stage: "implementation",
      hasOneShot: true,
      steps: [oneShotStep()],
      currentStep: 1,
      artifactVersion: 3,
    });

    const reviews = screen.getByRole("navigation", { name: "Reviews" });
    expect(reviews).toHaveTextContent("Review 1 · changes");

    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));

    expect(api.readArtifact).toHaveBeenLastCalledWith("task-1", "step-reviews/1-review-1.md");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Findings");
    expect(screen.getByText("Review 1 · changes")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Reviews" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← One-Shot" }));

    expect(api.readArtifact).toHaveBeenLastCalledWith("task-1", "one-shot.md");
    expect(screen.getByRole("button", { name: "Review 1 · changes" })).toBeInTheDocument();
  });

  it("comes back to the One-Shot document when the report it was on is gone", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Findings");
    const task = makeTask({
      ...ONE_SHOT,
      stage: "implementation",
      hasOneShot: true,
      steps: [oneShotStep()],
      artifactVersion: 3,
    });
    const { user, rerender } = renderWithStore(<ArtifactPanel task={task} />, { state });
    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));
    expect(await screen.findByRole("button", { name: "← One-Shot" })).toBeInTheDocument();

    rerender(<ArtifactPanel task={{ ...task, steps: [oneShotStep([])] }} />);

    expect(screen.queryByRole("button", { name: "← One-Shot" })).not.toBeInTheDocument();
    expect(api.readArtifact).toHaveBeenLastCalledWith("task-1", "one-shot.md");
  });

  it("opens a One-Shot task in the PR stage on its pull request documents", () => {
    panel({
      ...ONE_SHOT,
      stage: "pr",
      hasOneShot: true,
      steps: [oneShotStep([])],
      repos: [makeRepoPR({ draft: DRAFT })],
    });

    expect(screen.getByRole("button", { name: "PR" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "One-Shot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Draft" })).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });
});
