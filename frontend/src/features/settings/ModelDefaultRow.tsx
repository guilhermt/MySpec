import { useState } from "react";
import { ModelChip } from "@/features/models/ModelChip";
import { chipName, chipNote } from "@/features/settings/defaults";
import { SaveFailure } from "@/features/task/SaveFailure";
import { choiceLabel, type ModelChoice, modelStageLabel, sameChoice } from "@/lib/models";
import type { ModelStage } from "@/lib/wails";
import { setModelDefaultInPlace } from "@/store/actions";
import { useModelCatalog } from "@/store/app-store";

export interface ModelDefaultRowProps {
  stage: ModelStage;
  /** note is said under the name of the stage: "Where a new discussion starts"; "" for none. */
  note: string;
  choice: ModelChoice;
  factory: ModelChoice;
}

/**
 * ModelDefaultRow is the row of a stage in Defaults: its name, and the chip that picks the model and
 * the effort it starts with. A choice saves at once, the chip saving meanwhile; when it fails the
 * chip keeps the saved choice and the row says so under it, with Try again.
 */
export function ModelDefaultRow({ stage, note, choice, factory }: ModelDefaultRowProps) {
  const catalog = useModelCatalog();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ choice: ModelChoice; message: string } | null>(null);

  const save = async (next: ModelChoice) => {
    setSaving(true);
    setFailure(null);
    const message = await setModelDefaultInPlace(stage, next);
    setSaving(false);
    if (message !== null) setFailure({ choice: next, message });
  };

  return (
    <li className="grid min-h-[calc(var(--size-control)+var(--space-2))] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-(--space-3) py-(--space-1) pr-(--space-2) pl-(--space-3) [&+li]:shadow-[inset_0_var(--border)_0_var(--line-1)]">
      <div className="flex min-w-0 flex-col">
        <span className="text-(length:--text-ui) leading-(--leading-ui) text-ink-1">
          {modelStageLabel(stage)}
        </span>
        {note !== "" && (
          <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
            {note}
          </span>
        )}
      </div>
      <ModelChip
        value={choice}
        onChange={(next) => void save(next)}
        label={modelStageLabel(stage)}
        own={!sameChoice(choice, factory)}
        followNote={chipNote(catalog, choice, factory)}
        accessibleName={chipName(catalog, stage, choice, factory)}
        factory={factory}
        saving={saving}
        size="sm"
      />
      {failure !== null && (
        <SaveFailure
          onRetry={() => void save(failure.choice)}
          className="col-span-full pb-(--space-1) text-(length:--text-meta) leading-(--leading-meta)"
        >
          {`Couldn't save ${choiceLabel(catalog, failure.choice)}: ${failure.message}`}
        </SaveFailure>
      )}
    </li>
  );
}
