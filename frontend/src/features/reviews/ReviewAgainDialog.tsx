import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { anyDecided, lastRecordedPass } from "@/features/reviews/review-status";
import { messageOf } from "@/lib/errors";
import type { ReviewSummary } from "@/lib/wails";
import { askReviewAgain } from "@/store/actions";

export interface ReviewAgainDialogProps {
  review: ReviewSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ReviewAgainDialog asks the agent for another pass over the pull request as it is now. */
export function ReviewAgainDialog({ review, open, onOpenChange }: ReviewAgainDialogProps) {
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const pass = lastRecordedPass(review);
  // A pass the user already worked on and never published is what the new one
  // replaces: what they decided and edited on it goes with it.
  const discards = pass !== null && !pass.published && (anyDecided(pass) || pass.edited);

  const ask = () => {
    setAsking(true);
    setError(null);
    askReviewAgain(review.id, instructions)
      .then(() => {
        onOpenChange(false);
        setAsking(false);
        setInstructions("");
      })
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setAsking(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review again</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-again-instructions">Instructions</Label>
          <Textarea
            id="review-again-instructions"
            rows={4}
            autoFocus
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            className="max-h-[40dvh] field-sizing-content"
          />
          <p className="text-xs text-muted-foreground">What to look at in this pass. Optional.</p>
        </div>

        {discards && pass !== null && (
          <p className="text-sm text-muted-foreground">
            {`The decisions and edits of review ${pass.pass} will be discarded.`}
          </p>
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
          <Button type="button" disabled={asking} onClick={ask}>
            {asking ? "Asking…" : "Review again"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
