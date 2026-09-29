import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tabId } from "@/components/system/Tabs";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { StepPane } from "@/features/task/StepPane";
import { api, type Step, type TaskSummary } from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeEntry,
  makeReview,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

const READY: Record<string, TranscriptState> = {
  "task-1|step:1": {
    status: "ready",
    error: "",
    entries: [makeEntry("user")],
    pending: [],
    buffered: [],
  },
};

// The implementer and the reviewer of step 1, each with a conversation of its own.
const BOTH_READY: Record<string, TranscriptState> = {
  ...READY,
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

// placeEmpty is the empty state of the place, which is not a live region.
function placeEmpty(): HTMLElement {
  const empty = document.querySelector<HTMLElement>('[data-slot="place-empty"]');
  if (empty === null) {
    throw new Error("the place is not empty");
  }
  return empty;
}

function pane(
  step: Partial<Step> | null,
  overrides: Partial<TaskSummary> = {},
  ui: NonNullable<StoreOptions["ui"]> = { transcripts: READY },
) {
  const task = makeTask({
    stage: "implementation",
    steps: step === null ? [] : [makeStep(step)],
    currentStep: step === null ? 0 : 1,
    ...overrides,
  });
  return renderWithStore(<StepPane task={task} />, {
    state: makeState({ tasks: [task] }),
    ui,
  });
}

describe("StepPane", () => {
  it("shows the conversation of a step that has one", () => {
    pane({ status: "implementing" });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it.each(["agent_review", "addressing_review"])(
    "keeps the conversation while the step is in %s",
    (status) => {
      pane({ status });

      expect(screen.getByText("Add a login screen")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    },
  );

  it("shows the conversation of the reviewer on its tab", async () => {
    const { user } = pane(
      UNDER_AGENT_REVIEW,
      {},
      {
        transcripts: BOTH_READY,
        openStepTab: { "task-1|1": "reviewer" },
      },
    );

    expect(screen.getByText("Check the login form")).toBeInTheDocument();
    expect(screen.queryByText("Add a login screen")).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "The test is missing{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "step_review:1", "The test is missing");
  });

  it("shows only the conversation of the implementer while the step has no reviewer", () => {
    pane({ status: "implementing", reviewMode: "agent" });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("is a tabpanel labelled by the chosen agent tab while the step has tabs", () => {
    pane(
      UNDER_AGENT_REVIEW,
      {},
      { transcripts: BOTH_READY, openStepTab: { "task-1|1": "reviewer" } },
    );

    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      tabId(AGENT_CONVERSATION, "reviewer"),
    );
  });

  it("has no tabpanel role for a step with no tabs to show", () => {
    pane({ status: "implementing", reviewMode: "agent" });

    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("keeps the conversation while the step waits for review", () => {
    pane({ status: "awaiting_review" });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("keeps the conversation while the commit is being made", () => {
    pane({ status: "committing", review: makeReview({ staged: 2, total: 2, percent: 100 }) });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it.each(["implementer", "reviewer"] as const)(
    "puts the changed files at the end of the conversation while the step is reviewed, on the %s tab",
    (tab) => {
      pane(
        {
          status: "in_review",
          review: makeReview(),
          reviewMode: "agent",
          reviewer: makeStepReviewer({ sessionStatus: "idle" }),
        },
        {},
        { transcripts: BOTH_READY, openStepTab: { "task-1|1": tab } },
      );

      const feed = screen.getByRole("feed");
      expect(
        within(feed).getByText(tab === "reviewer" ? "Check the login form" : "Add a login screen"),
      ).toBeInTheDocument();
      expect(within(feed).getByRole("article", { name: "Changed files · 2" })).toBeInTheDocument();
    },
  );

  it("has no changed files while the agent implements", () => {
    pane({ status: "implementing", review: makeReview() });

    expect(screen.queryByRole("article", { name: /^Changed files/ })).not.toBeInTheDocument();
  });
});

// The rows of the table of the place without a conversation, for the implementation.
describe("StepPane, the place without a conversation", () => {
  it("starts a step not started", () => {
    pane({ status: "not_started", number: 1 });

    expect(screen.getByRole("status")).toHaveTextContent("Starting step 1…");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("feed")).not.toBeInTheDocument();
  });

  it("starts the implementation of a One-Shot task", () => {
    pane({ status: "not_started" }, { mode: "one_shot" });

    expect(screen.getByRole("status")).toHaveTextContent("Starting the implementation…");
  });

  it.each([
    ["fetching", "Fetching origin…"],
    ["creating", "Creating the worktree…"],
    ["checking", "Checking the worktree…"],
    ["", "Preparing the worktree…"],
  ])("says what the app is doing while the step prepares, %s", (phase, text) => {
    pane({ status: "preparing", phase });

    expect(screen.getByRole("status")).toHaveTextContent(text);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("starts the next step once the step is committed", () => {
    pane({ status: "done" });

    expect(screen.getByRole("status")).toHaveTextContent("Starting the next step…");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the step that is next and why it did not start, with the way out in the bar", () => {
    pane(
      { status: "blocked", block: { reason: "dirty_worktree", detail: " M go.mod", files: 1 } },
      {
        situations: [
          makeSituation({ kind: "step_blocked", place: { kind: "step", stage: "", step: 1 } }),
        ],
      },
    );

    expect(
      screen.getByRole("article", { name: "Step 1 is next · Add the login form" }),
    ).toBeInTheDocument();
    const block = screen.getByRole("article", { name: /^1 changed file in the worktree\./ });
    expect(block).toHaveTextContent(" M go.mod");
    expect(within(block).queryByRole("button")).not.toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("names the implementation that is next in a One-Shot task", () => {
    pane(
      { status: "blocked", block: { reason: "path_exists", detail: "", files: 0 } },
      { mode: "one_shot" },
    );

    expect(
      screen.getByRole("article", { name: "Implementation is next · add-login" }),
    ).toBeInTheDocument();
  });

  it("says every step is committed before the pull request", () => {
    pane({ status: "done" }, { currentStep: 0, repository: "acme/api" });

    const empty = placeEmpty();
    expect(empty).toHaveTextContent("Every step is committed");
    expect(empty).toHaveTextContent("1 step in acme/api. The pull request stage starts next.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("says the implementation of a One-Shot task is committed", () => {
    pane({ status: "done" }, { currentStep: 0, repository: "acme/api", mode: "one_shot" });

    const empty = placeEmpty();
    expect(empty).toHaveTextContent("The implementation is committed");
    expect(empty).toHaveTextContent("acme/api. The pull request stage starts next.");
  });

  it("says so when the plan has no steps", () => {
    pane(null);

    const empty = placeEmpty();
    expect(empty).toHaveTextContent("No steps were found");
    expect(empty).toHaveTextContent("The plan has no step files.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
