import { describe, expect, it } from "vitest";
import { type AgentTabModel, agentTabsOf, prAgentTabsOf } from "@/features/task/agent-tabs";
import type { PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import {
  makePRImplementer,
  makePullRequest,
  makeSituation,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

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
  return {
    glyph: "idle",
    word: "",
    disabled: false,
    disabledLabel: "",
    situationId: null,
    ...overrides,
  };
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
      "the step in review by the user, which no conversation holds",
      task([
        makeSituation({
          id: "r",
          kind: "step_review",
          place: { kind: "step", stage: "", step: 3 },
          startedAt: MINUTES_AGO(2),
        }),
      ]),
      step({ reviewer: reviewer("waiting"), status: "in_review" }),
      "reviewer",
      [
        tab({ tab: "implementer", name: "Implementer", label: "Implementer: idle" }),
        tab({ tab: "reviewer", name: "Reviewer", label: "Reviewer: idle" }),
      ],
    ],
    [
      "the step without changes, which no conversation holds",
      task([
        makeSituation({
          id: "x",
          kind: "step_empty",
          place: { kind: "step", stage: "", step: 3 },
          startedAt: MINUTES_AGO(2),
        }),
      ]),
      step({ reviewer: reviewer("waiting"), status: "in_review" }),
      "reviewer",
      [
        tab({ tab: "implementer", name: "Implementer", label: "Implementer: idle" }),
        tab({ tab: "reviewer", name: "Reviewer", label: "Reviewer: idle" }),
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
          disabledLabel: "starts with pass 1",
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

describe("prAgentTabsOf", () => {
  const prReviewer = (overrides: Partial<PullRequest> = {}) =>
    makePullRequest({
      status: "awaiting_decision",
      sessionStage: "pr_review",
      sessionStatus: "waiting",
      ...overrides,
    });

  function prTask(
    pr: PullRequest,
    situations: Situation[] = [],
    overrides: Partial<TaskSummary> = {},
  ): TaskSummary {
    return makeTask({
      stage: "pr",
      pr,
      situations,
      conversations: [{ stage: "pr_review", startedAt: MINUTES_AGO(60) }],
      ...overrides,
    });
  }

  const disabledImplementer = (waits: string) =>
    tab({
      tab: "implementer",
      name: "Implementer",
      disabled: true,
      disabledLabel: waits,
      label: `Implementer: ${waits}`,
    });

  it("has no tabs before the reviewer's conversation exists", () => {
    const pr = makePullRequest({ status: "drafting", sessionStage: "pr" });

    expect(
      prAgentTabsOf(makeTask({ stage: "pr", pr, conversations: [] }), pr, "reviewer", NOW),
    ).toBeNull();
  });

  it.each<[string, PullRequest, Partial<TaskSummary>, string]>([
    [
      "an agent review before round 1",
      prReviewer(),
      { prReviewMode: "agent" },
      "starts with round 1",
    ],
    ["a manual review", prReviewer(), { prReviewMode: "manual" }, "starts with Apply approved"],
    [
      "a review that ended without it",
      prReviewer({ status: "done" }),
      { prReviewMode: "agent" },
      "never started",
    ],
    ["a merged pull request", prReviewer({ status: "merged" }), {}, "never started"],
  ])("disables the implementer on %s", (_, pr, overrides, waits) => {
    const [implementer] = prAgentTabsOf(prTask(pr, [], overrides), pr, "reviewer", NOW) ?? [];

    expect(implementer).toEqual(disabledImplementer(waits));
  });

  it("draws the reviewer working and the implementer idle and enabled once its session closed", () => {
    const pr = prReviewer({
      sessionStatus: "working",
      processRunning: true,
      implementerStarted: true,
    });

    expect(prAgentTabsOf(prTask(pr), pr, "reviewer", NOW)).toEqual([
      tab({ tab: "implementer", name: "Implementer", label: "Implementer: idle" }),
      tab({ tab: "reviewer", name: "Reviewer", glyph: "work", label: "Reviewer: working" }),
    ]);
  });

  it("keeps both tabs once the review ended, read-only", () => {
    const pr = prReviewer({
      status: "done",
      implementerStarted: true,
      implementer: makePRImplementer({ sessionStatus: "idle" }),
    });

    expect(prAgentTabsOf(prTask(pr), pr, "reviewer", NOW)).toHaveLength(2);
  });

  it("draws the implementer's session and its question, out of view", () => {
    const pr = prReviewer({
      implementerStarted: true,
      implementer: makePRImplementer({ sessionStatus: "working", processRunning: true }),
    });
    const asks = makeSituation({
      id: "q",
      kind: "question",
      place: { kind: "pr_fix", stage: "", step: 0 },
      startedAt: MINUTES_AGO(3),
    });

    const [implementer, reviewerTab] = prAgentTabsOf(prTask(pr, [asks]), pr, "reviewer", NOW) ?? [];

    expect(implementer).toMatchObject({
      glyph: "wait",
      word: "waits",
      situationId: "q",
      label: "Implementer: waits for you: question, for 3 minutes",
    });
    expect(reviewerTab).toMatchObject({ word: "" });
  });

  it("gives the reviewer only the situations of a conversation, not the ones of the pull request", () => {
    const pr = prReviewer();
    const findings = makeSituation({
      id: "f",
      kind: "findings",
      place: { kind: "pr", stage: "", step: 0 },
      startedAt: MINUTES_AGO(3),
    });
    const question = makeSituation({
      id: "q",
      kind: "question",
      place: { kind: "pr", stage: "", step: 0 },
      startedAt: MINUTES_AGO(3),
    });

    const [, withFindings] = prAgentTabsOf(prTask(pr, [findings]), pr, "implementer", NOW) ?? [];
    const [, withQuestion] = prAgentTabsOf(prTask(pr, [question]), pr, "implementer", NOW) ?? [];

    expect(withFindings).toMatchObject({ situationId: null, label: "Reviewer: idle" });
    expect(withQuestion).toMatchObject({ situationId: "q", word: "waits" });
  });
});
