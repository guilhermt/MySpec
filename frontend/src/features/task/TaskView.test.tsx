import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { TaskView } from "@/features/task/TaskView";
import { api, type Step, type TaskSummary } from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePullRequest,
  makeReview,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

function view(overrides: Partial<TaskSummary> = {}) {
  return renderWithStore(<TaskView taskId="task-1" />, {
    state: makeState({ tasks: [makeTask(overrides)] }),
    ui: { location: { kind: "task", id: "task-1" } },
  });
}

// The implementer and the reviewer of step 1, each with a conversation of its own.
const BOTH_READY: Record<string, TranscriptState> = {
  "task-1|step:1": {
    status: "ready",
    error: "",
    entries: [makeEntry("user")],
    pending: [],
    buffered: [],
  },
  "task-1|step_review:1": {
    status: "ready",
    error: "",
    entries: [
      makeEntry("user", {
        user: { text: "Check the login form", pending: false, prompt: false, app: false },
      }),
    ],
    pending: [],
    buffered: [],
  },
};

const UNDER_AGENT_REVIEW: Partial<Step> = {
  status: "agent_review",
  reviewMode: "agent",
  reviewPass: 1,
  reviewer: makeStepReviewer({ sessionStatus: "working" }),
};

function stepView(step: Partial<Step>) {
  return renderWithStore(<TaskView taskId="task-1" />, {
    state: makeState({
      tasks: [makeTask({ stage: "implementation", steps: [makeStep(step)], currentStep: 1 })],
    }),
    ui: { location: { kind: "task", id: "task-1" }, transcripts: BOTH_READY },
  });
}

describe("TaskView", () => {
  it("puts the conversation, the composer and the header together", async () => {
    view();

    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "prd");
    });
  });

  it("holds the controls over the task in the ⋯ of the header", () => {
    view({ stage: "tech_spec" });

    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
  });

  it("shows the step being run instead of a conversation of its own", () => {
    view({
      stage: "implementation",
      steps: [makeStep({ status: "preparing", phase: "fetching" })],
      currentStep: 1,
    });

    // The pane names the phase in the empty space where the conversation will be.
    expect(screen.getByText("Fetching origin…")).toBeInTheDocument();
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

  it("fetches the conversation of the reviewer when its tab opens", async () => {
    const { user } = view({
      stage: "implementation",
      steps: [
        makeStep({
          status: "addressing_review",
          reviewMode: "agent",
          reviewPass: 1,
          worktreePath: "/w/api/add-login",
          reviewer: makeStepReviewer({ sessionStatus: "working" }),
        }),
      ],
      currentStep: 1,
    });
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "step:1");
    });
    expect(api.getTranscript).not.toHaveBeenCalledWith("task-1", "step_review:1");

    await user.click(screen.getByRole("tab", { name: /Reviewer/ }));

    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "step_review:1");
    });
  });

  it("keeps the draft of each conversation apart when the tab changes", async () => {
    const { user } = stepView(UNDER_AGENT_REVIEW);

    await user.type(screen.getByRole("textbox"), "For the reviewer");
    await user.click(screen.getByRole("tab", { name: /Implementer/ }));

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.click(screen.getByRole("tab", { name: /Reviewer/ }));

    expect(screen.getByText("Check the login form")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("For the reviewer");
  });

  it("puts the tabs over the conversation they switch, with no review strip under the agent", () => {
    stepView(UNDER_AGENT_REVIEW);

    const tablist = screen.getByRole("tablist", { name: "Conversations" });
    const conversation = document.getElementById(AGENT_CONVERSATION);
    expect(conversation).not.toBeNull();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-controls", AGENT_CONVERSATION);
    }
    expect(
      tablist.compareDocumentPosition(conversation as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "Review progress" })).not.toBeInTheDocument();
  });

  it("puts the review of the step under the header, above the conversation", () => {
    stepView({ status: "in_review", review: makeReview({ staged: 3, total: 5, percent: 60 }) });

    const strip = screen.getByRole("progressbar", { name: "Review progress" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      strip.compareDocumentPosition(screen.getByText("Add a login screen")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it("keeps the artifacts panel closed until the user opens it", () => {
    view({ hasPrd: true, artifactVersion: 1 });

    expect(screen.queryByRole("complementary", { name: "Artifacts" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("opens the artifacts panel from its button", async () => {
    const { user } = view({ hasPrd: true, artifactVersion: 1 });

    await user.click(screen.getByRole("button", { name: "Artifacts" }));

    expect(screen.getByRole("complementary", { name: "Artifacts" })).toBeInTheDocument();
  });

  it("shows the header loading until the snapshot brings the task, and nothing else", () => {
    renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState(),
      ui: { location: { kind: "task", id: "task-1" } },
    });

    expect(screen.getByRole("list", { name: "Progress" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("shows the pull request instead of a conversation of its own in the PR stage", async () => {
    view({
      stage: "pr",
      pr: makePullRequest({
        status: "draft_ready",
        draft: { title: "Wire the api", body: "why", file: "draft.md" },
      }),
    });

    expect(screen.getByLabelText("Title")).toHaveValue("Wire the api");
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "pr");
    });
  });

  it("asks for no conversation while the pull request has none", () => {
    view({ stage: "pr", pr: makePullRequest({ status: "preparing", sessionStage: "" }) });

    expect(screen.getByText("Checking GitHub…")).toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("lets nothing but the conversation scroll in its column", () => {
    view();

    const column = screen.getByRole("textbox").closest(".overflow-clip");
    expect(column).not.toBeNull();
  });
});
