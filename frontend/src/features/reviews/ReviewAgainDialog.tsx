import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Field } from "@/components/system/Field";
import { ICONS } from "@/components/system/icons";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { againNote, againText } from "@/features/reviews/review-again";
import { messageOf } from "@/lib/errors";
import { reviewName } from "@/lib/situations";
import type { ReviewSummary } from "@/lib/wails";
import { askReviewAgain } from "@/store/actions";

export interface ReviewAgainDialogProps {
  review: ReviewSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ReviewAgainDialog asks the agent for another pass over the pull request as it is now. */
export function ReviewAgainDialog({ review, open, onOpenChange }: ReviewAgainDialogProps) {
  // The form lives only while the dialog is open, so every opening starts without the last error.
  return open ? <ReviewAgainForm review={review} onOpenChange={onOpenChange} /> : null;
}

type ReviewAgainFormProps = Omit<ReviewAgainDialogProps, "open">;

function ReviewAgainForm({ review, onOpenChange }: ReviewAgainFormProps) {
  const [instructions, setInstructions] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const askRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  // The pass the user worked on and never published is what the new one replaces: the dialog says
  // so, and opens on Cancel so that Enter doesn't throw the work away.
  const note = againNote(review);

  useEffect(() => {
    if (instructionsOpen) {
      instructionsRef.current?.focus();
    }
  }, [instructionsOpen]);

  const ask = () => {
    if (asking) {
      return;
    }
    setAsking(true);
    setError(null);
    askReviewAgain(review.id, instructions)
      .then(() => onOpenChange(false))
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setAsking(false);
      });
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Esc and × wait for the answer, like Cancel.
        if (!next && !asking) {
          onOpenChange(false);
        }
      }}
      title={`Review ${reviewName(review)} again`}
      onConfirm={ask}
      initialFocus={note !== null ? cancelRef : askRef}
    >
      <DialogBody className="gap-(--space-4)">
        {note !== null && <SunkenLine icon={ICONS.details}>{note}</SunkenLine>}
        <p>{againText(review)}</p>

        {instructionsOpen ? (
          <Field
            label="Instructions"
            complement="optional"
            help="They go to the agent with the pull request, and show as your message."
          >
            <Textarea
              ref={instructionsRef}
              rows={3}
              placeholder="What to look at in this pass."
              value={instructions}
              readOnly={asking}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </Field>
        ) : (
          <div className="flex">
            <Button
              variant="ghost"
              size="xs"
              icon={ICONS.plus}
              disabled={asking}
              onClick={() => setInstructionsOpen(true)}
            >
              Add instructions
            </Button>
          </div>
        )}
      </DialogBody>

      <DialogFooter {...(error !== null ? { refusal: error } : {})}>
        <DialogCancel ref={cancelRef} disabled={asking} />
        <Button
          ref={askRef}
          variant="primary"
          shortcut="Ctrl ↵"
          loading={asking}
          loadingLabel="Asking…"
          onClick={ask}
        >
          Review again
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
