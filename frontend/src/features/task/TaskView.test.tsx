import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeState, makeStep, makeTask } from "@/test/wails-mock";

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
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "prd");
    });
  });

  it("puts the stage track under the header", () => {
    view({ stage: "tech_spec" });

    const chips = screen.getAllByRole("button", { name: "PRD" });
    expect(chips.some((chip) => chip.getAttribute("aria-haspopup") === "menu")).toBe(true);
    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("shows the step being run instead of a conversation of its own", () => {
    view({
      stage: "implementation",
      steps: [makeStep({ status: "preparing", phase: "fetching" })],
      currentStep: 1,
    });

    expect(screen.getByText("Step 1 of 1")).toBeInTheDocument();
    // The bar names the phase next to the step, the pane in the empty space
    // where the conversation will be.
    expect(screen.getAllByText("Fetching origin…")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("fetches the conversation of a step that opened a session", async () => {
    view({
      stage: "implementation",
      steps: [makeStep({ status: "implementing", worktreePath: "/w/api/add-login" })],
      currentStep: 1,
    });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "step:1");
    });
  });

  it("shows no conversation while the step is blocked", () => {
    view({
      stage: "implementation",
      steps: [
        makeStep({
          status: "blocked",
          block: { reason: "fetch_failed", detail: "fatal: unable to access", files: 0 },
        }),
      ],
      currentStep: 1,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't fetch origin");
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

  it("shows the repositories instead of a conversation of its own in the PR stage", async () => {
    view({
      stage: "pr",
      repos: [
        makeRepoPR({ status: "drafting" }),
        makeRepoPR({
          repository: "api",
          repoPath: "/home/dev/projects/api",
          slug: "api",
          status: "draft_ready",
          sessionStage: "pr:api",
          draft: { title: "Wire the api", body: "why", file: "api-draft.md" },
        }),
      ],
    });

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    // The repository waiting for the user is the one the task opens on.
    expect(screen.getByLabelText("Title")).toHaveValue("Wire the api");
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "pr:api");
    });
  });

  it("follows the repository the user picks", async () => {
    const { user } = view({
      stage: "pr",
      repos: [
        makeRepoPR({ status: "drafting" }),
        makeRepoPR({
          repository: "api",
          repoPath: "/home/dev/projects/api",
          slug: "api",
          status: "draft_ready",
          sessionStage: "pr:api",
        }),
      ],
    });

    await user.click(screen.getAllByRole("tab")[0] as HTMLElement);

    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "pr:web");
    });
  });

  it("asks for no conversation while a repository has none", () => {
    view({ stage: "pr", repos: [makeRepoPR({ status: "preparing", sessionStage: "" })] });

    expect(screen.getByText("Checking GitHub…")).toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });
});
