import { type RefObject, useRef, useState } from "react";
import { Popover } from "@/components/system/Popover";
import { Tooltip } from "@/components/system/Tooltip";
import { ModelChip } from "@/features/models/ModelChip";
import { choiceLabel, type ModelChoice, modelStageLabel } from "@/lib/models";
import {
  asModelStage,
  asTaskMode,
  type ModelStage,
  type TaskStageModel,
  type TaskSummary,
} from "@/lib/wails";
import { setStageModelInPlace } from "@/store/actions";
import { useModelCatalog } from "@/store/app-store";
import { SaveFailure } from "./SaveFailure";

export interface ModelsPopoverProps {
  task: TaskSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** anchor is what the popover opens against: the ⋯ button, or the chip in Details. */
  anchor: RefObject<HTMLElement | null>;
  /** finalFocus is where the focus returns on close: the anchor by default. */
  finalFocus?: RefObject<HTMLElement | null>;
}

/** RowSave is a choice of a row on its way: saving while failure is null, failed once it says why. */
interface RowSave {
  choice: ModelChoice;
  failure: string | null;
}

/** NOTE is what the popover says below the rows; a One-Shot task, whose steps are one, only its first sentence. */
const NOTE = "A stage takes its model when it starts.";
const STEP_NOTE = " Each step not started can have its own, in Details.";

/** stageName is the name of a row: the name the settings give the stage, but Planning in a One-Shot task. */
function stageName(stage: ModelStage): string {
  return stage === "one_shot" ? "Planning" : modelStageLabel(stage);
}

/**
 * ModelsPopover picks the model and the effort of each stage of a task, one row per stage in order:
 * a chip while the stage is still to start, the choice it runs with once it has started. The focus
 * opens on the first chip. A choice saves at once; when it fails, the reason is under the row, with
 * Try again, which makes the choice again.
 */
export function ModelsPopover({
  task,
  open,
  onOpenChange,
  anchor,
  finalFocus,
}: ModelsPopoverProps) {
  const firstChip = useRef<HTMLButtonElement>(null);
  const [saves, setSaves] = useState<Partial<Record<ModelStage, RowSave>>>({});
  const rows = task.models ?? [];
  const firstEditable = rows.find((row) => row.editable)?.stage;
  const oneShot = asTaskMode(task.mode) === "one_shot";

  const choose = async (stage: ModelStage, choice: ModelChoice) => {
    setSaves((current) => ({ ...current, [stage]: { choice, failure: null } }));
    const failure = await setStageModelInPlace(task.id, stage, choice);
    setSaves((current) => {
      const { [stage]: _, ...others } = current;
      return failure === null ? others : { ...others, [stage]: { choice, failure } };
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      {...(firstEditable !== undefined ? { initialFocus: firstChip } : {})}
      {...(finalFocus !== undefined ? { finalFocus } : {})}
      title="Models"
    >
      <ul className="flex flex-col">
        {rows.map((row) => {
          const stage = asModelStage(row.stage);
          const save = saves[stage];
          return (
            <li
              key={row.stage}
              className="flex flex-col not-first:shadow-[inset_0_var(--border)_0_var(--line-1)]"
            >
              <div className="flex min-h-(--size-control) items-center justify-between gap-(--space-3) text-(length:--text-ui) leading-(--leading-ui)">
                <span className="text-ink-1">{stageName(stage)}</span>
                {row.editable ? (
                  <ModelChip
                    {...(row.stage === firstEditable ? { ref: firstChip } : {})}
                    value={row}
                    onChange={(choice) => void choose(stage, choice)}
                    label={stageName(stage)}
                    own={false}
                    followNote=""
                    saving={save !== undefined && save.failure === null}
                  />
                ) : (
                  <StartedChoice row={row} />
                )}
              </div>
              {save !== undefined && save.failure !== null && (
                <SaveFailure
                  onRetry={() => void choose(stage, save.choice)}
                  className="pb-(--space-2) text-(length:--text-micro) leading-(--leading-micro)"
                >
                  {save.failure}
                </SaveFailure>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
        {oneShot ? NOTE : `${NOTE}${STEP_NOTE}`}
      </p>
    </Popover>
  );
}

/** StartedChoice is the choice of a stage that has started, which its session keeps. */
function StartedChoice({ row }: { row: TaskStageModel }) {
  const catalog = useModelCatalog();
  const note = row.live
    ? "Change it in the conversation, from the composer"
    : "The stage has started; its session keeps this model";
  return (
    <Tooltip content={note}>
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip opens on focus, so the keyboard reaches why the choice can't change here.
        tabIndex={0}
        className="rounded-xs text-(length:--text-meta) leading-(--leading-meta) text-ink-2 outline-none focus-visible:focus-ring"
      >
        {choiceLabel(catalog, row)}
        <span className="text-ink-3"> · started</span>
        <span className="sr-only">{`. ${note}`}</span>
      </span>
    </Tooltip>
  );
}
