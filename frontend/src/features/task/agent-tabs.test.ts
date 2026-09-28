import { describe, expect, it } from "vitest";
import { type AgentTabModel, agentTabsOf } from "@/features/task/agent-tabs";
import type { Situation, Step, TaskSummary } from "@/lib/wails";
import { makeSituation, makeStep, makeStepReviewer, makeTask } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-27T15:00:00Z");
const MINUTES_AGO = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const reviewer = (sessionStatus: string, processRunning = true) =>
  makeStepReviewer({ sessionStage: "step_review:3", sessionStatus, processRunning });

function task(situations: Situation[] = [], session: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({ stage: "implementation", currentStep: 3, situations, ...session });
}

const step = (overrides: Partial<Step>) =>
  makeStep({
    number: 3,
    reviewMode: "agent",
    status: "agent_review",
    reviewer: reviewer("waiting"),
    ...overrides,
  });

function tab(
  overrides: Partial<AgentTabModel> & Pick<AgentTabModel, "tab" | "name" | "label">,
): AgentTabModel {
  return { glyph: "idle", word: "", disabled: false, situationId: null, ...overrides };
}

describe("agentTabsOf", () => {
  it.each<[string, TaskSummary, Step, "implementer" | "reviewer", AgentTabModel[]]>([
    [
      "the reviewer working, the implementer idle",
      task(),
      step({ reviewer: reviewer("working") }),
      "reviewer",
      [
        tab({ tab: "implementer", name: "Implementer", label: "Implementer: idle" }),
        tab({ tab: "reviewer", name: "Reviewer", glyph: "work", label: "Reviewer: working" }),
      ],
    ],
    [
      "the reviewer starting",
      task(),
      step({ reviewer: reviewer("working", false) }),
      "reviewer",
      [
        tab({ tab: "implementer", name: "Implementer", label: "Implementer: idle" }),
        tab({ tab: "reviewer", name: "Reviewer", glyph: "work", label: "Reviewer: starting" }),
      ],
    ],
    [
      "the implementer asking, out of view",
      task([
        makeSituation({
          id: "p",
          kind: "permission",
          place: { kind: "step", stage: "", step: 3 },
          startedAt: MINUTES_AGO(4),
        }),
      ]),
      step({}),
      "reviewer",
      [
        tab({
          tab: "implementer",
          name: "Implementer",
          glyph: "wait",
          word: "waits",
          label: "Implementer: waits for you: permission, for 4 minutes",
          situationId: "p",
        }),
        tab({ tab: "reviewer", name: "Reviewer", label: "Reviewer: idle" }),
      ],
    ],
    [
      "the implementer asking, in view",
      task([
        makeSituation({
          id: "p",
          kind: "permission",
          place: { kind: "step", stage: "", step: 3 },
          startedAt: MINUTES_AGO(4),
        }),
      ]),
      step({}),
      "implementer",
      [
        tab({
          tab: "implementer",
          name: "Implementer",
          glyph: "wait",
          label: "Implementer: waits for you: permission, for 4 minutes",
          situationId: "p",
        }),
        tab({ tab: "reviewer", name: "Reviewer", label: "Reviewer: idle" }),
      ],
    ],
    [
      "the reviewer's session failed, out of view",
      task([
        makeSituation({
          id: "e",
          kind: "session_error",
          group: "error",
          place: { kind: "step_review", stage: "", step: 3 },
          startedAt: MINUTES_AGO(5),
        }),
      ]),
      step({ reviewer: reviewer("error") }),
      "implementer",
      [
        tab({ tab: "implementer", name: "Implementer", label: "Implementer: idle" }),
        tab({
          tab: "reviewer",
          name: "Reviewer",
          glyph: "error",
          word: "error",
          label: "Reviewer: error: session error, for 5 minutes",
          situationId: "e",
        }),
      ],
    ],
    [
      "the implementer paused",
      task([], { sessionStatus: "paused" }),
      step({ status: "addressing_review" }),
      "implementer",
      [
        tab({
          tab: "implementer",
          name: "Implementer",
          glyph: "paused",
          label: "Implementer: paused",
        }),
        tab({ tab: "reviewer", name: "Reviewer", label: "Reviewer: idle" }),
      ],
    ],
    [
      "the pass before the reviewer's session",
      task([], { sessionStatus: "working", processRunning: true }),
      step({ reviewer: null }),
      "implementer",
      [
        tab({
          tab: "implementer",
          name: "Implementer",
          glyph: "work",
          label: "Implementer: working",
        }),
        tab({
          tab: "reviewer",
          name: "Reviewer",
          disabled: true,
          label: "Reviewer: starts with pass 1",
        }),
      ],
    ],
  ])("draws %s", (_, current, currentStep, chosen, tabs) => {
    expect(agentTabsOf(current, currentStep, chosen, NOW)).toEqual(tabs);
  });

  it.each<[string, Partial<Step>]>([
    ["a step implementing before its first pass", { status: "implementing", reviewer: null }],
    ["a Manual step", { status: "in_review", reviewMode: "manual", reviewer: null }],
    ["a step committing", { status: "committing" }],
    ["a step done", { status: "done" }],
  ])("has no tabs on %s", (_, overrides) => {
    expect(agentTabsOf(task(), step(overrides), "implementer", NOW)).toBeNull();
  });
});
