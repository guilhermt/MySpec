import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { lastRecordedPass, publishCounts, verdictLabel } from "@/features/reviews/review-status";
import { messageOf } from "@/lib/errors";
import { asReviewVerdict, type ReviewSummary, type ReviewVerdict } from "@/lib/wails";
import { publishReview } from "@/store/actions";

export interface PublishDialogProps {
  review: ReviewSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** onReviewAgain is the way out offered when the pull request moved since the pass. */
  onReviewAgain: () => void;
}

/** PublishDialog sends the pass the user decided on to GitHub, with a verdict. */
export function PublishDialog({ review, open, onOpenChange, onReviewAgain }: PublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form lives only while the dialog is open, so every opening starts without the last error. */}
      {open && (
        <PublishForm review={review} onOpenChange={onOpenChange} onReviewAgain={onReviewAgain} />
      )}
    </Dialog>
  );
}

type PublishFormProps = Omit<PublishDialogProps, "open">;

function PublishForm({ review, onOpenChange, onReviewAgain }: PublishFormProps) {
  const verdicts = review.verdicts ?? [];
  const [verdict, setVerdict] = useState<ReviewVerdict>(() =>
    asReviewVerdict(verdicts[0] ?? "comment"),
  );
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const labelId = useId();

  const pass = lastRecordedPass(review);

  const publish = () => {
    setPublishing(true);
    setError(null);
    publishReview(review.id, verdict, true)
      .then(() => {
        onOpenChange(false);
        setPublishing(false);
      })
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setPublishing(false);
      });
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Publish review</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label id={labelId}>Verdict</Label>
        <RadioGroup
          aria-labelledby={labelId}
          value={verdict}
          onValueChange={(value: string) => setVerdict(asReviewVerdict(value))}
        >
          {verdicts.map((option) => (
            // The label wraps the row, so the radio is named by the text beside it.
            <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem aria-labelledby={`${labelId}-${option}`} value={option} />
              <span id={`${labelId}-${option}`}>{verdictLabel(option)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {pass !== null && <p className="text-sm text-muted-foreground">{publishCounts(pass)}</p>}

      {review.stalePass && (
        <div className="flex flex-col items-start gap-2 rounded-lg border p-3">
          <p className="text-sm">
            The pull request has new commits since this pass. Findings on lines that left the diff
            go in the review body.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onReviewAgain();
            }}
          >
            Review again instead
          </Button>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="break-all text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" disabled={publishing} onClick={publish}>
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
