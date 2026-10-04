import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactsPanel } from "@/features/task/ArtifactsPanel";
import { api, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeStep, makeTask } from "@/test/wails-mock";

function artifacts(overrides: Partial<TaskSummary> = {}) {
  const task = makeTask(overrides);
  return renderWithStore(<ArtifactsPanel task={task} />, {
    state: makeState({ tasks: [task] }),
    ui: { location: { kind: "task", id: task.id }, panel: "artifacts" },
  });
}

const group = (name: string) => screen.getByRole("region", { name });

const STEP_FILE = "---\nrepository: web\n---\n# Step 1: Add the login form\n";

const STEPS = [
  makeStep({ number: 1, file: "1-login-form.md", title: "Add the login form" }),
  makeStep({ number: 2, file: "2-session.md", title: "Keep the session" }),
];

const DRAFT = { title: "Add the login screen", body: "Why", file: "draft.md" };

describe("ArtifactsPanel", () => {
  it("says the PRD appears once the agent writes it, before any document exists", () => {
    artifacts();

    expect(screen.getByText("No artifacts yet")).toBeInTheDocument();
    expect(screen.getByText("The PRD appears here once the agent writes it.")).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });

  it("says the One-Shot document appears once the agent writes it, in a One-Shot task", () => {
    artifacts({ mode: "one_shot", stage: "one_shot" });

    expect(
      screen.getByText("The One-Shot document appears here once the agent writes it."),
    ).toBeInTheDocument();
  });

  it("lists only the documents written, in their groups", () => {
    artifacts({
      stage: "pr",
      hasPrd: true,
      hasTechSpec: true,
      steps: STEPS,
      pr: makePullRequest({ draft: DRAFT }),
    });

    expect(
      within(group("Documents"))
        .getAllByRole("button")
        .map((row) => row.textContent),
    ).toEqual(["PRD", "Tech spec"]);
    expect(
      within(group("Step files · 2"))
        .getAllByRole("button")
        .map((row) => row.textContent),
    ).toEqual(["1 · Add the login form", "2 · Keep the session"]);
    expect(
      within(group("Pull request"))
        .getAllByRole("button")
        .map((row) => row.textContent),
    ).toEqual(["Draft · Add the login screen"]);
  });

  it("leaves out a document not written yet", () => {
    artifacts({ hasPrd: true });

    expect(within(group("Documents")).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: /^Step files/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pull request" })).not.toBeInTheDocument();
  });

  it("says the draft is approved once the pull request is open", () => {
    artifacts({ stage: "pr", pr: makePullRequest({ draft: DRAFT, prNumber: 1284 }) });

    expect(within(group("Pull request")).getByRole("button")).toHaveTextContent(
      "Draft · Add the login screenapproved",
    );
  });

  it("opens at the document a marker of the conversation asked for", async () => {
    const task = makeTask({ hasPrd: true });
    renderWithStore(<ArtifactsPanel task={task} />, {
      state: makeState({ tasks: [task] }),
      ui: { location: { kind: "task", id: task.id }, panel: "artifacts", panelDocument: "PRD.md" },
    });

    expect(screen.getByRole("button", { name: "← Artifacts" })).toBeInTheDocument();
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# PRD");
    expect(api.readArtifact).toHaveBeenCalledWith(task.id, "PRD.md");
    expect(useAppStore.getState().panelDocument).toBeNull();
  });

  it("opens a document in place of the list, and comes back to it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    const { user } = artifacts({ hasPrd: true, artifactVersion: 1 });

    await user.click(screen.getByRole("button", { name: "PRD" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Login");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "PRD.md");
    expect(screen.getByRole("heading", { name: "PRD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Artifacts" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "← Artifacts" }));

    expect(screen.getByRole("button", { name: "PRD" })).toHaveFocus();
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("reads the document again when the agent rewrites it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("first");
    const task = makeTask({ hasPrd: true, artifactVersion: 1 });
    const { user, rerender } = renderWithStore(<ArtifactsPanel task={task} />, {
      state: makeState({ tasks: [task] }),
    });
    await user.click(screen.getByRole("button", { name: "PRD" }));
    expect(await screen.findByTestId("markdown")).toHaveTextContent("first");

    vi.mocked(api.readArtifact).mockResolvedValue("second");
    rerender(<ArtifactsPanel task={{ ...task, artifactVersion: 2 }} />);

    expect(await screen.findByTestId("markdown")).toHaveTextContent("second");
    expect(api.readArtifact).toHaveBeenCalledTimes(2);
  });

  it("keeps the document open when the stage changes", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    const task = makeTask({ stage: "tech_spec", hasPrd: true });
    const { user, rerender } = renderWithStore(<ArtifactsPanel task={task} />, {
      state: makeState({ tasks: [task] }),
    });
    await user.click(screen.getByRole("button", { name: "PRD" }));
    await screen.findByTestId("markdown");

    rerender(<ArtifactsPanel task={{ ...task, stage: "plan", hasTechSpec: true }} />);

    expect(screen.getByRole("heading", { name: "PRD" })).toBeInTheDocument();
    expect(api.readArtifact).toHaveBeenCalledOnce();
  });

  it("reads a step file without the header it carries", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue(STEP_FILE);
    const { user } = artifacts({ stage: "implementation", steps: STEPS });

    await user.click(screen.getByRole("button", { name: "1 · Add the login form" }));

    const markdown = await screen.findByTestId("markdown");
    expect(markdown).toHaveTextContent("# Step 1: Add the login form");
    expect(markdown).not.toHaveTextContent("repository");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "steps/1-login-form.md");
  });

  it("reads the draft of the pull request out of the pr folder", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Draft");
    const { user } = artifacts({ stage: "pr", pr: makePullRequest({ draft: DRAFT }) });

    await user.click(screen.getByRole("button", { name: "Draft · Add the login screen" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Draft");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "pr/draft.md");
  });

  it("offers the One-Shot document and no step files in a One-Shot task", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# One-Shot");
    const { user } = artifacts({
      mode: "one_shot",
      stage: "implementation",
      hasOneShot: true,
      steps: [makeStep()],
    });

    expect(screen.queryByRole("region", { name: /^Step files/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "One-Shot document" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# One-Shot");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "one-shot.md");
  });

  it("says a document couldn't be read, and reads it again on Try again", async () => {
    vi.mocked(api.readArtifact).mockRejectedValueOnce(new Error("permission denied"));
    const { user } = artifacts({ hasPrd: true });

    await user.click(screen.getByRole("button", { name: "PRD" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't read PRD.md permission denied",
    );
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Login");
  });

  it("comes back to the list when the open document is gone", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue(STEP_FILE);
    const task = makeTask({ stage: "implementation", steps: STEPS });
    const { user, rerender } = renderWithStore(<ArtifactsPanel task={task} />, {
      state: makeState({ tasks: [task] }),
    });
    await user.click(screen.getByRole("button", { name: "2 · Keep the session" }));
    await screen.findByTestId("markdown");

    rerender(<ArtifactsPanel task={{ ...task, steps: STEPS.slice(0, 1) }} />);

    expect(group("Step files · 1")).toBeInTheDocument();
  });
});
