import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Field } from "@/components/system/Field";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { SegmentedControl } from "@/components/system/SegmentedControl";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { ModelChip } from "@/features/models/ModelChip";
import { panelReason, prPanelModel } from "@/features/reviews/pr-panel";
import { rowReference } from "@/features/reviews/review-list";
import { messageOf } from "@/lib/errors";
import { choiceOf, type ModelChoice, sameChoice } from "@/lib/models";
import { type ChecksReading, checkCounts, unfinishedChecks } from "@/lib/pull-requests";
import { findRepository, shortName } from "@/lib/repositories";
import type { PullRequestRow, PullReviewMode, StageModel } from "@/lib/wails";
import { startReview } from "@/store/actions";
import { type PullRef, useAppStore, useReviewCenter, useStartReview } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

/** MODE_HINT says what each mode does with the findings the user approves, and that it is fixed. */
const MODE_HINT: Record<PullReviewMode, string> = {
  publish:
    "Publish posts the approved findings as a review on GitHub. Fixed once the review starts.",
  apply:
    "Apply has the agent fix the approved findings and push them to the pull request. Fixed once the review starts.",
};

const MODES = [
  { value: "publish", label: "Publish" },
  { value: "apply", label: "Apply" },
] as const satisfies readonly { value: PullReviewMode; label: string }[];

const HINT = "text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

/**
 * waitText is what the first pass waits for when the reading of the list says it has to: the checks
 * that are not finished, or GitHub saying whether the branch merges clean. Null when it starts at once.
 */
function waitText(reading: ChecksReading): string | null {
  if (unfinishedChecks(reading).length > 0) {
    const { passed, total } = checkCounts(reading);
    return `The first pass starts when the checks finish: ${passed} of ${total} passed. You can leave meanwhile.`;
  }
  if (reading.mergeable === "unknown" || reading.mergeable === "") {
    return "The first pass starts when GitHub says whether it merges clean. You can leave meanwhile.";
  }
  return null;
}

/** StartReviewDialog starts the review of one pull request of the Reviews view. */
export function StartReviewDialog() {
  const pull = useStartReview();
  const center = useReviewCenter();
  const key = pull === null ? null : `${pull.repositoryId}#${pull.number}`;
  const row =
    pull === null
      ? null
      : ((center.pullRequests ?? []).find(
          (candidate) =>
            candidate.repositoryId === pull.repositoryId && candidate.number === pull.number,
        ) ?? null);
  // The last row of this pull request the reading had: when a reading loses it, the dialog keeps
  // what it shows and what was typed, and says the pull request is gone.
  const seen = useRef<{ key: string | null; row: PullRequestRow | null }>({ key: null, row: null });
  useEffect(() => {
    seen.current = { key, row: row ?? (seen.current.key === key ? seen.current.row : null) };
  }, [key, row]);

  if (pull === null || key === null) {
    return null;
  }
  const shown = row ?? (seen.current.key === key ? seen.current.row : null);
  // Keyed by the pull request: a dialog opened for another one starts afresh, without what was
  // typed for the last.
  return <StartReviewFields key={key} pull={pull} row={shown} gone={row === null} />;
}

interface StartReviewFieldsProps {
  pull: PullRef;
  /** row is the pull request as the last reading has it; null when no reading ever had it. */
  row: PullRequestRow | null;
  /** gone is that the last reading no longer has the pull request. */
  gone: boolean;
}

function StartReviewFields({ pull, row, gone }: StartReviewFieldsProps) {
  const app = useAppStore((state) => state.app);
  const closeStartReview = useAppStore((state) => state.closeStartReview);
  const openReview = useAppStore((state) => state.openReview);
  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);

  const [instructions, setInstructions] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [choice, setChoice] = useState<ModelChoice>(() => choiceOf(defaults, "pr_review"));
  // Every review starts in publish mode: applying is a choice made for the pull request at hand,
  // and only the user's own can be applied to.
  const [mode, setMode] = useState<PullReviewMode>("publish");
  const [modeOpen, setModeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const reasonId = useId();

  // What each disclosure opens takes the focus: the field, or the segment chosen.
  useEffect(() => {
    if (instructionsOpen) {
      instructionsRef.current?.focus();
    }
  }, [instructionsOpen]);
  useEffect(() => {
    if (modeOpen) {
      modeRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    }
  }, [modeOpen]);

  const repository = findRepository(app, pull.repositoryId);
  const reference =
    row === null ? `${shortName(repository?.fullName ?? "")}#${pull.number}` : rowReference(row);
  const model = app === null || row === null ? null : prPanelModel(row, { app, now: Date.now() });
  // A repository without a clone reaches the dialog only by an old path: the panel offers the clone.
  const cloneReason =
    model !== null && model.action.kind === "clone" ? panelReason(model.action) : null;
  const waiting = model === null ? null : waitText(model.checks.reading);
  const blocked = gone
    ? `${reference} isn't in the last reading. It was merged or closed.`
    : cloneReason;
  const footerReason = blocked ?? (starting ? "Creating the worktree…" : null);

  const start = () => {
    if (starting || blocked !== null) {
      return;
    }
    setStarting(true);
    setError(null);
    startReview({
      repositoryId: pull.repositoryId,
      number: pull.number,
      instructions,
      model: choice.model,
      effort: choice.effort,
      mode,
    })
      .then((id) => {
        closeStartReview();
        openReview(id);
      })
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setStarting(false);
      });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Esc and × wait for the worktree, like Cancel.
        if (!open && !starting) {
          closeStartReview();
        }
      }}
      size="wide"
      title={`Review ${reference}`}
      onConfirm={start}
      initialFocus={startRef}
    >
      <DialogBody className="gap-(--space-4)">
        {row !== null && (
          <SunkenLine>
            <span className="flex flex-col">
              <span>
                <span className="text-ink-3 tabular-nums">{reference}</span>{" "}
                <span className="font-medium text-ink-1">{row.title}</span>
              </span>
              <span className="text-ink-3">
                {[
                  row.own ? "you" : row.author,
                  `${row.headBranch} → ${row.baseBranch}`,
                  ...(row.card === null ? [] : [`card #${row.card.number}`]),
                ].join(" · ")}
              </span>
            </span>
          </SunkenLine>
        )}

        {waiting !== null && <SunkenLine icon="github">{waiting}</SunkenLine>}

        <div inert={starting} className="flex flex-col gap-(--space-1)">
          <span className="text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2">
            Model
          </span>
          <div className="flex flex-wrap items-center gap-(--space-3)">
            <ModelChip
              label="Review"
              value={choice}
              own={!sameChoice(choice, choiceOf(defaults, "pr_review"))}
              followNote=""
              onChange={setChoice}
            />
            <span className={HINT}>From Defaults. It can change in the conversation.</span>
          </div>
        </div>

        {modeOpen && row?.own === true && (
          <Field label="Mode">
            <div ref={modeRef}>
              <SegmentedControl
                label="Mode"
                size="sm"
                value={mode}
                options={MODES}
                onValueChange={setMode}
                disabled={starting}
              />
            </div>
            <p className={HINT}>{MODE_HINT[mode]}</p>
          </Field>
        )}

        {instructionsOpen && (
          <Field
            label="Instructions"
            complement="optional"
            help="They go to the agent with the pull request, and show as your first message."
          >
            <Textarea
              ref={instructionsRef}
              rows={3}
              placeholder="What to look at in this pass."
              value={instructions}
              readOnly={starting}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </Field>
        )}

        {(!instructionsOpen || (row?.own === true && !modeOpen)) && (
          <div className="flex flex-wrap items-center gap-(--space-2)">
            {!instructionsOpen && (
              <Button
                variant="ghost"
                size="xs"
                icon={ICONS.plus}
                disabled={starting}
                onClick={() => setInstructionsOpen(true)}
              >
                Add instructions
              </Button>
            )}
            {row?.own === true && !modeOpen && (
              <Button
                variant="ghost"
                size="xs"
                disabled={starting}
                onClick={() => setModeOpen(true)}
              >
                {`Mode · ${MODES.find((option) => option.value === mode)?.label}`}
                <Icon icon={ICONS.chevron} size="xs" className="rotate-90" />
              </Button>
            )}
          </div>
        )}
      </DialogBody>

      <DialogFooter
        {...(footerReason !== null ? { reason: { id: reasonId, text: footerReason } } : {})}
        {...(error !== null ? { refusal: error } : {})}
      >
        <DialogCancel disabled={starting} />
        <Button
          ref={startRef}
          variant="primary"
          shortcut="Ctrl ↵"
          {...(blocked !== null ? { disabled: true, reasonId } : {})}
          loading={starting}
          loadingLabel="Starting…"
          onClick={start}
        >
          Start review
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
