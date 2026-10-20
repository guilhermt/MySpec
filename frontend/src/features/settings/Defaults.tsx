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
import { setPRReviewModeDefaultInPlace, setReviewModeDefaultInPlace } from "@/store/actions";
import { useAppStore, useModelCatalog } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

interface ModeSaving {
  saving: ReviewMode | null;
  failure: { mode: ReviewMode; message: string } | null;
  choose: (mode: ReviewMode) => Promise<void>;
}

// useModeSaving holds the saving and the failure of one row of review mode.
function useModeSaving(save: (mode: ReviewMode) => Promise<string | null>): ModeSaving {
  const [saving, setSaving] = useState<ReviewMode | null>(null);
  const [failure, setFailure] = useState<{ mode: ReviewMode; message: string } | null>(null);
  const choose = async (mode: ReviewMode) => {
    setSaving(mode);
    setFailure(null);
    const message = await save(mode);
    setSaving(null);
    if (message !== null) setFailure({ mode, message });
  };
  return { saving, failure, choose };
}

interface ReviewModeRowProps {
  title: string;
  sentence: string;
  label: string;
  subject: "steps" | "pr";
  value: ReviewMode;
  state: ModeSaving;
}

// ReviewModeRow is one subject of the review mode: its caption, the options and the failure to save.
function ReviewModeRow({ title, sentence, label, subject, value, state }: ReviewModeRowProps) {
  const { saving, failure, choose } = state;
  return (
    <div className="flex flex-col gap-(--space-2)">
      <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        <span className="font-medium text-ink-2">{title}</span>
        {" · "}
        <span>{sentence}</span>
      </p>
      <ReviewModeOptions
        subject={subject}
        label={label}
        value={value}
        saving={saving}
        layout="row"
        onChoose={(mode) => void choose(mode)}
      />
      {failure !== null && (
        <SaveFailure
          onRetry={() => void choose(failure.mode)}
          className="text-(length:--text-meta) leading-(--leading-meta)"
        >
          {`Couldn't save ${reviewModeLabel(failure.mode)}: ${failure.message}`}
        </SaveFailure>
      )}
    </div>
  );
}

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
  const prReviewMode = useAppStore((state) => asReviewMode(state.app?.prReviewModeDefault ?? ""));
  const steps = useModeSaving(setReviewModeDefaultInPlace);
  const pr = useModeSaving(setPRReviewModeDefaultInPlace);

  return (
    <SettingsPage
      title="Defaults"
      sentence="What a new task, review or discussion starts with. A change applies to what you create after it; nothing that runs changes."
    >
      <SettingsBlock title="Review mode">
        <ReviewModeRow
          title="Step review"
          sentence="Who reviews the steps of a new task"
          label="Review mode of a new task"
          subject="steps"
          value={reviewMode}
          state={steps}
        />
        <ReviewModeRow
          title="PR review"
          sentence="Who reviews the pull request of a new task"
          label="PR review mode of a new task"
          subject="pr"
          value={prReviewMode}
          state={pr}
        />
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
          A commit runs in the session of its step or of the implementer of its pull request review,
          with that session's model and effort.
        </p>
      </SettingsBlock>
    </SettingsPage>
  );
}
