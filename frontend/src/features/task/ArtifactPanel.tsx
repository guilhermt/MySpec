import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Markdown } from "@/features/chat/Markdown";
import { ErrorNotice } from "@/features/notice/Notice";
import { OneShotView } from "@/features/task/OneShotView";
import { prReportLabel } from "@/features/task/pr-status";
import { StepDocument } from "@/features/task/StepDocument";
import { StepList } from "@/features/task/StepList";
import { useArtifact } from "@/features/task/useArtifact";
import { prOf } from "@/lib/pull-requests";
import { findStepReport, stepReportLabel } from "@/lib/review-modes";
import { stepSituation } from "@/lib/situations";
import {
  asTaskMode,
  asTaskStage,
  type PullRequest,
  type Step,
  type TaskMode,
  type TaskStage,
  type TaskSummary,
} from "@/lib/wails";
import { setStepModel, setStepReviewMode } from "@/store/actions";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/**
 * Selection is the tab the panel is on, or the document it drilled into: a step
 * file, a report of the agent review of a step, or one of the pull request
 * files.
 */
type Selection =
  | "prd"
  | "tech_spec"
  | "steps"
  | "one_shot"
  | "pr"
  | { step: string }
  | { report: string }
  | { pr: string };

/** Tab is a Selection with nothing drilled into. */
type Tab = "prd" | "tech_spec" | "steps" | "one_shot" | "pr";

// The document a stage was given to work from is the one worth having open.
const STRUCTURED_SELECTION: Record<TaskStage, Selection> = {
  prd: "prd",
  tech_spec: "prd",
  plan: "tech_spec",
  one_shot: "prd",
  implementation: "steps",
  pr: "pr",
};

/**
 * defaultSelection is what the panel opens on in a stage: for a One-Shot task,
 * its document until the pull request.
 */
function defaultSelection(mode: TaskMode, stage: TaskStage): Selection {
  if (mode === "one_shot") {
    return stage === "pr" ? "pr" : "one_shot";
  }
  return STRUCTURED_SELECTION[stage];
}

function isStep(selection: Selection): selection is { step: string } {
  return typeof selection === "object" && "step" in selection;
}

function isReport(selection: Selection): selection is { report: string } {
  return typeof selection === "object" && "report" in selection;
}

function isPRFile(selection: Selection): selection is { pr: string } {
  return typeof selection === "object" && "pr" in selection;
}

// The One-Shot document is read by OneShotView, so it names no file here.
function artifactName(selection: Selection, task: TaskSummary): string | null {
  if (isStep(selection)) {
    return `steps/${selection.step}`;
  }
  if (isReport(selection)) {
    return `step-reviews/${selection.report}`;
  }
  if (isPRFile(selection)) {
    return `pr/${selection.pr}`;
  }
  if (selection === "prd") {
    return task.hasPrd ? "PRD.md" : null;
  }
  if (selection === "tech_spec") {
    return task.hasTechSpec ? "tech-spec.md" : null;
  }
  return null;
}

/** prFiles is every pull request document a task has written. */
function prFiles(pr: PullRequest): { file: string; label: string }[] {
  const files = pr.draft === null ? [] : [{ file: pr.draft.file, label: "Draft" }];
  for (const report of pr.reports ?? []) {
    files.push({ file: report.file, label: prReportLabel(report.pass, report.clean) });
  }
  return files;
}

/** hasPRArtifacts reports whether the PR tab has anything to show. */
function hasPRArtifacts(task: TaskSummary): boolean {
  const pr = prOf(task);
  return pr !== null && prFiles(pr).length > 0;
}

function Empty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="font-medium">No artifacts yet</p>
      <p className="text-sm text-muted-foreground">
        The PRD will appear here as soon as the agent writes it.
      </p>
    </div>
  );
}

/** PRList is the pull request documents of a task. */
function PRList({ task, onOpen }: { task: TaskSummary; onOpen: (file: string) => void }) {
  const pr = prOf(task);
  const files = pr === null ? [] : prFiles(pr);

  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Nothing written yet.</p>;
  }

  return (
    <ul className="flex flex-col">
      {files.map((entry) => (
        <li key={entry.file}>
          <button
            type="button"
            onClick={() => onOpen(entry.file)}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            {entry.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface ArtifactPanelProps {
  task: TaskSummary;
}

/** ArtifactPanel shows what the task has written, next to the conversation. */
export function ArtifactPanel({ task }: ArtifactPanelProps) {
  const steps = task.steps ?? [];
  const mode = asTaskMode(task.mode);
  const stage = asTaskStage(task.stage);
  const [selection, setSelection] = useState<Selection>(defaultSelection(mode, stage));
  const [dismissed, setDismissed] = useState("");

  // A new stage brings a new document to read; the user is free from there on.
  useEffect(() => {
    setSelection(defaultSelection(mode, stage));
  }, [mode, stage]);

  const openStep = isStep(selection)
    ? (steps.find((step) => step.file === selection.step) ?? null)
    : null;
  const openReport = isReport(selection) ? findStepReport(steps, selection.report) : null;
  // A document the task no longer has falls back to the list it came from.
  const view =
    (isStep(selection) && openStep === null) || (isReport(selection) && openReport === null)
      ? "steps"
      : selection;
  const artifact = useArtifact(task.id, artifactName(view, task), task.artifactVersion);
  const anyPR = hasPRArtifacts(task);
  const tab: Tab = isStep(view) || isReport(view) ? "steps" : isPRFile(view) ? "pr" : view;

  const openStepFile = (step: Step) => setSelection({ step: step.file });

  return (
    <section className="flex h-full min-w-0 flex-col bg-background">
      <header className="flex h-9 shrink-0 items-center border-b px-3">
        <ToggleGroup
          aria-label="Artifacts"
          size="sm"
          value={[tab]}
          onValueChange={(next: string[]) => {
            const [value] = next;
            if (
              value === "prd" ||
              value === "tech_spec" ||
              value === "steps" ||
              value === "one_shot" ||
              value === "pr"
            ) {
              setSelection(value);
            }
          }}
        >
          {mode === "one_shot" ? (
            <ToggleGroupItem value="one_shot" disabled={!task.hasOneShot}>
              One-Shot
            </ToggleGroupItem>
          ) : (
            <>
              <ToggleGroupItem value="prd" disabled={!task.hasPrd}>
                PRD
              </ToggleGroupItem>
              <ToggleGroupItem value="tech_spec" disabled={!task.hasTechSpec}>
                Tech spec
              </ToggleGroupItem>
              <ToggleGroupItem value="steps" disabled={steps.length === 0}>
                {steps.length > 0 ? `Steps (${steps.length})` : "Steps"}
              </ToggleGroupItem>
            </>
          )}
          <ToggleGroupItem value="pr" disabled={!anyPR}>
            PR
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      {view === "one_shot" ? (
        <OneShotView
          key={task.id}
          taskId={task.id}
          hasDocument={task.hasOneShot}
          reports={steps[0]?.reports ?? []}
          artifactVersion={task.artifactVersion}
          empty="The One-Shot document will appear here as soon as the agent writes it."
        />
      ) : (
        <>
          {openStep !== null && (
            <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3">
              <Button variant="ghost" size="sm" onClick={() => setSelection("steps")}>
                ← Steps
              </Button>
              <span className="min-w-0 truncate text-sm font-medium">{openStep.title}</span>
            </div>
          )}

          {openReport !== null && (
            <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3">
              <Button variant="ghost" size="sm" onClick={() => setSelection("steps")}>
                ← Steps
              </Button>
              <span className="min-w-0 truncate text-sm font-medium">
                {`Step ${openReport.step.number} · ${stepReportLabel(openReport.report.pass, openReport.report.clean)}`}
              </span>
            </div>
          )}

          {isPRFile(view) && (
            <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3">
              <Button variant="ghost" size="sm" onClick={() => setSelection("pr")}>
                ← PR
              </Button>
              <span className="min-w-0 truncate text-sm font-medium">{view.pr}</span>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {view === "steps" ? (
              <StepList
                steps={steps}
                problems={task.planProblems ?? []}
                currentStep={task.currentStep}
                situation={stepSituation(task, task.currentStep)}
                onOpen={openStepFile}
                onModelChange={(step, choice) => void setStepModel(task.id, step.number, choice)}
                onReviewModeChange={(step, reviewMode) =>
                  void setStepReviewMode(task.id, step.number, reviewMode)
                }
                onOpenReport={(_, report) => setSelection({ report: report.file })}
              />
            ) : view === "pr" ? (
              <PRList task={task} onOpen={(file) => setSelection({ pr: file })} />
            ) : (
              <>
                {artifact.status === "empty" && <Empty />}
                {artifact.status === "loading" && (
                  <div className="flex flex-col gap-3">
                    {LOADING_WIDTHS.map((width) => (
                      <Skeleton key={width} className={`h-4 ${width}`} />
                    ))}
                  </div>
                )}
                {artifact.status === "error" && artifact.error !== dismissed && (
                  <ErrorNotice
                    message={artifact.error}
                    onDismiss={() => setDismissed(artifact.error)}
                  />
                )}
                {artifact.status === "ready" &&
                  (openStep === null ? (
                    <div className="max-w-[58.5rem] select-text">
                      <Markdown>{artifact.content}</Markdown>
                    </div>
                  ) : (
                    <StepDocument content={artifact.content} />
                  ))}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
