import { useState } from "react";
import { Button } from "@/components/system/Button";
import { LiveRegion } from "@/components/system/LiveRegion";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Shimmer } from "@/components/system/Shimmer";
import { ReviewModeOptions } from "@/features/review-mode/ReviewModeOptions";
import { catalogNotice, changedText, MODEL_GROUPS } from "@/features/settings/defaults";
import { ModelDefaultRow } from "@/features/settings/ModelDefaultRow";
import { SettingsBlock, SettingsPage } from "@/features/settings/SettingsPage";
import { SaveFailure } from "@/features/task/SaveFailure";
import { catalogModels, choiceOf } from "@/lib/models";
import { reviewModeLabel } from "@/lib/review-modes";
import { asCatalogFailure, asReviewMode, type ReviewMode, type StageModel } from "@/lib/wails";
import { setReviewModeDefaultInPlace } from "@/store/actions";
import { useAppStore, useModelCatalog } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

/** Defaults is what a new task starts with: who reviews its steps, and the model and effort of each stage. */
export function Defaults() {
  const models = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const factory = useAppStore((state) => state.app?.modelFactory ?? NO_MODELS);
  const catalog = useModelCatalog();
  const openSettings = useAppStore((state) => state.openSettings);
  const failure = asCatalogFailure(catalog.failure);
  const reading = catalogModels(catalog).length === 0 && failure === "";
  const notice = catalogModels(catalog).length === 0 ? catalogNotice(failure) : null;
  const reviewMode = useAppStore((state) => asReviewMode(state.app?.reviewModeDefault ?? ""));
  const [saving, setSaving] = useState<ReviewMode | null>(null);
  const [saveFailure, setSaveFailure] = useState<{ mode: ReviewMode; message: string } | null>(
    null,
  );

  const choose = async (mode: ReviewMode) => {
    setSaving(mode);
    setSaveFailure(null);
    const message = await setReviewModeDefaultInPlace(mode);
    setSaving(null);
    if (message !== null) setSaveFailure({ mode, message });
  };

  return (
    <SettingsPage
      title="Defaults"
      sentence="What a new task, review or discussion starts with. A change applies to what you create after it; nothing that runs changes."
    >
      <SettingsBlock title="Review mode" sentence="Who reviews the steps of a new task">
        <ReviewModeOptions
          label="Review mode of a new task"
          value={reviewMode}
          saving={saving}
          layout="row"
          onChoose={(mode) => void choose(mode)}
        />
        {saveFailure !== null && (
          <SaveFailure
            onRetry={() => void choose(saveFailure.mode)}
            className="text-(length:--text-meta) leading-(--leading-meta)"
          >
            {`Couldn't save ${reviewModeLabel(saveFailure.mode)}: ${saveFailure.message}`}
          </SaveFailure>
        )}
      </SettingsBlock>
      <SettingsBlock
        title="Models"
        sentence={
          reading ? (
            <Shimmer>Reading the models of Claude Code…</Shimmer>
          ) : (
            changedText(models, factory)
          )
        }
      >
        <LiveRegion kind="status" as="div" className="empty:absolute">
          {notice !== null && (
            <NoticeStrip
              title={notice.title}
              reason={notice.text}
              action={
                <Button variant="ghost" size="sm" onClick={() => openSettings("machine")}>
                  Open Machine
                </Button>
              }
            />
          )}
        </LiveRegion>
        <div className="flex flex-col gap-(--space-4)">
          {MODEL_GROUPS.map((group) => (
            <fieldset
              key={group.label}
              aria-label={group.label}
              className="min-w-0 overflow-hidden rounded-md border border-line-1 py-(--space-1)"
            >
              {group.title !== null && (
                <p className="px-(--space-3) pt-(--space-1-5) pb-(--space-1) text-(length:--text-micro) leading-(--leading-micro) font-medium text-ink-3">
                  {group.title}
                </p>
              )}
              <ul>
                {group.stages.map(({ stage, note }) => (
                  <ModelDefaultRow
                    key={stage}
                    stage={stage}
                    note={note}
                    choice={choiceOf(models, stage)}
                    factory={choiceOf(factory, stage)}
                  />
                ))}
              </ul>
            </fieldset>
          ))}
        </div>
        <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          A commit runs in the session of its step or of its pull request review, with that
          session's model and effort.
        </p>
      </SettingsBlock>
    </SettingsPage>
  );
}
