import { describe, expect, it } from "vitest";
import { loadingSteps, type PillModel, stepperOf } from "@/features/task/stepper";
import type { Place, PullRequest, Situation, Step, TaskSummary } from "@/lib/wails";
import {
  makePRCheck,
  makePullRequest,
  makeSituation,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTextPRReport,
} from "@/test/wails-mock";

const NOW = new Date(2026, 8, 27, 15, 0).getTime();
const PAUSED_AT = new Date(2026, 8, 27, 14, 52).toISOString();

/** steps is a plan of seven steps with the current one at n and the ones before it committed. */
function steps(n: number, current: Partial<Step>, count = 7): Step[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    if (number < n) {
      return makeStep({ number, status: "done" });
    }
    return number === n
      ? makeStep({ number, reviewMode: "agent", ...current })
      : makeStep({ number });
  });
}

function inStep(n: number, step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    reviewMode: "agent",
    currentStep: n,
    steps: steps(n, step),
    ...task,
  });
}

function oneShot(step: Partial<Step>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    mode: "one_shot",
    stage: "implementation",
    reviewMode: "agent",
    currentStep: 1,
    steps: [makeStep({ reviewMode: "agent", ...step })],
    ...task,
  });
}

function inPR(pr: Partial<PullRequest>, task: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({ stage: "pr", steps: steps(8, {}), pr: makePullRequest(pr), ...task });
}

const reviewer = (sessionStatus: string, pausedAt = "") =>
  makeStepReviewer({ sessionStage: "step_review:3", sessionStatus, pausedAt });

const read = "2026-09-27T14:58:00Z";
const checks = (passed: number, total: number) =>
  Array.from({ length: total }, (_, index) =>
    makePRCheck({ name: `check-${index}`, state: index < passed ? "passed" : "running" }),
  );
const reports = (count: number) =>
  Array.from({ length: count }, (_, index) => makeTextPRReport(index + 1, false));

const place = (kind: string, stage = "", step = 0): Place => ({ kind, stage, step });
const situation = (kind: string, group: string, where: Place, form = ""): Situation =>
  makeSituation({ kind, group, form, place: where });

/** pill is the expected pill: the name and state, and whatever else differs from an idle one. */
function pill(name: string, state: string, rest: Partial<PillModel> = {}): PillModel {
  return {
    name,
    position: "",
    qualifier: "",
    keepsQualifier: false,
    glyph: null,
    word: "",
    shimmer: false,
    paused: false,
    state,
    ...rest,
  };
}

const working = { glyph: "work", word: "working" } as const;

// One row per row of the pill table of the material, §4.2, in both modes.
describe("stepperOf, the pill", () => {
  it.each<[string, TaskSummary, PillModel]>([
    [
      "planning, working",
      makeTask({ stage: "prd", sessionStatus: "working" }),
      pill("PRD", "PRD agent working", working),
    ],
    [
      "planning, working without a process yet",
      makeTask({ stage: "plan", sessionStatus: "working", processRunning: false }),
      pill("Plan", "Plan agent working", working),
    ],
    [
      "planning revisited, working",
      makeTask({ stage: "tech_spec", revisiting: true, sessionStatus: "working" }),
      pill("Tech spec", "Tech spec agent working", { ...working, qualifier: "revisiting" }),
    ],
    [
      "planning revisited, idle",
      makeTask({ stage: "tech_spec", revisiting: true, sessionStatus: "waiting" }),
      pill("Tech spec", "idle", { qualifier: "revisiting" }),
    ],
    [
      "planning idle, the agent stopped on its own",
      makeTask({ stage: "prd", sessionStatus: "waiting" }),
      pill("PRD", "idle"),
    ],
    [
      "step not started",
      inStep(3, { status: "not_started" }),
      pill("Implementation", "preparing the worktree", {
        ...working,
        position: "3/7",
        qualifier: "preparing",
      }),
    ],
    [
      "step preparing",
      inStep(3, { status: "preparing" }),
      pill("Implementation", "preparing the worktree", {
        ...working,
        position: "3/7",
        qualifier: "preparing",
      }),
    ],
    [
      "step implementing, working",
      inStep(3, { status: "implementing" }, { sessionStatus: "working" }),
      pill("Implementation", "Implementer working", { ...working, position: "3/7" }),
    ],
    [
      "step agent_review, working",
      inStep(3, { status: "agent_review", reviewPass: 2, reviewer: reviewer("working") }),
      pill("Implementation", "Reviewer working", {
        ...working,
        position: "3/7",
        qualifier: "pass 2",
      }),
    ],
    [
      "step addressing_review, working",
      inStep(
        3,
        { status: "addressing_review", reviewRound: 1, reviewer: reviewer("waiting") },
        { sessionStatus: "working" },
      ),
      pill("Implementation", "Implementer working", {
        ...working,
        position: "3/7",
        qualifier: "round 1",
      }),
    ],
    [
      "step Manual, working",
      inStep(4, { status: "implementing", reviewMode: "manual" }, { sessionStatus: "working" }),
      pill("Implementation", "Implementer working", {
        ...working,
        position: "4/7",
        qualifier: "Manual",
      }),
    ],
    [
      "step Manual after a fallback, idle",
      inStep(4, { status: "in_review", reviewMode: "manual", reviewFallback: "rounds_exhausted" }),
      pill("Implementation", "idle", { position: "4/7", qualifier: "Manual" }),
    ],
    [
      "step committing",
      inStep(3, { status: "committing", reviewPass: 2 }),
      pill("Implementation", "committing", {
        ...working,
        position: "3/7",
        qualifier: "committing",
      }),
    ],
    [
      "step agent_review, the reviewer stopped on its own",
      inStep(3, { status: "agent_review", reviewPass: 2, reviewer: reviewer("waiting") }),
      pill("Implementation", "idle", { position: "3/7", qualifier: "pass 2" }),
    ],
    [
      "step implementing, the implementer stopped on its own",
      inStep(3, { status: "implementing" }, { sessionStatus: "waiting" }),
      pill("Implementation", "idle", { position: "3/7" }),
    ],
    [
      "every step committed, before the PR",
      makeTask({ stage: "implementation", currentStep: 0, steps: steps(8, {}) }),
      pill("Implementation", "starting the pull request", { ...working, position: "7/7" }),
    ],
    [
      "implementation with no step",
      makeTask({ stage: "implementation", currentStep: 0, steps: [] }),
      pill("Implementation", "idle"),
    ],
    ["PR preparing", inPR({ status: "preparing" }), pill("PR", "checking GitHub", working)],
    [
      "PR drafting, working",
      inPR({ status: "drafting", sessionStage: "pr", sessionStatus: "working" }),
      pill("PR", "PR agent working", working),
    ],
    ["PR drafting, idle", inPR({ status: "drafting", sessionStage: "pr" }), pill("PR", "idle")],
    ["PR opening", inPR({ status: "opening" }), pill("PR", "opening the pull request", working)],
    [
      "PR review waiting_checks, read with checks",
      inPR({
        status: "waiting_checks",
        prNumber: 1284,
        sessionStage: "",
        checkedAt: read,
        checks: checks(3, 5),
      }),
      pill("PR review", "waiting for the checks, 3 of 5 passed", {
        glyph: "github",
        word: "checks 3/5",
      }),
    ],
    [
      "PR review waiting_checks, before the first reading",
      inPR({ status: "waiting_checks", prNumber: 1284, sessionStage: "" }),
      pill("PR review", "checking GitHub", {
        glyph: "github",
        word: "checking GitHub",
        shimmer: true,
      }),
    ],
    [
      "PR review waiting_checks, read without checks",
      inPR({
        status: "waiting_checks",
        prNumber: 1284,
        sessionStage: "",
        checkedAt: read,
        checks: [],
      }),
      pill("PR review", "checking GitHub", {
        glyph: "github",
        word: "checking GitHub",
        shimmer: true,
      }),
    ],
    [
      "PR review reviewing, working",
      inPR({
        status: "reviewing",
        prNumber: 1284,
        sessionStage: "pr_review",
        sessionStatus: "working",
        reports: reports(1),
      }),
      pill("PR review", "PR agent working", { ...working, position: "pass 2" }),
    ],
    [
      "PR review awaiting_reply of a pass",
      inPR({
        status: "awaiting_reply",
        prNumber: 1284,
        sessionStage: "pr_review",
        reports: reports(1),
      }),
      pill("PR review", "idle", { position: "pass 2" }),
    ],
    [
      "PR review committing",
      inPR({
        status: "committing",
        prNumber: 1284,
        sessionStage: "pr_review",
        reports: reports(1),
      }),
      pill("PR review", "committing", { ...working, position: "pass 1", qualifier: "committing" }),
    ],
    [
      "PR review without work or situation",
      inPR({ status: "in_review", prNumber: 1284, sessionStage: "pr_review", reports: reports(2) }),
      pill("PR review", "idle", { position: "pass 2" }),
    ],
    [
      "Closing closing",
      inPR({ status: "closing", prNumber: 1284, sessionStage: "" }),
      pill("Closing", "closing the task", working),
    ],
    [
      "with a situation",
      inStep(
        3,
        { status: "agent_review", reviewPass: 2, reviewer: reviewer("needs_answer") },
        {
          situations: [situation("question", "waiting", place("step_review", "", 3))],
        },
      ),
      pill("Implementation", "waiting for you: question in Reviewer", {
        position: "3/7",
        qualifier: "pass 2",
        glyph: "wait",
      }),
    ],
    [
      "paused, with the time",
      inStep(3, { status: "implementing" }, { sessionStatus: "paused", pausedAt: PAUSED_AT }),
      pill("Implementation", "paused since 14:52", {
        position: "3/7",
        glyph: "paused",
        word: "paused",
        paused: true,
      }),
    ],
    [
      "paused, without the time",
      makeTask({ stage: "prd", sessionStatus: "paused", pausedAt: "" }),
      pill("PRD", "paused", { glyph: "paused", word: "paused", paused: true }),
    ],
    [
      "paused in a pass, the reviewer's pause",
      inStep(3, { status: "agent_review", reviewPass: 2, reviewer: reviewer("paused", PAUSED_AT) }),
      pill("Implementation", "paused since 14:52", {
        position: "3/7",
        qualifier: "pass 2",
        glyph: "paused",
        word: "paused",
        paused: true,
      }),
    ],
    // One-Shot: the implementation has no N/M, and the qualifier takes its place.
    [
      "One-Shot planning, working",
      makeTask({ mode: "one_shot", stage: "one_shot", sessionStatus: "working" }),
      pill("Planning", "Planning agent working", working),
    ],
    [
      "One-Shot planning idle",
      makeTask({ mode: "one_shot", stage: "one_shot", sessionStatus: "waiting" }),
      pill("Planning", "idle"),
    ],
    [
      "One-Shot preparing",
      oneShot({ status: "preparing" }),
      pill("Implementation", "preparing the worktree", {
        ...working,
        qualifier: "preparing",
        keepsQualifier: true,
      }),
    ],
    [
      "One-Shot implementing, working",
      oneShot({ status: "implementing" }, { sessionStatus: "working" }),
      pill("Implementation", "Implementer working", { ...working, keepsQualifier: true }),
    ],
    [
      "One-Shot agent_review, working",
      oneShot({
        status: "agent_review",
        reviewPass: 2,
        reviewer: makeStepReviewer({ sessionStatus: "working" }),
      }),
      pill("Implementation", "Reviewer working", {
        ...working,
        qualifier: "pass 2",
        keepsQualifier: true,
      }),
    ],
    [
      "One-Shot addressing_review, working",
      oneShot({ status: "addressing_review", reviewRound: 2 }, { sessionStatus: "working" }),
      pill("Implementation", "Implementer working", {
        ...working,
        qualifier: "round 2",
        keepsQualifier: true,
      }),
    ],
    [
      "One-Shot Manual, idle",
      oneShot({ status: "in_review", reviewMode: "manual" }),
      pill("Implementation", "idle", { qualifier: "Manual", keepsQualifier: true }),
    ],
    [
      "One-Shot committing",
      oneShot({ status: "committing" }),
      pill("Implementation", "committing", {
        ...working,
        qualifier: "committing",
        keepsQualifier: true,
      }),
    ],
    [
      "One-Shot committed, before the PR",
      makeTask({
        mode: "one_shot",
        stage: "implementation",
        currentStep: 0,
        steps: [makeStep({ status: "done" })],
      }),
      pill("Implementation", "starting the pull request", working),
    ],
    [
      "One-Shot paused, with the time",
      oneShot({ status: "implementing" }, { sessionStatus: "paused", pausedAt: PAUSED_AT }),
      pill("Implementation", "paused since 14:52", {
        keepsQualifier: true,
        glyph: "paused",
        word: "paused",
        paused: true,
      }),
    ],
    [
      "One-Shot PR review reviewing, working",
      inPR(
        {
          status: "reviewing",
          prNumber: 1284,
          sessionStage: "pr_review",
          sessionStatus: "working",
        },
        { mode: "one_shot", steps: [makeStep({ status: "done" })] },
      ),
      pill("PR review", "PR agent working", { ...working, position: "pass 1" }),
    ],
  ])("%s", (_, task, expected) => {
    expect(stepperOf(task, NOW).pill).toEqual(expected);
  });
});

describe("stepperOf, the name and the tooltip", () => {
  it.each<[string, TaskSummary, string, string[]]>([
    [
      "a pass waiting on a question",
      inStep(
        3,
        { status: "agent_review", reviewPass: 2, reviewer: reviewer("needs_answer") },
        {
          situations: [situation("question", "waiting", place("step_review", "", 3))],
        },
      ),
      "Progress · Implementation 3/7 · pass 2 · waiting for you: question in Reviewer",
      ["✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · pass 2  ○ PR  ○ PR review  ○ Closing"],
    ],
    [
      "a pull request waiting for its checks",
      inPR({
        status: "waiting_checks",
        prNumber: 1284,
        sessionStage: "",
        checkedAt: read,
        checks: checks(3, 5),
      }),
      "Progress · PR review · waiting for the checks, 3 of 5 passed",
      ["✓ PRD  ✓ Tech spec  ✓ Plan  ✓ Implementation  ✓ PR  ● PR review  ○ Closing"],
    ],
    [
      "a round of the implementer",
      inStep(3, { status: "addressing_review", reviewRound: 1 }, { sessionStatus: "working" }),
      "Progress · Implementation 3/7 · round 1 · Implementer working",
      ["✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · round 1  ○ PR  ○ PR review  ○ Closing"],
    ],
    [
      "a pause with its time",
      inStep(3, { status: "agent_review", reviewPass: 2, reviewer: reviewer("paused", PAUSED_AT) }),
      "Progress · Implementation 3/7 · pass 2 · paused since 14:52",
      [
        "✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · pass 2  ○ PR  ○ PR review  ○ Closing",
        "Paused since 14:52",
      ],
    ],
    [
      "a pause without its time",
      makeTask({ stage: "prd", sessionStatus: "paused" }),
      "Progress · PRD · paused",
      ["● PRD  ○ Tech spec  ○ Plan  ○ Implementation  ○ PR  ○ PR review  ○ Closing"],
    ],
    [
      "several situations",
      inStep(
        3,
        { status: "agent_review", reviewPass: 2, reviewer: reviewer("error") },
        {
          situations: [
            situation("session_error", "error", place("step_review", "", 3)),
            situation("permission", "waiting", place("step", "", 3)),
          ],
        },
      ),
      "Progress · Implementation 3/7 · pass 2 · error: session error in Reviewer, and 1 more",
      ["✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · pass 2  ○ PR  ○ PR review  ○ Closing"],
    ],
    [
      "a One-Shot pass",
      oneShot({
        status: "agent_review",
        reviewPass: 2,
        reviewer: makeStepReviewer({ sessionStatus: "working" }),
      }),
      "Progress · Implementation pass 2 · Reviewer working",
      ["✓ Planning  ● Implementation pass 2  ○ PR  ○ PR review  ○ Closing"],
    ],
    [
      "a One-Shot Manual review",
      oneShot({ status: "in_review", reviewMode: "manual" }),
      "Progress · Implementation Manual · idle",
      ["✓ Planning  ● Implementation Manual  ○ PR  ○ PR review  ○ Closing"],
    ],
  ])("says %s", (_, task, label, tooltip) => {
    const model = stepperOf(task, NOW);

    expect(model.label).toBe(label);
    expect(model.tooltip).toEqual(tooltip);
  });
});

// shown is the stepper as the scenes of the mock write it: ✓ for a done stage, [the pill], ○ for one to come.
function shown(task: TaskSummary): string {
  const { steps: stages, pill: current } = stepperOf(task, NOW);
  const glyphs = {
    work: "◌",
    wait: "●",
    error: "◆",
    close: "○",
    github: "◌",
    paused: "‖",
    idle: "○",
  };
  return stages
    .map((stage) => {
      if (stage.state === "done") {
        return "✓";
      }
      if (stage.state === "upcoming") {
        return `○ ${stage.name}`;
      }
      const position = current.position === "" ? "" : ` ${current.position}`;
      const qualifier = current.qualifier === "" ? "" : ` · ${current.qualifier}`;
      const glyph = current.glyph === null ? "" : ` ${glyphs[current.glyph]}`;
      const word = current.word === "" ? "" : ` ${current.word}`;
      return `[${current.name}${position}${qualifier}${glyph}${word}]`;
    })
    .join(" ");
}

// The nine scenes of the mock (§4.2, "As nove cenas"), on the reference task.
describe("stepperOf, the nine scenes", () => {
  it.each<[string, TaskSummary, string]>([
    [
      "plan",
      makeTask({
        stage: "prd",
        situations: [situation("reply", "waiting", place("stage", "prd"))],
      }),
      "[PRD ●] ○ Tech spec ○ Plan ○ Implementation ○ PR ○ PR review ○ Closing",
    ],
    [
      "run",
      inStep(
        3,
        { status: "addressing_review", reviewRound: 1, reviewer: reviewer("waiting") },
        { sessionStatus: "working" },
      ),
      "✓ ✓ ✓ [Implementation 3/7 · round 1 ◌ working] ○ PR ○ PR review ○ Closing",
    ],
    [
      "ask",
      inStep(
        3,
        { status: "agent_review", reviewPass: 2, reviewer: reviewer("needs_answer") },
        {
          sessionStatus: "needs_permission",
          situations: [
            situation("question", "waiting", place("step_review", "", 3)),
            situation("permission", "waiting", place("step", "", 3)),
          ],
        },
      ),
      "✓ ✓ ✓ [Implementation 3/7 · pass 2 ●] ○ PR ○ PR review ○ Closing",
    ],
    [
      "error",
      inStep(
        3,
        { status: "agent_review", reviewPass: 2, reviewer: reviewer("error") },
        {
          situations: [situation("session_error", "error", place("step_review", "", 3))],
        },
      ),
      "✓ ✓ ✓ [Implementation 3/7 · pass 2 ◆] ○ PR ○ PR review ○ Closing",
    ],
    [
      "manual",
      inStep(
        4,
        { status: "in_review", reviewMode: "manual" },
        {
          situations: [situation("step_review", "waiting", place("step", "", 4))],
        },
      ),
      "✓ ✓ ✓ [Implementation 4/7 · Manual ●] ○ PR ○ PR review ○ Closing",
    ],
    [
      "blocked",
      inStep(
        5,
        { status: "blocked" },
        { situations: [situation("step_blocked", "error", place("step", "", 5))] },
      ),
      "✓ ✓ ✓ [Implementation 5/7 ◆] ○ PR ○ PR review ○ Closing",
    ],
    [
      "checks",
      inPR({
        status: "waiting_checks",
        prNumber: 1284,
        sessionStage: "",
        checkedAt: read,
        checks: checks(3, 5),
      }),
      "✓ ✓ ✓ ✓ ✓ [PR review ◌ checks 3/5] ○ Closing",
    ],
    [
      "findings",
      inPR(
        {
          status: "awaiting_decision",
          prNumber: 1284,
          sessionStage: "pr_review",
          reports: reports(1),
        },
        { situations: [situation("findings", "waiting", place("pr"))] },
      ),
      "✓ ✓ ✓ ✓ ✓ [PR review pass 1 ●] ○ Closing",
    ],
    [
      "close",
      inPR(
        { status: "merged", prNumber: 1284, sessionStage: "pr_review", canClose: true },
        { situations: [situation("merge", "closing", place("pr"), "close")] },
      ),
      "✓ ✓ ✓ ✓ ✓ ✓ [Closing ○]",
    ],
  ])("draws the %s scene", (_, task, text) => {
    expect(shown(task)).toBe(text);
  });
});

describe("loadingSteps", () => {
  it("is the Structured stages, none current", () => {
    expect(loadingSteps()).toEqual(
      ["PRD", "Tech spec", "Plan", "Implementation", "PR", "PR review", "Closing"].map(
        (name, index) => ({
          id: ["prd", "tech_spec", "plan", "implementation", "pr", "pr_review", "closing"][index],
          name,
          state: "upcoming",
        }),
      ),
    );
  });
});
