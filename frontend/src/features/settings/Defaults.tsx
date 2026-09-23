import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import { ModelPicker } from "@/features/models/ModelPicker";
import { ReviewModePicker } from "@/features/review-mode/ReviewModePicker";
import {
  catalogFailureMessage,
  catalogModels,
  choiceOf,
  MODEL_STAGES,
  modelStageLabel,
} from "@/lib/models";
import { asCatalogFailure, asReviewMode, type StageModel } from "@/lib/wails";
import { setModelDefault, setReviewModeDefault } from "@/store/actions";
import { useAppStore, useModelCatalog } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

/** Defaults is what a new task starts with: who reviews its steps, and the model and effort of each stage. */
export function Defaults() {
  const models = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const catalog = useModelCatalog();
  const failure = asCatalogFailure(catalog.failure);
  const reviewMode = useAppStore((state) => asReviewMode(state.app?.reviewModeDefault ?? ""));
  const reviewTitleId = useId();
  const modelsTitleId = useId();

  return (
    <section className="h-full overflow-y-auto p-8">
      <div className="flex w-full max-w-[43rem] flex-col gap-8">
        <h2 className="text-[1.5rem] font-semibold">Defaults</h2>
        <section aria-labelledby={reviewTitleId} className="flex flex-col gap-3">
          <header className="flex flex-col gap-1">
            <h3 id={reviewTitleId} className="font-semibold">
              Review mode
            </h3>
            <p className="text-sm text-muted-foreground">
              Who reviews the steps of a new task. A change applies to the tasks created after it.
            </p>
          </header>
          <div>
            <ReviewModePicker
              label="New tasks"
              value={reviewMode}
              onChange={(mode) => void setReviewModeDefault(mode)}
            />
          </div>
        </section>
        <section aria-labelledby={modelsTitleId} className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h3 id={modelsTitleId} className="font-semibold">
              Models
            </h3>
            <p className="text-sm text-muted-foreground">
              The model and effort each stage of a new task starts with. The models and their effort
              levels come from the installed Claude Code, read when the app opens. A change applies
              to the tasks created after it.
            </p>
          </header>
          {catalogModels(catalog).length === 0 && failure !== "" && (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-sm text-[var(--status-attention)]"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {catalogFailureMessage(failure)}
            </p>
          )}
          <ul className="flex flex-col divide-y rounded-lg border">
            {MODEL_STAGES.map((stage) => (
              <li key={stage} className="flex h-12 items-center justify-between gap-4 px-4">
                <span className="text-sm font-medium">{modelStageLabel(stage)}</span>
                <ModelPicker
                  label={modelStageLabel(stage)}
                  value={choiceOf(models, stage)}
                  onChange={(choice) => void setModelDefault(stage, choice)}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            A commit runs in the session of its step or of its pull request review, with the model
            and effort of that session.
          </p>
        </section>
      </div>
    </section>
  );
}
