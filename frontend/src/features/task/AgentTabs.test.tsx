import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENT_CONVERSATION, AgentTabs } from "@/features/task/AgentTabs";
import type { Situation, Step, TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import { makeSituation, makeState, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

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
  return renderWithStore(<AgentTabs task={task} step={current} />, {
    state: makeState({ tasks: [task] }),
    ui,
  });
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const stored = () => useAppStore.getState().openStepTab["task-1|1"];

describe("AgentTabs", () => {
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
    rerender(<AgentTabs task={task} step={step} />);

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
    rerender(<AgentTabs task={task} step={step} />);

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
