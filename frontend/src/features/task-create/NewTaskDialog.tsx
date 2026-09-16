import { ChevronRight } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ModelPicker } from "@/features/models/ModelPicker";
import { ReviewModePicker } from "@/features/review-mode/ReviewModePicker";
import { RepositoryPicker } from "@/features/task-create/RepositoryPicker";
import { messageOf } from "@/lib/errors";
import {
  adjustmentSummary,
  choiceOf,
  modelStageLabel,
  modelStagesOf,
  withChoice,
} from "@/lib/models";
import { defaultRepositoryId, findRepository, takenNames } from "@/lib/repositories";
import { reviewModeHint } from "@/lib/review-modes";
import { TASK_MODES, taskModeHint, taskModeLabel } from "@/lib/task-modes";
import {
  isValidTaskName,
  type NameProblem,
  suggestTaskName,
  TASK_NAME_MAX,
  taskNameProblem,
} from "@/lib/task-name";
import { cn } from "@/lib/utils";
import { asReviewMode, type ReviewMode, type StageModel, type TaskMode } from "@/lib/wails";
import { createTask } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

const NAME_HELP = "Lowercase letters, digits and hyphens.";

const NO_MODELS: readonly StageModel[] = [];

const NAME_PROBLEM_TEXT: Record<Exclude<NameProblem, "empty" | "taken">, string> = {
  invalid: "Use lowercase letters, digits and single hyphens.",
  too_long: `Use at most ${TASK_NAME_MAX} characters.`,
};

/** takenText names the task of the repository that already holds the name. */
function takenText(name: string, fullName: string): string {
  return `A task named ${name} already exists in ${fullName}.`;
}

export function NewTaskDialog() {
  const app = useAppStore((state) => state.app);
  const newTaskOpen = useAppStore((state) => state.newTaskOpen);

  if (!newTaskOpen || app === null) {
    return null;
  }
  // The form lives only while the dialog is open, so it opens empty every time.
  return <NewTaskForm />;
}

function NewTaskForm() {
  const app = useAppStore((state) => state.app);
  const closeNewTask = useAppStore((state) => state.closeNewTask);
  const openTask = useAppStore((state) => state.openTask);
  const rememberRepository = useAppStore((state) => state.rememberRepository);
  const openTaskId = useAppStore((state) => state.openTaskId);
  const lastRepositoryId = useAppStore((state) => state.lastRepositoryId);

  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const defaultMode = useAppStore((state) => asReviewMode(state.app?.reviewModeDefault ?? ""));

  const [repositoryId, setRepositoryId] = useState(() =>
    app === null ? "" : defaultRepositoryId(app, openTaskId, lastRepositoryId),
  );
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The choices start from the defaults the dialog opened with; adjusting them
  // changes this task only.
  const [choices, setChoices] = useState<StageModel[]>(() => [...defaults]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>(() => defaultMode);
  // Every task starts Structured: One-Shot is a choice made for the task at hand.
  const [mode, setMode] = useState<TaskMode>("structured");
  const modeLabelId = useId();
  // The choices hold every stage, so an adjustment to a stage both modes have
  // survives a change of mode; the list and its summary show the mode's own.
  const modelStages = modelStagesOf(mode);

  // Without a repository chosen no name is taken yet: the names of the other
  // repositories are none of this task's business.
  const taken = app === null || repositoryId === "" ? [] : takenNames(app, repositoryId);
  const problem = taskNameProblem(name, taken);
  const suggestion = suggestTaskName(name);
  const canSuggest =
    (problem === "invalid" || problem === "too_long") &&
    suggestion !== name &&
    isValidTaskName(suggestion);
  const canCreate = repositoryId !== "" && problem === null && context.trim() !== "" && !creating;

  const create = () => {
    if (!canCreate) {
      return;
    }
    setCreating(true);
    setError(null);
    void createTask({
      name,
      repositoryId,
      initialContext: context,
      mode,
      models: choices,
      reviewMode,
      card: null,
    })
      .then((id) => {
        rememberRepository(repositoryId);
        closeNewTask();
        openTask(id);
      })
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setCreating(false);
      });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create();
  };

  const onContextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      create();
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeNewTask();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Repository</Label>
            <RepositoryPicker value={repositoryId} onChange={setRepositoryId} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={name}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              aria-invalid={problem !== null && problem !== "empty"}
              onChange={(event) => setName(event.target.value)}
              className="font-mono"
            />
            {problem === null || problem === "empty" ? (
              <p className="text-xs text-muted-foreground">{NAME_HELP}</p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-destructive">
                {problem === "taken"
                  ? takenText(name, findRepository(app, repositoryId)?.fullName ?? "")
                  : NAME_PROBLEM_TEXT[problem]}
                {canSuggest && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => setName(suggestion)}
                    className="h-auto p-0"
                  >
                    {`Use "${suggestion}"`}
                  </Button>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-context">Initial context</Label>
            <Textarea
              id="task-context"
              rows={8}
              value={context}
              onChange={(event) => setContext(event.target.value)}
              onKeyDown={onContextKeyDown}
              className="max-h-[40dvh] field-sizing-content"
            />
            <p className="text-xs text-muted-foreground">
              What you want to build, in your own words. High level or detailed.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label id={modeLabelId}>Mode</Label>
            <ToggleGroup
              aria-labelledby={modeLabelId}
              size="sm"
              value={[mode]}
              onValueChange={(next: string[]) => {
                const [value] = next;
                if (value === "structured" || value === "one_shot") {
                  setMode(value);
                }
              }}
            >
              {TASK_MODES.map((option) => (
                <ToggleGroupItem key={option} value={option}>
                  {taskModeLabel(option)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{taskModeHint(mode)}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Review mode</Label>
            <div>
              <ReviewModePicker label="Task" value={reviewMode} onChange={setReviewMode} />
            </div>
            <p className="text-xs text-muted-foreground">{reviewModeHint(reviewMode)}</p>
          </div>

          <Collapsible
            open={modelsOpen}
            onOpenChange={setModelsOpen}
            className="flex flex-col gap-1.5"
          >
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex h-8 items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              }
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-[var(--duration-fast)]",
                  modelsOpen && "rotate-90",
                )}
              />
              <span className="font-medium">Models</span>
              <span className="min-w-0 truncate text-muted-foreground">
                {adjustmentSummary(choices, defaults, modelStages)}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col divide-y rounded-lg border">
                {modelStages.map((stage) => (
                  <li key={stage} className="flex h-11 items-center justify-between gap-4 px-3">
                    <span className="text-sm">{modelStageLabel(stage)}</span>
                    <ModelPicker
                      label={modelStageLabel(stage)}
                      value={choiceOf(choices, stage)}
                      onChange={(choice) =>
                        setChoices((current) => withChoice(current, stage, choice))
                      }
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>

          {error !== null && <p className="text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeNewTask}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
