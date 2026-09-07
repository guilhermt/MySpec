import { Badge } from "@/components/ui/badge";
import { findNode } from "@/features/tree/tree-model";
import { cn } from "@/lib/utils";
import type { PlanProblem, State, Step } from "@/lib/wails";
import { repoNodeId, useAppStore } from "@/store/app-store";

const ROW = "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm";

// A step names its repository the way the plan wrote it; the list shows the
// name the tree gives that repository, which is what the user recognises.
function repoLabel(app: State | null, step: Step): string {
  if (app === null) {
    return step.repository;
  }
  return findNode(app, repoNodeId(step.repoPath))?.label ?? step.repository;
}

/** Problems is what keeps the step files from being a plan. */
function Problems({ problems }: { problems: readonly PlanProblem[] }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
    >
      <p className="font-medium">The step files aren't a valid plan</p>
      <ul className="flex flex-col gap-0.5 text-sm">
        {problems.map((problem) => (
          <li key={`${problem.file}:${problem.message}`} className="break-words select-text">
            {`${problem.file === "" ? "(plan)" : problem.file}: ${problem.message}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Row is one step, in the order the plan gave it. */
function Row({ step, app }: { step: Step; app: State | null }) {
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
      <span className="shrink-0 text-xs text-muted-foreground">Not started</span>
    </>
  );
}

export interface StepListProps {
  steps: readonly Step[];
  problems: readonly PlanProblem[];
  /** onOpen makes each step a way into the file behind it. */
  onOpen?: (step: Step) => void;
}

/** StepList is the plan of a task: what will be built, in which repository. */
export function StepList({ steps, problems, onOpen }: StepListProps) {
  const app = useAppStore((state) => state.app);

  return (
    <div className="flex flex-col gap-3">
      {problems.length > 0 && <Problems problems={problems} />}
      <ol className="flex flex-col">
        {steps.map((step) => (
          <li key={step.file}>
            {onOpen === undefined ? (
              <div className={ROW}>
                <Row step={step} app={app} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(step)}
                className={cn(ROW, "transition-colors hover:bg-accent")}
              >
                <Row step={step} app={app} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
