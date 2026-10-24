// internal/selfcontext/labels_test.go reads ui-labels.json too: it holds the
// labels the Go side repeats to the sessions, so a label that changes here
// changes there.
import { describe, expect, it } from "vitest";
import { voiceOf } from "@/features/chat/markers";
import { prStatusLabel } from "@/features/task/pr-status";
import { stepStatusLabel } from "@/features/task/step-status";
import { divergenceActions, divergenceText } from "@/lib/divergences";
import { troubleText } from "@/lib/pull-requests";
import { reviewModeLabel } from "@/lib/review-modes";
import { asLifecycleStage, stageLabel } from "@/lib/stages";
import { taskModeLabel } from "@/lib/task-modes";
import type { Divergence, PRStatus, PRTrouble, StepStatus } from "@/lib/wails";
import { asReviewMode, asTaskMode } from "@/lib/wails";
import labels from "@/test/ui-labels.json";
import { makeDivergence, makePullRequest, makeStep } from "@/test/wails-mock";

interface DivergenceCase {
  stage: string;
  kind: string;
  facts: Partial<Divergence>;
  expected: string;
  found: string;
  actions: string[];
}

interface TroubleCase {
  trouble: PRTrouble;
  base: string;
  label: string;
}

describe("the labels the Go side repeats", () => {
  it.each(Object.entries(labels.stages))("names the stage %s", (key, label) => {
    const stage = asLifecycleStage(key);
    expect(stage).not.toBeNull();
    expect(stage === null ? "" : stageLabel(stage)).toBe(label);
  });

  it.each(Object.entries(labels.modes))("names the task mode %s", (key, label) => {
    expect(taskModeLabel(asTaskMode(key))).toBe(label);
  });

  it.each(Object.entries(labels.reviewModes))("names the review mode %s", (key, label) => {
    expect(reviewModeLabel(asReviewMode(key))).toBe(label);
  });

  it.each(Object.entries(labels.stepStatuses))("names the step status %s", (key, label) => {
    expect(stepStatusLabel(makeStep({ status: key as StepStatus }))).toBe(label);
  });

  it.each(Object.entries(labels.prStatuses))("names the pull request status %s", (key, label) => {
    expect(prStatusLabel(makePullRequest({ status: key as PRStatus }))).toBe(label);
  });

  it.each(labels.troubles as TroubleCase[])("says the trouble $label", (c) => {
    expect(troubleText(c.trouble, c.base)).toBe(c.label);
  });

  it.each(Object.entries(labels.voices))("names the voice of %s", (stage, voice) => {
    expect(voiceOf(stage)).toBe(voice);
  });

  it.each(labels.divergences as DivergenceCase[])("says the divergence $kind of $stage", (c) => {
    const d = makeDivergence({ stage: c.stage, kind: c.kind, ...c.facts });
    expect(divergenceText(d)).toEqual({ expected: c.expected, found: c.found });
    expect(divergenceActions(d).map((a) => a.label)).toEqual(c.actions);
  });
});
