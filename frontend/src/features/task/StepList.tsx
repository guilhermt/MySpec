import { Badge } from "@/components/ui/badge";
import { ToneDot } from "@/features/task/StatusDot";
import type { StatusTone } from "@/features/task/status";
import { stepStatusLabel, stepStatusTone } from "@/features/task/step-status";
import { findNode } from "@/features/tree/tree-model";
import { situationTone } from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { PlanProblem, Situation, State, Step } from "@/lib/wails";
import { repoNodeId, useAppStore } from "@/store/app-store";

const ROW = "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm";

// A step names its repository the way the plan wrote it; the list shows the
// name the tree gives that repository, which is what the user recognises.
export function repoLabel(app: State | null, step: Step): string {
  if (app === null) {
    return step.repository;
  }
  return findNode(app, repoNodeId(step.repoPath))?.label ?? step.repository;
}

/** ProblemList reads out every reason the step files are not a plan. */
export function ProblemList({ problems }: { problems: readonly PlanProblem[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {problems.map((problem) => (
        <li key={`${problem.file}:${problem.message}`} className="break-words select-text">
          {`${problem.file === "" ? "(plan)" : problem.file}: ${problem.message}`}
        </li>
      ))}
    </ul>
  );
}

/** Problems is what keeps the step files from being a plan. */
function Problems({ problems }: { problems: readonly PlanProblem[] }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
    >
      <p className="font-medium">The step files aren't a valid plan</p>
      <ProblemList problems={problems} />
    </div>
  );
}

interface RowProps {
  step: Step;
  app: State | null;
  current: boolean;
  tone: StatusTone;
}

/** Row is one step, in the order the plan gave it. */
function Row({ step, app, current, tone }: RowProps) {
  const label = repoLabel(app, step);

  return (
    <>
      <span className="w-6 shrink-0 text-muted-foreground tabular-nums">{step.number}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{step.title}</span>
      {label !== "" && (
        <Badge
          variant="secondary"
          className={cn("shrink-0", step.repoPath === "" && "text-destructive")}
        >
          {label}
        </Badge>
      )}
      {step.commitSha !== "" && (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 font-mono">{step.commitSha.slice(0, 7)}</span>
          <span className="truncate" title={step.commitSubject}>
            {step.commitSubject}
          </span>
        </span>
      )}
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 text-xs",
          !current && "text-muted-foreground",
        )}
      >
        <ToneDot tone={tone} />
        {stepStatusLabel(step)}
      </span>
    </>
  );
}

export interface StepListProps {
  steps: readonly Step[];
  problems: readonly PlanProblem[];
  /** currentStep is the step being run, 0 when none is. */
  currentStep: number;
  /** situation is what the step being run waits on the user for, null when nothing. */
  situation?: Situation | null;
  /** onOpen makes each step a way into the file behind it. */
  onOpen?: (step: Step) => void;
}

/** StepList is the plan of a task: what will be built, in which repository. */
export function StepList({
  steps,
  problems,
  currentStep,
  situation = null,
  onOpen,
}: StepListProps) {
  const app = useAppStore((state) => state.app);

  return (
    <div className="flex flex-col gap-3">
      {problems.length > 0 && <Problems problems={problems} />}
      <ol className="flex flex-col">
        {steps.map((step) => {
          const current = step.number === currentStep;
          const highlight = current && "bg-accent/60 font-medium";
          // Only the step being run can wait on the user, and then it takes the
          // colour of its situation; every other step shows its state.
          const tone =
            current && situation !== null ? situationTone(situation) : stepStatusTone(step);

          return (
            <li key={step.file} aria-current={current ? "step" : undefined}>
              {onOpen === undefined ? (
                <div className={cn(ROW, highlight)}>
                  <Row step={step} app={app} current={current} tone={tone} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(step)}
                  className={cn(ROW, "transition-colors hover:bg-accent", highlight)}
                >
                  <Row step={step} app={app} current={current} tone={tone} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
