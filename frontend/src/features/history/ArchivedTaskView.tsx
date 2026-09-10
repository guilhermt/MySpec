import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Markdown } from "@/features/chat/Markdown";
import { HistoryRepos } from "@/features/history/HistoryPanel";
import { formatDates, stepCount } from "@/features/history/history-format";
import { ErrorNotice } from "@/features/notice/Notice";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { StepDocument } from "@/features/task/StepDocument";
import { useArtifact } from "@/features/task/useArtifact";
import { findNode } from "@/features/tree/tree-model";
import type { ArchivedTask } from "@/lib/wails";
import { repoNodeId, useAppStore, useArchivedTask } from "@/store/app-store";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

const STEP_ROW =
  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent";

/** Selection is the tab on screen, or the step file it drilled into. */
type Selection = "prd" | "tech_spec" | "steps" | { step: string };

/** Tab is a Selection with nothing drilled into. */
type Tab = "prd" | "tech_spec" | "steps";

function isStep(selection: Selection): selection is { step: string } {
  return typeof selection === "object";
}

// The PRD is where a task began, so it is where reading it back begins too.
function firstTab(task: ArchivedTask): Tab {
  if (task.hasPrd) {
    return "prd";
  }
  return task.hasTechSpec ? "tech_spec" : "steps";
}

function artifactName(selection: Selection, task: ArchivedTask): string | null {
  if (isStep(selection)) {
    return `steps/${selection.step}`;
  }
  if (selection === "prd") {
    return task.hasPrd ? "PRD.md" : null;
  }
  if (selection === "tech_spec") {
    return task.hasTechSpec ? "tech-spec.md" : null;
  }
  return null;
}

export interface ArchivedTaskViewProps {
  taskId: string;
}

/**
 * ArchivedTaskView is a finished task as the history keeps it: the documents it
 * produced, and nothing that runs. Only going back and deleting are left.
 */
export function ArchivedTaskView({ taskId }: ArchivedTaskViewProps) {
  const task = useArchivedTask(taskId);
  const closeArchived = useAppStore((state) => state.closeArchived);
  const repoName = useAppStore((state) =>
    state.app === null || task === null || task.repoPath === ""
      ? ""
      : (findNode(state.app, repoNodeId(task.repoPath))?.label ?? ""),
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dismissed, setDismissed] = useState("");

  // Another task of the history brings its own documents; the tab starts over.
  // biome-ignore lint/correctness/useExhaustiveDependencies: that is what resets it
  useEffect(() => {
    setSelection(null);
  }, [taskId]);

  const steps = task?.steps ?? [];
  const chosen: Selection = selection ?? (task === null ? "prd" : firstTab(task));
  const openStep = isStep(chosen)
    ? (steps.find((step) => step.file === chosen.step) ?? null)
    : null;
  // A step the task no longer has falls back to the list it came from.
  const view: Selection = isStep(chosen) && openStep === null ? "steps" : chosen;
  const tab: Tab = isStep(view) ? "steps" : view;
  const artifact = useArtifact(
    taskId,
    task === null ? null : artifactName(view, task),
    task?.artifactVersion ?? 0,
  );

  if (task === null) {
    return <section className="h-dvh bg-background" />;
  }

  return (
    <section className="flex h-dvh min-w-0 flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" onClick={() => closeArchived()}>
          ← History
        </Button>
        <span className="min-w-0 truncate font-medium">{task.name}</span>
        <Badge variant="secondary">{task.repoPath === "" ? "Root" : repoName}</Badge>
        <Badge variant="outline">Archived</Badge>

        <span className="flex-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete task"
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
        </Button>

        <DeleteTaskDialog
          taskId={task.id}
          name={task.name}
          archived={true}
          open={deleting}
          onOpenChange={setDeleting}
        />
      </header>

      <div className="flex h-9 shrink-0 items-center gap-3 border-b px-3 text-xs text-muted-foreground">
        <span className="shrink-0">{formatDates(task.createdAt, task.archivedAt)}</span>
        <span className="shrink-0">{stepCount(steps.length)}</span>
        <HistoryRepos repos={task.repos ?? []} />
      </div>

      <div className="flex h-9 shrink-0 items-center border-b px-3">
        <ToggleGroup
          aria-label="Artifacts"
          size="sm"
          value={[tab]}
          onValueChange={(next: string[]) => {
            const [value] = next;
            if (value === "prd" || value === "tech_spec" || value === "steps") {
              setSelection(value);
            }
          }}
        >
          <ToggleGroupItem value="prd" disabled={!task.hasPrd}>
            PRD
          </ToggleGroupItem>
          <ToggleGroupItem value="tech_spec" disabled={!task.hasTechSpec}>
            Tech spec
          </ToggleGroupItem>
          <ToggleGroupItem value="steps" disabled={steps.length === 0}>
            {steps.length > 0 ? `Steps (${steps.length})` : "Steps"}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {openStep !== null && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3">
          <Button variant="ghost" size="sm" onClick={() => setSelection("steps")}>
            ← Steps
          </Button>
          <span className="min-w-0 truncate text-sm font-medium">{openStep.title}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {view === "steps" ? (
          <ol className="flex flex-col">
            {steps.map((step) => (
              <li key={step.file}>
                <button
                  type="button"
                  onClick={() => setSelection({ step: step.file })}
                  className={STEP_ROW}
                >
                  <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
                    {step.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{step.title}</span>
                  {step.repository !== "" && (
                    <Badge variant="secondary" className="shrink-0">
                      {step.repository}
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <>
            {artifact.status === "empty" && (
              <p className="text-sm text-muted-foreground italic">Nothing written yet.</p>
            )}
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
                <div className="max-w-[760px] select-text">
                  <Markdown>{artifact.content}</Markdown>
                </div>
              ) : (
                <StepDocument content={artifact.content} />
              ))}
          </>
        )}
      </div>
    </section>
  );
}
