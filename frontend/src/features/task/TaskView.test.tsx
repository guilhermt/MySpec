import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { TaskView } from "@/features/task/TaskView";
import { api, type Step, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePullRequest,
  makeReview,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskConversation,
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

  it("opens the details panel from its button, in place of the artifacts", async () => {
    const { user } = view({ hasPrd: true, artifactVersion: 1 });

    await user.click(screen.getByRole("button", { name: "Artifacts" }));
    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByRole("complementary", { name: "Details" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("complementary", { name: "Artifacts" })).not.toBeInTheDocument();
    });
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

describe("TaskView, earlier conversation", () => {
  /** read is a conversation already read, with the entries given. */
  const read = (entries: ReturnType<typeof makeEntry>[]): TranscriptState => ({
    status: "ready",
    error: "",
    entries,
    pending: [],
    buffered: [],
  });

  /**
   * LOOP is a task on its step 2, under a pass of its reviewer with the review of the step on view,
   * after a step 1 whose implementer asked, was allowed and failed once.
   */
  const LOOP = makeTask({
    stage: "implementation",
    reviewMode: "agent",
    currentStep: 2,
    steps: [
      makeStep({ number: 1, status: "done", commitSha: "c19f02e8a1b2", reviewMode: "agent" }),
      makeStep({
        number: 2,
        title: "Wire the API",
        status: "agent_review",
        reviewMode: "agent",
        reviewPass: 1,
        review: makeReview(),
        reviewer: makeStepReviewer({ sessionStage: "step_review:2", sessionStatus: "working" }),
      }),
    ],
    conversations: [
      makeTaskConversation({ stage: "prd" }),
      makeTaskConversation({ stage: "step:1" }),
      makeTaskConversation({ stage: "step:2" }),
      makeTaskConversation({ stage: "step_review:2" }),
    ],
    sessionStatus: "error",
  });

  const EARLIER_ENTRIES = [
    makeEntry("user", {
      user: { text: "Implement step 1.", pending: false, prompt: false, app: false },
    }),
    makeEntry("question"),
    makeEntry("permission"),
    makeEntry("error"),
  ];

  const LOOP_TRANSCRIPTS: Record<string, TranscriptState> = {
    "task-1|step:1": read(EARLIER_ENTRIES),
    "task-1|step:2": read([makeEntry("user")]),
    "task-1|step_review:2": read([makeEntry("user")]),
  };

  function loop(ui: Parameters<typeof renderWithStore>[1] = {}) {
    return renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({ tasks: [LOOP] }),
      ...ui,
      ui: {
        location: { kind: "task", id: "task-1" },
        transcripts: LOOP_TRANSCRIPTS,
        ...ui.ui,
      },
    });
  }

  const EARLIER_REGION = "Step 1 · Implementer, an earlier conversation";

  it("has the tabs, the review, the meter and the composer before an earlier conversation opens", () => {
    loop();

    expect(screen.getByRole("tablist", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Review progress" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Context" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("takes the place of the conversation, with the strip in place of the composer and the focus on it", () => {
    loop({ ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } } });

    const region = screen.getByRole("region", { name: EARLIER_REGION });
    expect(region).toHaveFocus();
    expect(within(region).getByText("Implement step 1.")).toBeInTheDocument();
    expect(
      screen.getByText("· an earlier conversation. It takes no more messages.", { exact: false }),
    ).toHaveTextContent(
      "Step 1 · Implementer · an earlier conversation. It takes no more messages.",
    );
    expect(screen.getByRole("button", { name: "Back to step 2" })).toBeInTheDocument();
  });

  it("never takes a message: no composer, no card to answer, no retry, nothing to remove", () => {
    loop({ ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } } });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: EARLIER_REGION });
    expect(within(region).getByText("Which database?")).toBeInTheDocument();
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    expect(within(region).queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry|Answer|Allow|Deny|Remove/ })).toBeNull();
  });

  it("hides the tabs, the review of the step and the meter, and keeps the stepper and the panels", () => {
    loop({ ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } } });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Review progress" })).toBeNull();
    expect(screen.queryByRole("meter", { name: "Context" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: /^Progress/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("hides the bar of the request", () => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 1,
      steps: [makeStep({ status: "awaiting_review", review: makeReview() })],
      situations: [
        makeSituation({ kind: "step_review", place: { kind: "step", stage: "", step: 1 } }),
      ],
      conversations: [makeTaskConversation({ stage: "prd" })],
    });
    const transcripts = { "task-1|step:1": read([]), "task-1|prd": read([]) };
    const { unmount } = renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({ tasks: [task] }),
      ui: { location: { kind: "task", id: "task-1" }, transcripts },
    });
    expect(screen.getByRole("region", { name: "Request" })).toBeInTheDocument();
    unmount();

    renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({ tasks: [task] }),
      ui: {
        location: { kind: "task", id: "task-1" },
        transcripts,
        earlierConversation: { taskId: "task-1", stage: "prd", from: null },
      },
    });

    expect(screen.getByRole("region", { name: "PRD, an earlier conversation" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("hides the warning of a plan that stayed invalid", () => {
    renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({
        tasks: [
          makeTask({
            stage: "plan",
            corrections: 3,
            planProblems: [{ file: "", message: "no step files were written" }],
            conversations: [makeTaskConversation({ stage: "prd" })],
          }),
        ],
      }),
      ui: {
        location: { kind: "task", id: "task-1" },
        transcripts: { "task-1|prd": read([]), "task-1|plan": read([]) },
        earlierConversation: { taskId: "task-1", stage: "prd", from: null },
      },
    });

    expect(screen.getByRole("button", { name: "Back to the plan" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaves the conversation of the task on screen until the earlier one is read", () => {
    loop({
      ui: {
        earlierConversation: { taskId: "task-1", stage: "step:1", from: null },
        transcripts: {
          ...LOOP_TRANSCRIPTS,
          "task-1|step:1": { ...read([]), status: "loading" },
        },
      },
    });

    expect(screen.queryByRole("region", { name: EARLIER_REGION })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("goes back to the conversation of the task on Back, with the focus on it", async () => {
    const { user } = loop({
      ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } },
    });

    await user.click(screen.getByRole("button", { name: "Back to step 2" }));

    expect(useAppStore.getState().earlierConversation).toBeNull();
    expect(screen.queryByRole("region", { name: EARLIER_REGION })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="conversation"]')).toHaveFocus();
  });

  it("goes back with the focus on the row that opened it, while the panel is open beside it", async () => {
    const { user } = loop({
      ui: {
        panel: "details",
        earlierConversation: { taskId: "task-1", stage: "step:1", from: "panel" },
      },
    });

    await user.click(screen.getByRole("button", { name: "Back to step 2" }));

    const details = screen.getByRole("complementary", { name: "Details" });
    expect(within(details).getByRole("button", { name: /^Implementer/ })).toHaveFocus();
  });

  it("goes back to the conversation of the task when its session is discarded", () => {
    loop({ ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } } });

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          tasks: [{ ...LOOP, conversations: [makeTaskConversation({ stage: "step:2" })] }],
        }),
      );
    });

    expect(screen.queryByRole("region", { name: EARLIER_REGION })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("goes back to the conversation of the task when a situation of the task opens", () => {
    loop({ ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } } });

    act(() => {
      useAppStore.getState().openSituation("task-1", { kind: "step_review", stage: "", step: 2 });
    });

    expect(screen.queryByRole("region", { name: EARLIER_REGION })).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Conversations" })).toBeInTheDocument();
  });
});
