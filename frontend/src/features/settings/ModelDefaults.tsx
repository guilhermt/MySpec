import { ModelPicker } from "@/features/models/ModelPicker";
import { choiceOf, MODEL_STAGES, modelStageLabel } from "@/lib/models";
import type { StageModel } from "@/lib/wails";
import { setModelDefault } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

/** ModelDefaults is the model and effort each stage of a new task starts with. */
export function ModelDefaults() {
  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);

  return (
    <section className="h-full overflow-y-auto p-8">
      <div className="flex w-full max-w-[43rem] flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-[1.5rem] font-semibold">Models</h2>
          <p className="text-sm text-muted-foreground">
            The model and effort each stage of a new task starts with. A change applies to the tasks
            created after it.
          </p>
        </header>
        <ul className="flex flex-col divide-y rounded-lg border">
          {MODEL_STAGES.map((stage) => (
            <li key={stage} className="flex h-12 items-center justify-between gap-4 px-4">
              <span className="text-sm font-medium">{modelStageLabel(stage)}</span>
              <ModelPicker
                label={modelStageLabel(stage)}
                value={choiceOf(defaults, stage)}
                onChange={(choice) => void setModelDefault(stage, choice)}
              />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          A commit runs in the session of its step or of its pull request review, with the model and
          effort of that session.
        </p>
      </div>
    </section>
  );
}
