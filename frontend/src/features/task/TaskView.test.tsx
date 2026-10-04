import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { TaskView } from "@/features/task/TaskView";
import { announcement } from "@/lib/situations";
import { api, type PRReport, type PullRequest, type Step, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePRReport,
  makePullRequest,
  makeReview,
  makeReviewFinding,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
  makeTaskConversation,
  makeTextPRReport,
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
        user: {
          text: "Check the login form",
          pending: false,
          prompt: false,
          app: false,
          sent: "",
          appKind: "",
          appPass: 0,
          appRound: 0,
          appRounds: 0,
          appCount: 0,
        },
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
  it("draws the rail of a question in text and its quick replies with the reply situation", async () => {
    const asked = makeEntry("assistant");
    if (asked.assistant !== null) {
      asked.assistant.text = "Which cache?\n\na) Redis\nb) None";
      asked.assistant.complete = true;
    }
    const { container } = renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({
        tasks: [
          makeTask({
            stage: "prd",
            situations: [
              makeSituation({ kind: "reply", place: { kind: "stage", stage: "prd", step: 0 } }),
            ],
          }),
        ],
      }),
      ui: {
        location: { kind: "task", id: "task-1" },
        transcripts: {
          "task-1|prd": { status: "ready", error: "", entries: [asked], pending: [], buffered: [] },
        },
      },
    });

    await waitFor(() => expect(container.querySelector(".markdown-rail-last")).not.toBeNull());
    expect(screen.getByRole("button", { name: /Redis/ })).toBeInTheDocument();
  });

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

  it("puts the tabs over the conversation they switch, with no changed files under the agent", () => {
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
    expect(screen.queryByRole("article", { name: /^Changed files/ })).not.toBeInTheDocument();
  });

  it("puts the changed files of the step at the end of its conversation", async () => {
    stepView({ status: "in_review", review: makeReview({ staged: 1, total: 2, percent: 50 }) });

    const feed = screen.getByRole("feed");
    const card = await within(feed).findByRole("article", { name: "Changed files · 2" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.getByText("Add a login screen").compareDocumentPosition(card) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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

    expect(
      screen.getByRole("article", {
        name: "Check the network and the credentials of origin, then try again.",
      }),
    ).toHaveTextContent("fatal: unable to access");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("tells a plan still invalid in the bar, whose Show problems opens the marker that lists them", async () => {
    const problems = [{ file: "2-api.md", message: "no repository" }];
    const invalid = makeEntry("marker");
    const { user } = renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({
        tasks: [
          makeTask({
            stage: "plan",
            corrections: 3,
            planProblems: problems,
            situations: [
              makeSituation({
                kind: "plan_invalid",
                place: { kind: "stage", stage: "plan", step: 0 },
              }),
            ],
          }),
        ],
      }),
      ui: {
        location: { kind: "task", id: "task-1" },
        transcripts: {
          "task-1|plan": {
            status: "ready",
            error: "",
            entries: [
              invalid.marker === null
                ? invalid
                : { ...invalid, marker: { ...invalid.marker, type: "plan_invalid", problems } },
            ],
            pending: [],
            buffered: [],
          },
        },
      },
    });
    const marker = screen.getByRole("button", { name: /The plan is still invalid/ });
    expect(marker).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Show problems" }));

    expect(marker).toHaveAttribute("aria-expanded", "true");
    expect(marker).toHaveFocus();
    expect(marker.closest("article")).toHaveTextContent("2-api.md · no repository");
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

  it("opens the card panel from its button, for a task created from a card", async () => {
    const { user } = view({ card: makeTaskCard() });

    await user.click(screen.getByRole("button", { name: "Card" }));

    expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();
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

    expect(await screen.findByLabelText("Title")).toHaveValue("Wire the api");
    expect(api.getTranscript).toHaveBeenCalledWith("task-1", "pr");
  });

  it("asks for no conversation while the pull request has none", () => {
    view({ stage: "pr", pr: makePullRequest({ status: "preparing", sessionStage: "" }) });

    expect(screen.getByText("Preparing the pull request…")).toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("reads the conversation of the review once the pull request is merged", async () => {
    view({
      stage: "pr",
      pr: makePullRequest({ status: "merged", prState: "merged", prNumber: 12, sessionStage: "" }),
      conversations: [
        makeTaskConversation({ stage: "pr" }),
        makeTaskConversation({ stage: "pr_review" }),
      ],
    });

    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "pr_review");
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("announces the place that changes with the screen open, and not the one it arrives on", () => {
    const at = (phase: string) =>
      makeState({
        tasks: [
          makeTask({
            stage: "implementation",
            steps: [makeStep({ status: "preparing", phase })],
            currentStep: 1,
          }),
        ],
      });
    renderWithStore(<TaskView taskId="task-1" />, {
      state: at("fetching"),
      ui: { location: { kind: "task", id: "task-1" } },
    });
    expect(useAppStore.getState().announcement).toBeNull();

    act(() => {
      useAppStore.setState({ app: at("creating") });
    });
    expect(useAppStore.getState().announcement?.text).toBe("Creating the worktree…");
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
      user: {
        text: "Implement step 1.",
        pending: false,
        prompt: false,
        app: false,
        sent: "",
        appKind: "",
        appPass: 0,
        appRound: 0,
        appRounds: 0,
        appCount: 0,
      },
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

  it("has the tabs, the meter and the composer before an earlier conversation opens", () => {
    loop();

    expect(screen.getByRole("tablist", { name: "Conversations" })).toBeInTheDocument();
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

  it("hides the tabs and the meter, and keeps the stepper and the panels", () => {
    loop({ ui: { earlierConversation: { taskId: "task-1", stage: "step:1", from: null } } });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
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

  it("falls back to the header's title when the place has no conversation to land on", async () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({ status: "preparing", sessionStage: "" }),
      conversations: [makeTaskConversation({ stage: "prd" })],
    });
    const { user } = renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({ tasks: [task] }),
      ui: {
        location: { kind: "task", id: "task-1" },
        transcripts: { "task-1|prd": read([]) },
        earlierConversation: { taskId: "task-1", stage: "prd", from: null },
      },
    });

    await user.click(screen.getByRole("button", { name: "Back to the pull request" }));

    expect(screen.getByText("Preparing the pull request…")).toBeInTheDocument();
    expect(screen.queryByRole("feed")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
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

describe("TaskView, the focus on arriving at a situation", () => {
  function arrive(task: TaskSummary) {
    return renderWithStore(<TaskView taskId={task.id} />, {
      state: makeState({ tasks: [task] }),
      ui: { location: { kind: "task", id: task.id }, pendingFocus: "request" },
    });
  }

  it("goes to the primary of the bar once the conversation is read", async () => {
    arrive(
      makeTask({
        stage: "implementation",
        currentStep: 1,
        steps: [
          makeStep({
            status: "ready_to_approve",
            review: makeReview({ staged: 2, total: 2, percent: 100 }),
          }),
        ],
        situations: [
          makeSituation({
            kind: "step_review",
            form: "approve",
            place: { kind: "step", stage: "", step: 1 },
          }),
        ],
      }),
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus());
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("goes to the composer when the answer goes through it", async () => {
    arrive(
      makeTask({
        stage: "prd",
        situations: [
          makeSituation({ kind: "reply", place: { kind: "stage", stage: "prd", step: 0 } }),
        ],
      }),
    );

    await waitFor(() => expect(document.getElementById("composer-input")).toHaveFocus());
  });

  it("goes to Try again of a blocked step, which has no conversation", async () => {
    arrive(
      makeTask({
        stage: "implementation",
        currentStep: 1,
        steps: [
          makeStep({ status: "blocked", block: { reason: "fetch_failed", detail: "", files: 0 } }),
        ],
        situations: [
          makeSituation({
            kind: "step_blocked",
            group: "error",
            place: { kind: "step", stage: "", step: 1 },
          }),
        ],
      }),
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus());
  });

  it("goes to the first option of the pending question card", async () => {
    renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({
        tasks: [
          makeTask({
            stage: "prd",
            situations: [
              makeSituation({ kind: "question", place: { kind: "stage", stage: "prd", step: 0 } }),
            ],
          }),
        ],
      }),
      ui: {
        location: { kind: "task", id: "task-1" },
        pendingFocus: "request",
        transcripts: {
          "task-1|prd": {
            status: "ready",
            error: "",
            entries: [makeEntry("question")],
            pending: [],
            buffered: [],
          },
        },
      },
    });

    await waitFor(() => expect(screen.getByRole("radio", { name: /SQLite/ })).toHaveFocus());
  });

  it("lands once the conversation couldn't be read, instead of waiting for it", async () => {
    renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({
        tasks: [
          makeTask({
            stage: "prd",
            situations: [
              makeSituation({ kind: "question", place: { kind: "stage", stage: "prd", step: 0 } }),
            ],
          }),
        ],
      }),
      ui: {
        location: { kind: "task", id: "task-1" },
        pendingFocus: "request",
        transcripts: {
          "task-1|prd": {
            status: "error",
            error: "the transcript is unreadable",
            entries: [],
            pending: [],
            buffered: [],
          },
        },
      },
    });

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("falls back to the title when what the situation asks isn't on screen", async () => {
    arrive(
      makeTask({
        stage: "prd",
        situations: [
          makeSituation({ kind: "question", place: { kind: "stage", stage: "prd", step: 0 } }),
        ],
      }),
    );

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
  });
});

describe("TaskView, the focus on arriving at the findings of the pull request", () => {
  const PR_PLACE = { kind: "pr", stage: "", step: 0 };
  const FINDINGS = [
    makeReviewFinding({ number: 1, title: "First", decision: "approved" }),
    makeReviewFinding({ number: 2, title: "Second" }),
    makeReviewFinding({ number: 3, title: "Third" }),
  ];

  function inReview(
    situation: Parameters<typeof makeSituation>[0],
    pr: Partial<PullRequest>,
    report: Partial<PRReport> = {},
  ): TaskSummary {
    return makeTask({
      name: "Rate limit per API key",
      stage: "pr",
      conversations: [
        makeTaskConversation({ stage: "pr" }),
        makeTaskConversation({ stage: "pr_review" }),
      ],
      situations: [makeSituation({ taskId: "task-1", place: PR_PLACE, ...situation })],
      pr: makePullRequest({
        status: "awaiting_decision",
        prNumber: 1284,
        prState: "open",
        sessionStage: "pr_review",
        sessionStatus: "waiting",
        currentPass: 1,
        reports: [makePRReport({ findings: FINDINGS, ...report })],
        ...pr,
      }),
    });
  }

  function arrive(task: TaskSummary) {
    return renderWithStore(<TaskView taskId={task.id} />, {
      state: makeState({ tasks: [task] }),
      ui: { location: { kind: "task", id: task.id }, pendingFocus: "request" },
    });
  }

  it("goes to the first finding to decide when the findings are to decide", async () => {
    arrive(inReview({ kind: "findings", form: "decide" }, {}));

    await waitFor(() =>
      expect(screen.getByRole("group", { name: /^Finding 2 of 3/ })).toHaveFocus(),
    );
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("goes to Apply approved when the situation is born ready to apply", async () => {
    arrive(
      inReview(
        { kind: "findings", form: "apply" },
        {},
        { findings: FINDINGS.map((each) => ({ ...each, decision: "approved" })) },
      ),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply approved" })).toHaveFocus(),
    );
  });

  it("goes to Open PR when the pass had every finding discarded", async () => {
    arrive(
      inReview(
        { kind: "merge", group: "closing", form: "" },
        { status: "done" },
        { findings: FINDINGS.map((each) => ({ ...each, decision: "discarded" })) },
      ),
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Open PR" })).toHaveFocus());
  });

  it("goes to the composer when the findings are in text", async () => {
    arrive(
      inReview(
        { kind: "findings", form: "" },
        {},
        { ...makeTextPRReport(1, false), file: "review-1.md" },
      ),
    );

    await waitFor(() => expect(document.getElementById("composer-input")).toHaveFocus());
  });

  it("blinks the bar of findings born with the screen open, and says it with the task's name", async () => {
    const task = inReview({ kind: "findings", form: "decide" }, {});
    renderWithStore(<TaskView taskId="task-1" />, {
      state: makeState({ tasks: [task] }),
      ui: {
        location: { kind: "task", id: "task-1" },
        flashing: new Set([task.situations?.[0]?.id ?? ""]),
      },
    });

    const bar = await screen.findByRole("region", { name: "Request" });
    expect(bar).toHaveClass("situation-flash");
    expect(bar).toHaveAttribute("data-flash", "wait");
    expect(announcement(task.name, task.situations?.[0] ?? makeSituation())).toBe(
      "Rate limit per API key: decide findings in PR review",
    );
  });
});
