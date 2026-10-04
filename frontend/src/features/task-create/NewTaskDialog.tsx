import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/system/Collapsible";
import { DependencyNotice } from "@/components/system/DependencyNotice";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Field } from "@/components/system/Field";
import { Input } from "@/components/system/Input";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { SegmentedControl } from "@/components/system/SegmentedControl";
import { Select } from "@/components/system/Select";
import { StateGlyph } from "@/components/system/StateGlyph";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { unsatisfied } from "@/features/board/board-view";
import { dependencyNotice } from "@/features/board/card-panel";
import { ModelChip } from "@/features/models/ModelChip";
import { CardContextLine } from "@/features/task-create/CardContextLine";
import {
  CREATE_REASON,
  createBlock,
  nameProblemText,
  repositoryOptions,
} from "@/features/task-create/create-task";
import { findBoard } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import {
  adjustmentSummary,
  choiceLabel,
  choiceOf,
  modelStageLabel,
  modelStagesOf,
  sameChoice,
  withChoice,
} from "@/lib/models";
import { defaultRepositoryId, findRepository, takenNames } from "@/lib/repositories";
import { reviewModeHint, reviewModeLabel } from "@/lib/review-modes";
import { TASK_MODES, taskModeHint, taskModeLabel } from "@/lib/task-modes";
import { isValidTaskName, suggestTaskName, taskNameProblem } from "@/lib/task-name";
import {
  asReviewMode,
  type BoardCard,
  type ReviewMode,
  type StageModel,
  type TaskMode,
} from "@/lib/wails";
import { cloneRepository, createTask } from "@/store/actions";
import { useAppStore, useModelCatalog, useOpenTaskId } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

const NAME_HELP = "Lowercase letters, digits and hyphens. It names the branch and the worktree.";
const MODE_FIXED = "Fixed once the task exists.";
const HINT = "text-(length:--text-meta) leading-(--leading-meta) text-ink-3";
const REVIEW_MODE_ICONS = { agent: ICONS.agentMode, manual: ICONS.manualMode } as const;
/** DIALOG_REVIEW_MODES are the review modes as the creation dialog lists them: the agent first, as Structured leads Mode. */
const DIALOG_REVIEW_MODES: readonly ReviewMode[] = ["agent", "manual"];
const CONTEXT_HELP = "What you want to build, in your own words. High level or detailed.";

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

  if (cardRef !== null && card === null) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) {
            closeNewTask();
          }
        }}
        size="wide"
        title="New task"
      >
        <DialogBody>
          <SunkenLine>
            <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
            This card isn't in the last reading of the board.
          </SunkenLine>
        </DialogBody>
        <DialogFooter>
          <DialogCancel />
        </DialogFooter>
      </Dialog>
    );
  }
  return (
    <NewTaskFields
      origin={cardRef === null || card === null ? null : { boardId: cardRef.boardId, card }}
    />
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
  const openTaskId = useOpenTaskId();
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
  // A clone that could not start, by repository id: the dialog covers the banner that would say so.
  const [cloneErrors, setCloneErrors] = useState<Record<string, string>>({});
  // The choices start from the defaults the dialog opened with; adjusting them
  // changes this task only.
  const [choices, setChoices] = useState<StageModel[]>(() => [...defaults]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>(() => defaultMode);
  // Every task starts Structured: One-Shot is a choice made for the task at hand.
  const [mode, setMode] = useState<TaskMode>("structured");
  const reasonId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  // The choices hold every stage, so an adjustment to a stage both modes have
  // survives a change of mode; the list and its summary show the mode's own.
  const modelStages = modelStagesOf(mode);

  // The cursor starts after the name a card suggests, ready to add to it.
  useLayoutEffect(() => {
    const field = nameRef.current;
    field?.setSelectionRange(field.value.length, field.value.length);
  }, []);

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
  const block = createBlock({ repositoryId, problem, fromCard: origin !== null, context });
  const dependencies = origin === null ? [] : unsatisfied(origin.card);

  // A refusal belongs to what was sent: once a field changes, it is no longer about the form.
  const changeName = (value: string) => {
    setError(null);
    setName(value);
  };
  const changeContext = (value: string) => {
    setError(null);
    setContext(value);
  };
  const changeRepository = (id: string) => {
    setError(null);
    setChosenRepositoryId(id);
  };

  const create = () => {
    if (block !== null || creating) {
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

  const clone = (id: string) => {
    setCloneErrors(({ [id]: _, ...rest }) => rest);
    cloneRepository(id).catch((reason: unknown) =>
      setCloneErrors((current) => ({ ...current, [id]: messageOf(reason) })),
    );
  };

  // Ctrl+Enter, from any field, is the Dialog's; a plain Enter in the name creates too.
  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      create();
    }
  };

  // The last failure to start a clone shows under the field as well as on its item.
  const cloneError = Object.values(cloneErrors).at(-1);
  const footerReason =
    block !== null ? CREATE_REASON[block] : creating ? "Starting the first session…" : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Esc and × wait for the first session, like Cancel.
        if (!open && !creating) {
          closeNewTask();
        }
      }}
      size="wide"
      title="New task"
      onConfirm={create}
      initialFocus={nameRef}
    >
      <DialogBody>
        {origin === null ? (
          <Field label="Repository" {...(cloneError !== undefined ? { error: cloneError } : {})}>
            <Select
              label="Repository"
              value={repositoryId}
              options={app === null ? [] : repositoryOptions(app, cloneErrors, clone)}
              onValueChange={changeRepository}
              placeholder="Choose a repository"
              disabled={creating}
            />
          </Field>
        ) : (
          <SunkenLine>
            <span className="flex flex-col">
              <span>
                <span className="text-ink-3 tabular-nums">{`#${origin.card.number}`}</span>{" "}
                <span className="font-medium text-ink-1">{origin.card.title}</span>
              </span>
              <span className="text-ink-3">
                {[origin.card.repository, origin.card.status, origin.card.epic?.title]
                  .filter((part) => part !== undefined && part !== "")
                  .join(" · ")}
              </span>
            </span>
          </SunkenLine>
        )}

        <div className="flex flex-col gap-1">
          <Field
            label="Name"
            {...(problem === null || problem === "empty"
              ? { help: NAME_HELP }
              : {
                  error: nameProblemText(
                    problem,
                    name,
                    findRepository(app, repositoryId)?.fullName ?? "",
                  ),
                })}
          >
            <Input
              ref={nameRef}
              mono
              value={name}
              spellCheck={false}
              autoComplete="off"
              readOnly={creating}
              onChange={(event) => changeName(event.target.value)}
              onKeyDown={onNameKeyDown}
            />
          </Field>
          {canSuggest && (
            <Link
              href="#"
              onClick={(event) => {
                event.preventDefault();
                changeName(suggestion);
              }}
            >
              {`Use "${suggestion}"`}
            </Link>
          )}
        </div>

        {origin === null ? (
          <Field label="Context" help={CONTEXT_HELP}>
            <Textarea
              rows={4}
              value={context}
              readOnly={creating}
              onChange={(event) => changeContext(event.target.value)}
            />
          </Field>
        ) : (
          <CardContextLine
            boardId={origin.boardId}
            card={origin.card}
            additional={context}
            onAdditionalChange={changeContext}
            readOnly={creating}
          />
        )}

        {origin !== null &&
          dependencies.map((dependency) => {
            const model = dependencyNotice(dependency, origin.card.repository, "dialog");
            return <DependencyNotice key={model.key} model={model} />;
          })}

        <div className="grid grid-cols-2 gap-(--space-4)">
          <Field label="Mode">
            <SegmentedControl
              label="Mode"
              size="sm"
              value={mode}
              options={TASK_MODES.map((option) => ({
                value: option,
                label: taskModeLabel(option),
              }))}
              onValueChange={setMode}
              disabled={creating}
            />
            <p className={HINT}>{`${taskModeHint(mode)} ${MODE_FIXED}`}</p>
          </Field>
          <Field label="Review mode">
            <SegmentedControl
              label="Review mode"
              size="sm"
              value={reviewMode}
              options={DIALOG_REVIEW_MODES.map((option) => ({
                value: option,
                label: reviewModeLabel(option),
                icon: REVIEW_MODE_ICONS[option],
              }))}
              onValueChange={setReviewMode}
              disabled={creating}
            />
            <p className={HINT}>{reviewModeHint(reviewMode)}</p>
          </Field>
        </div>

        <Collapsible open={modelsOpen} onOpenChange={setModelsOpen} className="flex flex-col gap-2">
          <CollapsibleTrigger
            chevronSize="xs"
            className="flex h-(--size-control) items-center gap-2 rounded-sm text-left text-(length:--text-body) leading-(--leading-body) outline-none focus-visible:focus-ring"
          >
            <span className="font-medium text-ink-1">Models</span>
            <span className="ml-auto min-w-0 truncate text-(length:--text-meta) text-ink-3">
              {adjustmentSummary(catalog, choices, defaults, modelStages)}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {/* The rule between two rows is a shadow inside the lower one: a border would take a pixel
                off its height, and the chip it centres would fall on half a pixel. */}
            <ul className="flex flex-col rounded-md border border-line-1 [&>li+li]:shadow-[inset_0_var(--border)_0_var(--line-1)]">
              {modelStages.map((stage) => {
                const own = !sameChoice(choiceOf(choices, stage), choiceOf(defaults, stage));
                return (
                  <li
                    key={stage}
                    className="flex h-(--size-control) items-center justify-between gap-4 px-3 text-(length:--text-body)"
                  >
                    <span>{modelStageLabel(stage)}</span>
                    <ModelChip
                      size="sm"
                      label={modelStageLabel(stage)}
                      value={choiceOf(choices, stage)}
                      own={own}
                      followNote={`Defaults: ${choiceLabel(catalog, choiceOf(defaults, stage))}`}
                      onChange={(choice) =>
                        setChoices((current) => withChoice(current, stage, choice))
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </DialogBody>

      <DialogFooter
        {...(footerReason !== null ? { reason: { id: reasonId, text: footerReason } } : {})}
        {...(error !== null ? { refusal: error } : {})}
      >
        <DialogCancel disabled={creating} />
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          disabled={block !== null}
          {...(footerReason !== null ? { reasonId } : {})}
          loading={creating}
          loadingLabel="Creating…"
          onClick={create}
        >
          Create
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
