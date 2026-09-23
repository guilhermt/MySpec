import { ChevronRight, TriangleAlert } from "lucide-react";
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
import { unsatisfied } from "@/features/board/board-view";
import { ModelPicker } from "@/features/models/ModelPicker";
import { ReviewModePicker } from "@/features/review-mode/ReviewModePicker";
import { CardContextPreview } from "@/features/task-create/CardContextPreview";
import { CardSummary } from "@/features/task-create/CardSummary";
import { RepositoryPicker } from "@/features/task-create/RepositoryPicker";
import { findBoard, issueLabel, prStateLabel, stateLabel } from "@/lib/boards";
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
import {
  asIssueState,
  asPullRequestState,
  asReviewMode,
  type BoardCard,
  type ReviewMode,
  type StageModel,
  type TaskMode,
} from "@/lib/wails";
import { createTask } from "@/store/actions";
import { useAppStore, useModelCatalog } from "@/store/app-store";

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

/** CardOrigin is the card a task is created from, as the last reading of its board has it. */
interface CardOrigin {
  boardId: string;
  card: BoardCard;
}

function NewTaskForm() {
  const closeNewTask = useAppStore((state) => state.closeNewTask);
  const cardRef = useAppStore((state) => state.newTaskCard);
  const card = useAppStore((state) =>
    cardRef === null
      ? null
      : ((findBoard(state.app, cardRef.boardId)?.cards ?? []).find(
          (item) => item.key === cardRef.key,
        ) ?? null),
  );

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

        {cardRef !== null && card === null ? (
          <>
            <p className="text-sm text-muted-foreground">
              This card isn't in the last reading of the board.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeNewTask}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <NewTaskFields
            origin={cardRef === null || card === null ? null : { boardId: cardRef.boardId, card }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NewTaskFieldsProps {
  /** origin is the card the task is created from; null for a task without one. */
  origin: CardOrigin | null;
}

function NewTaskFields({ origin }: NewTaskFieldsProps) {
  const app = useAppStore((state) => state.app);
  const closeNewTask = useAppStore((state) => state.closeNewTask);
  const openTask = useAppStore((state) => state.openTask);
  const rememberRepository = useAppStore((state) => state.rememberRepository);
  const openTaskId = useAppStore((state) => state.openTaskId);
  const lastRepositoryId = useAppStore((state) => state.lastRepositoryId);

  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const catalog = useModelCatalog();
  const defaultMode = useAppStore((state) => asReviewMode(state.app?.reviewModeDefault ?? ""));

  const [chosenRepositoryId, setChosenRepositoryId] = useState(() =>
    app === null ? "" : defaultRepositoryId(app, openTaskId, lastRepositoryId),
  );
  // A card fixes the repository: the task belongs to the repository of its issue.
  const repositoryId = origin?.card.repositoryId ?? chosenRepositoryId;
  const [name, setName] = useState(() => origin?.card.suggestedName ?? "");
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
  // What the user adds to a card is optional; without a card it is all the task has.
  const canCreate =
    repositoryId !== "" &&
    problem === null &&
    (origin !== null || context.trim() !== "") &&
    !creating;
  const dependencies = origin === null ? [] : unsatisfied(origin.card);

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
      card: origin === null ? null : { boardId: origin.boardId, key: origin.card.key },
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {origin === null ? (
        <div className="flex flex-col gap-1.5">
          <Label>Repository</Label>
          <RepositoryPicker value={repositoryId} onChange={setChosenRepositoryId} />
        </div>
      ) : (
        <CardSummary card={origin.card} />
      )}

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

      {origin !== null && <CardContextPreview boardId={origin.boardId} card={origin.card} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-context">
          {origin === null ? "Initial context" : "Additional context"}
        </Label>
        <Textarea
          id="task-context"
          rows={origin === null ? 8 : 3}
          value={context}
          onChange={(event) => setContext(event.target.value)}
          onKeyDown={onContextKeyDown}
          className="max-h-[40dvh] field-sizing-content"
        />
        {origin === null && (
          <p className="text-xs text-muted-foreground">
            What you want to build, in your own words. High level or detailed.
          </p>
        )}
      </div>

      {dependencies.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-[var(--status-attention)]">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Unsatisfied dependencies
          </p>
          <ul className="flex flex-col gap-1.5">
            {dependencies.map((dependency) => (
              <li key={dependency.key} className="flex flex-col gap-0.5">
                <span>{`${issueLabel(dependency)} ${dependency.title}`}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    dependency.repository,
                    stateLabel(asIssueState(dependency.state)),
                    dependency.status,
                    ...(dependency.pullRequests ?? []).map(
                      (pr) =>
                        `PR ${pr.repository}#${pr.number} ${prStateLabel(asPullRequestState(pr.state))}`,
                    ),
                  ]
                    .filter((part) => part !== "")
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <Collapsible open={modelsOpen} onOpenChange={setModelsOpen} className="flex flex-col gap-1.5">
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
            {adjustmentSummary(catalog, choices, defaults, modelStages)}
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
                  onChange={(choice) => setChoices((current) => withChoice(current, stage, choice))}
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
  );
}
