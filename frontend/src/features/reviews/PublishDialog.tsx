import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/system/Badge";
import { Button } from "@/components/system/Button";
import { Checkbox } from "@/components/system/Checkbox";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { ICONS } from "@/components/system/icons";
import { OptionGroup } from "@/components/system/OptionGroup";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { Tooltip } from "@/components/system/Tooltip";
import {
  allowedVerdicts,
  goesLine,
  initialVerdict,
  publishLabel,
  publishReason,
  suggestedVerdict,
  summaryStart,
  VERDICTS,
} from "@/features/reviews/publish";
import { lastRecordedPass } from "@/features/reviews/review-status";
import { useFindingText } from "@/features/reviews/useFindingText";
import { messageOf } from "@/lib/errors";
import { counted, reviewName } from "@/lib/situations";
import {
  asReviewVerdict,
  type ReviewPass,
  type ReviewSummary,
  type ReviewVerdict,
} from "@/lib/wails";
import { publishReview, saveReviewSummary, saveReviewSummaryInPlace } from "@/store/actions";
import { useAppStore, usePublishAttempt } from "@/store/app-store";

export interface PublishDialogProps {
  review: ReviewSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** onReviewAgain is the way out offered when the pull request moved since the pass. */
  onReviewAgain: () => void;
}

/** PublishDialog sends the pass the user decided on to GitHub, with a verdict and, optionally, the summary. */
export function PublishDialog({ review, open, onOpenChange, onReviewAgain }: PublishDialogProps) {
  const pass = lastRecordedPass(review);
  // The form lives only while the dialog is open, so every opening starts from the last failed
  // attempt, without its error.
  if (!open || pass === null) {
    return null;
  }
  return (
    <PublishForm
      review={review}
      pass={pass}
      onOpenChange={onOpenChange}
      onReviewAgain={onReviewAgain}
    />
  );
}

interface PublishFormProps extends Omit<PublishDialogProps, "open"> {
  pass: ReviewPass;
}

const META = "text-(length:--text-meta) leading-(--leading-meta)";

// staleNote is what the dialog says when the pull request moved after the pass.
function staleNote(review: ReviewSummary): string {
  const arrived =
    review.staleCommits > 0
      ? `${counted(review.staleCommits, "commit")} arrived`
      : "New commits arrived";
  return `${arrived} after this pass. Findings on lines that left the diff go in the review body.`;
}

function PublishForm({ review, pass, onOpenChange, onReviewAgain }: PublishFormProps) {
  const attempt = usePublishAttempt(review.id);
  const setPublishAttempt = useAppStore((state) => state.setPublishAttempt);

  const text = useFindingText(
    review.id,
    pass.pass,
    "summary",
    pass.summary,
    pass.revision,
    (next) => void saveReviewSummary(review.id, pass.pass, next),
  );
  // The rules read the summary as it is typed, before the save reaches the pass.
  const live: ReviewPass = { ...pass, summary: text.value };

  const [withSummary, setWithSummary] = useState(
    attempt !== null && attempt.pass === pass.pass ? attempt.withSummary : true,
  );
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(() =>
    initialVerdict(allowedVerdicts(review, live, withSummary).allowed, attempt, pass.pass),
  );
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();

  const { allowed, reason } = allowedVerdicts(review, live, withSummary);
  const [only] = allowed;
  // The only verdict GitHub takes is the one chosen; a choice the summary made impossible is none.
  const chosen =
    verdict !== null && allowed.includes(verdict)
      ? verdict
      : allowed.length === 1 && only !== undefined
        ? only
        : null;
  const suggested = suggestedVerdict(review, live);
  const footerReason = publishReason(allowed, chosen);
  const hasSummary = text.value.trim() !== "";
  const approved = (pass.findings ?? []).some((finding) => finding.decision === "approved");

  // Closing the edit leaves the focus where the edit began, inside the dialog.
  const editOpened = useRef(false);
  useEffect(() => {
    if (editing) {
      editOpened.current = true;
    } else if (editOpened.current) {
      editOpened.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  // The digits choose a verdict from wherever the focus is, but the summary field types them.
  const latest = useRef({ allowed, publishing });
  useEffect(() => {
    latest.current = { allowed, publishing };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.target instanceof Element && event.target.closest("input, textarea")) return;
      const option = VERDICTS.find((each) => each.key === event.key);
      if (option === undefined) return;
      const { allowed: takes, publishing: busy } = latest.current;
      if (busy || !takes.includes(option.verdict)) return;
      event.preventDefault();
      setVerdict(option.verdict);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const publish = async () => {
    if (chosen === null || publishing) {
      return;
    }
    setPublishing(true);
    setError(null);
    const failed = (message: string) => {
      setError(message);
      setPublishAttempt(review.id, { pass: pass.pass, verdict: chosen, withSummary });
      setPublishing(false);
    };
    // The summary still waiting to be saved goes before the publication reads it; a summary that
    // did not save stops the publication, which would carry the old one.
    if (withSummary && text.value !== pass.summary) {
      const unsaved = await saveReviewSummaryInPlace(review.id, pass.pass, text.value);
      if (unsaved !== null) {
        failed(`Couldn't save the summary: ${unsaved}`);
        return;
      }
    }
    try {
      await publishReview(review.id, chosen, withSummary);
      setPublishAttempt(review.id, null);
      onOpenChange(false);
    } catch (reason: unknown) {
      failed(messageOf(reason));
    }
  };

  const options = VERDICTS.map((option) => {
    const taken = allowed.includes(option.verdict);
    return {
      value: option.verdict,
      key: option.key,
      title: option.name,
      note: option.description,
      ...(taken && suggested?.verdict === option.verdict
        ? {
            badge: (
              <Tooltip content={suggested.why}>
                <span>
                  <Badge variant="suggested">Suggested</Badge>
                </span>
              </Tooltip>
            ),
          }
        : {}),
      ...(!taken && reason !== null ? { disabledReason: reason } : {}),
    };
  });

  const carries =
    pass.clean || !approved
      ? "The review carries the verdict only."
      : "The review carries the verdict and the comments only.";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Esc and × wait for GitHub, like Cancel.
        if (!next && !publishing) {
          onOpenChange(false);
        }
      }}
      title={`Publish the review of ${reviewName(review)}`}
      onConfirm={() => void publish()}
      initialFocus={cancelRef}
    >
      <DialogBody className="gap-(--space-4)">
        {review.stalePass && (
          <SunkenLine
            icon={ICONS.details}
            action={
              <Button
                variant="ghost"
                size="xs"
                disabled={publishing}
                onClick={() => {
                  onOpenChange(false);
                  onReviewAgain();
                }}
              >
                Review again instead
              </Button>
            }
          >
            {staleNote(review)}
          </SunkenLine>
        )}

        <div inert={publishing} className="flex flex-col gap-(--space-1)">
          <span className={`${META} font-medium text-ink-2`}>Verdict</span>
          <OptionGroup
            label="Verdict"
            value={chosen}
            options={options}
            onChange={(value) => setVerdict(asReviewVerdict(value))}
          />
        </div>

        <SunkenLine>{goesLine(live, withSummary, chosen)}</SunkenLine>

        <div inert={publishing} className="flex flex-col gap-(--space-1)">
          <Checkbox
            checked={withSummary}
            onCheckedChange={(next) => {
              setWithSummary(next);
              if (!next) {
                setEditing(false);
              }
            }}
          >
            Include the summary
          </Checkbox>
          {withSummary && editing && (
            <Textarea
              aria-label="Summary"
              rows={5}
              autoFocus
              value={text.value}
              onChange={(event) => text.onChange(event.target.value)}
              onBlur={text.onBlur}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  // The edit closes first; the next Esc closes the dialog.
                  event.preventDefault();
                  event.stopPropagation();
                  setEditing(false);
                }
              }}
            />
          )}
          {withSummary && !editing && (
            <div className="flex flex-wrap items-center gap-(--space-2) px-(--space-2)">
              <span
                className={`min-w-0 flex-1 ${META} ${hasSummary ? "text-ink-2" : "text-ink-3"}`}
              >
                {hasSummary ? summaryStart(text.value) : "The summary is empty."}
              </span>
              <Button ref={editRef} variant="ghost" size="xs" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          )}
          {!withSummary && <p className={`px-(--space-2) ${META} text-ink-3`}>{carries}</p>}
        </div>
      </DialogBody>

      <DialogFooter
        {...(footerReason !== null ? { reason: { id: reasonId, text: footerReason } } : {})}
        {...(error !== null ? { refusal: error } : {})}
      >
        <DialogCancel ref={cancelRef} disabled={publishing} />
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          {...(chosen === null ? { disabled: true, reasonId } : {})}
          loading={publishing}
          loadingLabel="Publishing…"
          onClick={() => void publish()}
        >
          {publishLabel(chosen)}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
