import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { PRTop, StepTop } from "@/features/task/TaskView";
import type { PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makePRImplementer,
  makePullRequest,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

// Vitest runs with css: false, so the stylesheet is read as text.
const GLOBALS = readFileSync(join(import.meta.dirname, "../../styles/globals.css"), "utf8");

const IMPLEMENTER_ASKS = makeSituation({
  id: "implementer-permission",
  kind: "permission",
  place: { kind: "step", stage: "", step: 1 },
  startedAt: "2026-09-05T10:05:00Z",
});

const REVIEWER_ASKS = makeSituation({
  id: "reviewer-question",
  kind: "question",
  place: { kind: "step_review", stage: "", step: 1 },
  startedAt: "2026-09-05T10:00:00Z",
});

function taskWith(step: Partial<Step>, situations: Situation[] = []) {
  const current = makeStep({
    status: "agent_review",
    reviewMode: "agent",
    reviewPass: 1,
    reviewer: makeStepReviewer({ sessionStatus: "working", processRunning: true }),
    ...step,
  });
  const task: TaskSummary = makeTask({
    stage: "implementation",
    steps: [current],
    currentStep: 1,
    sessionStatus: "idle",
    situations,
  });
  return { task, step: current };
}

function tabs(
  step: Partial<Step>,
  situations: Situation[] = [],
  ui: NonNullable<StoreOptions["ui"]> = {},
) {
  const { task, step: current } = taskWith(step, situations);
  return renderWithStore(<StepTop task={task} step={current} />, {
    state: makeState({ tasks: [task] }),
    ui,
  });
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const stored = () => useAppStore.getState().openStepTab["task-1|1"];

describe("AgentTabs of a step", () => {
  it("shows nothing while the step has no reviewer outside a review pass", () => {
    const { container } = tabs({ status: "implementing", reviewer: null });

    expect(container).toBeEmptyDOMElement();
    expect(stored()).toBeUndefined();
  });

  it("shows nothing once the step is being committed", () => {
    const { container } = tabs({ status: "committing" });

    expect(container).toBeEmptyDOMElement();
  });

  it("is one Tab stop, on the chosen tab, and each tab controls the conversation", async () => {
    const { user } = tabs({}, [], { openStepTab: { "task-1|1": "implementer" } });

    expect(screen.getByRole("tablist", { name: "Conversations" })).toBeInTheDocument();
    expect(tab(/^Implementer/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Reviewer/)).toHaveAttribute("aria-selected", "false");
    for (const each of screen.getAllByRole("tab")) {
      expect(each).toHaveAttribute("aria-controls", AGENT_CONVERSATION);
    }

    await user.tab();
    expect(tab(/^Implementer/)).toHaveFocus();
    await user.tab();
    expect(tab(/^Reviewer/)).not.toHaveFocus();
  });

  it("moves to the other conversation with → and back with ←", async () => {
    const { user } = tabs({}, [], { openStepTab: { "task-1|1": "implementer" } });

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(tab(/^Reviewer/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Reviewer/)).toHaveFocus();
    expect(stored()).toBe("reviewer");

    await user.keyboard("{ArrowLeft}");

    expect(tab(/^Implementer/)).toHaveAttribute("aria-selected", "true");
    expect(stored()).toBe("implementer");
  });

  it("says waits only on the tab not chosen", () => {
    tabs({}, [IMPLEMENTER_ASKS, REVIEWER_ASKS], { openStepTab: { "task-1|1": "reviewer" } });

    expect(tab(/^Implementer/)).toHaveTextContent("Implementer· waits");
    expect(tab(/^Implementer/)).toHaveAccessibleName(
      /^Implementer: waits for you: permission, for /,
    );
    expect(tab(/^Reviewer/)).toHaveTextContent(/^Reviewer$/);
    expect(tab(/^Reviewer/)).toHaveAccessibleName(/^Reviewer: waits for you: question, for /);
  });

  it("says error only on the tab not chosen", () => {
    tabs({ reviewer: makeStepReviewer({ sessionStatus: "error" }) }, [], {
      openStepTab: { "task-1|1": "implementer" },
    });

    expect(tab(/^Reviewer/)).toHaveTextContent("Reviewer· error");
    expect(tab(/^Implementer/)).toHaveTextContent(/^Implementer$/);
    expect(tab(/^Implementer/)).toHaveAccessibleName("Implementer: idle");
  });

  it("keeps the reviewer tab disabled until its session starts", async () => {
    const { user } = tabs({ reviewer: null });

    expect(tab(/^Reviewer/)).toHaveTextContent("Reviewer · starts with pass 1");
    expect(tab(/^Reviewer/)).toHaveAttribute("aria-disabled", "true");
    expect(tab(/^Reviewer/)).toHaveAccessibleName("Reviewer: starts with pass 1");

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(tab(/^Implementer/)).toHaveAttribute("aria-selected", "true");
  });

  it.each<[string, Partial<Step>, Situation[], "implementer" | "reviewer"]>([
    ["the older situation of the two", {}, [IMPLEMENTER_ASKS, REVIEWER_ASKS], "reviewer"],
    ["the only situation", { status: "addressing_review" }, [IMPLEMENTER_ASKS], "implementer"],
    ["the reviewer during a pass without situations", {}, [], "reviewer"],
    ["the implementer out of a pass", { status: "addressing_review" }, [], "implementer"],
  ])("opens the first time on %s, and stores it", (_, step, situations, first) => {
    tabs(step, situations);

    expect(stored()).toBe(first);
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(
      new RegExp(`^${first === "reviewer" ? "Reviewer" : "Implementer"}: `),
    );
  });

  it("waits to store a choice while the reviewer has no session and no situation asks, then picks the reviewer once it starts", () => {
    const { rerender } = tabs({ reviewer: null });
    expect(stored()).toBeUndefined();
    expect(tab(/^Implementer/)).toHaveAttribute("aria-selected", "true");

    const { task, step } = taskWith({});
    act(() => {
      useAppStore.getState().applyState(makeState({ tasks: [task] }));
    });
    rerender(<StepTop task={task} step={step} />);

    expect(stored()).toBe("reviewer");
    expect(tab(/^Reviewer/)).toHaveAttribute("aria-selected", "true");
  });

  it("never moves to another tab on its own after the first opening", () => {
    const { rerender } = tabs({ status: "addressing_review" });
    expect(stored()).toBe("implementer");

    const { task, step } = taskWith({ status: "agent_review" }, [REVIEWER_ASKS]);
    act(() => {
      useAppStore.getState().applyState(makeState({ tasks: [task] }));
    });
    rerender(<StepTop task={task} step={step} />);

    expect(stored()).toBe("implementer");
    expect(tab(/^Implementer/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Reviewer/)).toHaveTextContent("Reviewer· waits");
  });

  it("flashes the tab not chosen for a new situation, in the veil of its gravity", () => {
    tabs({}, [REVIEWER_ASKS], {
      openStepTab: { "task-1|1": "implementer" },
      flashing: new Set([REVIEWER_ASKS.id]),
    });

    expect(tab(/^Reviewer/)).toHaveClass("situation-flash");
    expect(tab(/^Reviewer/)).toHaveAttribute("data-flash", "wait");
    expect(tab(/^Implementer/)).not.toHaveAttribute("data-flash");
  });

  it("does not flash the chosen tab", () => {
    tabs({}, [REVIEWER_ASKS], {
      openStepTab: { "task-1|1": "reviewer" },
      flashing: new Set([REVIEWER_ASKS.id]),
    });

    expect(tab(/^Reviewer/)).not.toHaveAttribute("data-flash");
  });

  it("blinks twice for --duration-slow, and not at all with prefers-reduced-motion", () => {
    expect(GLOBALS).toContain(
      "animation: situation-flash var(--duration-slow) var(--ease-standard) 2;",
    );
    const reduced = [
      ...GLOBALS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g),
    ]
      .map((match) => match[1] ?? "")
      .join("\n");
    expect(reduced).toMatch(/\.situation-flash\[data-flash\] \{\s*animation: none;\s*\}/);
  });
});

const FIX_ASKS = makeSituation({
  id: "implementer-question",
  kind: "question",
  place: { kind: "pr_fix", stage: "", step: 0 },
  startedAt: "2026-09-05T10:05:00Z",
});

const FINDINGS = makeSituation({
  id: "findings",
  kind: "findings",
  form: "decide",
  place: { kind: "pr", stage: "", step: 0 },
  startedAt: "2026-09-05T10:00:00Z",
});

const REVIEWER_QUESTION = makeSituation({
  id: "pr-reviewer-question",
  kind: "question",
  place: { kind: "pr", stage: "", step: 0 },
  startedAt: "2026-09-05T10:00:00Z",
});

function prTaskWith(pr: Partial<PullRequest>, situations: Situation[] = [], review = "manual") {
  const current = makePullRequest({
    status: "awaiting_decision",
    sessionStage: "pr_review",
    sessionStatus: "waiting",
    prNumber: 7,
    ...pr,
  });
  const task: TaskSummary = makeTask({
    stage: "pr",
    pr: current,
    prReviewMode: review,
    conversations: [
      { stage: "pr", startedAt: "2026-09-05T09:00:00Z" },
      { stage: "pr_review", startedAt: "2026-09-05T09:30:00Z" },
    ],
    situations,
  });
  return { task, pr: current };
}

function prTabs(
  pr: Partial<PullRequest>,
  situations: Situation[] = [],
  ui: NonNullable<StoreOptions["ui"]> = {},
  review = "manual",
) {
  const { task, pr: current } = prTaskWith(pr, situations, review);
  return renderWithStore(<PRTop task={task} pr={current} />, {
    state: makeState({ tasks: [task] }),
    ui,
  });
}

const storedPR = () => useAppStore.getState().openStepTab["task-1|0"];

describe("AgentTabs of the review of the pull request", () => {
  it("shows nothing before the reviewer has its conversation", () => {
    const task: TaskSummary = makeTask({
      stage: "pr",
      pr: makePullRequest({ status: "drafting", sessionStage: "pr" }),
      conversations: [{ stage: "pr", startedAt: "2026-09-05T09:00:00Z" }],
    });
    const { container } = renderWithStore(<PRTop task={task} pr={task.pr as PullRequest} />, {
      state: makeState({ tasks: [task] }),
    });

    expect(container).toBeEmptyDOMElement();
    expect(storedPR()).toBeUndefined();
  });

  it("keeps the implementer tab disabled until its session starts, saying with what", () => {
    prTabs({}, [], {}, "agent");

    expect(tab(/^Implementer/)).toHaveTextContent("Implementer · starts with round 1");
    expect(tab(/^Implementer/)).toHaveAttribute("aria-disabled", "true");
    expect(tab(/^Implementer/)).toHaveAccessibleName("Implementer: starts with round 1");
  });

  it("starts the manual implementer with Apply approved", () => {
    prTabs({});

    expect(tab(/^Implementer/)).toHaveAccessibleName("Implementer: starts with Apply approved");
  });

  it("says the implementer never started once the review ended", () => {
    prTabs({ status: "done" });

    expect(tab(/^Implementer/)).toHaveAccessibleName("Implementer: never started");
  });

  it("is enabled and idle when the implementer's session was closed after it started", () => {
    prTabs({ implementerStarted: true, implementer: null });

    expect(tab(/^Implementer/)).not.toHaveAttribute("aria-disabled", "true");
    expect(tab(/^Implementer/)).toHaveAccessibleName("Implementer: idle");
  });

  it("moves between the conversations with the arrows and stores the choice in the slot of the PR", async () => {
    const { user } = prTabs(
      { implementer: makePRImplementer({ sessionStatus: "working", processRunning: true }) },
      [],
      { openStepTab: { "task-1|0": "reviewer" } },
    );

    await user.tab();
    await user.keyboard("{ArrowLeft}");

    expect(tab(/^Implementer/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Implementer/)).toHaveAccessibleName("Implementer: working");
    expect(storedPR()).toBe("implementer");
    expect(useAppStore.getState().openStepTab["task-1|1"]).toBeUndefined();
  });

  it("says waits on the tab not chosen, and the question of the reviewer only on its tab", () => {
    prTabs({ implementer: makePRImplementer() }, [FIX_ASKS, REVIEWER_QUESTION, FINDINGS], {
      openStepTab: { "task-1|0": "reviewer" },
    });

    expect(tab(/^Implementer/)).toHaveTextContent("Implementer· waits");
    expect(tab(/^Implementer/)).toHaveAccessibleName(/^Implementer: waits for you: question, for /);
    expect(tab(/^Reviewer/)).toHaveTextContent(/^Reviewer$/);
  });

  it("doesn't give the findings of the pull request to the reviewer's tab as a question", () => {
    prTabs({ implementer: makePRImplementer() }, [FINDINGS], {
      openStepTab: { "task-1|0": "implementer" },
    });

    expect(tab(/^Reviewer/)).toHaveAccessibleName("Reviewer: idle");
  });

  it.each<[string, Partial<PullRequest>, Situation[], "implementer" | "reviewer"]>([
    [
      "the older situation of the two",
      { implementer: makePRImplementer() },
      [FIX_ASKS, REVIEWER_QUESTION],
      "reviewer",
    ],
    [
      "the only situation, the implementer's",
      { implementer: makePRImplementer() },
      [FIX_ASKS],
      "implementer",
    ],
    [
      "the implementer while it addresses the review",
      { status: "addressing_review", implementer: makePRImplementer({ sessionStatus: "working" }) },
      [],
      "implementer",
    ],
  ])("opens the first time on %s, and stores it", (_, pr, situations, first) => {
    prTabs(pr, situations);

    expect(storedPR()).toBe(first);
  });

  it("waits to store a choice while nothing decides it", () => {
    prTabs({ status: "reviewing" });

    expect(storedPR()).toBeUndefined();
    expect(tab(/^Reviewer/)).toHaveAttribute("aria-selected", "true");
  });

  it("flashes the implementer's tab for its new situation", () => {
    prTabs({ implementer: makePRImplementer() }, [FIX_ASKS], {
      openStepTab: { "task-1|0": "reviewer" },
      flashing: new Set([FIX_ASKS.id]),
    });

    expect(tab(/^Implementer/)).toHaveAttribute("data-flash", "wait");
  });
});
