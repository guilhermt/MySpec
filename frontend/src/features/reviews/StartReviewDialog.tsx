import { LoaderCircle } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ModelPicker } from "@/features/models/ModelPicker";
import { messageOf } from "@/lib/errors";
import { choiceOf, type ModelChoice } from "@/lib/models";
import { shortName } from "@/lib/repositories";
import {
  asPullReviewMode,
  type PullRequestRow,
  type PullReviewMode,
  type StageModel,
} from "@/lib/wails";
import { cloneRepository, startReview } from "@/store/actions";
import { useAppStore, useRepository, useReviewCenter, useStartReview } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

/** MODE_HINT says what each mode does with the findings the user approves. */
const MODE_HINT: Record<PullReviewMode, string> = {
  publish: "Publish posts the approved findings as a review on GitHub.",
  apply: "Apply has the agent fix the approved findings and push them to the pull request.",
};

/** MODE_LABEL names each mode in the toggle. */
const MODE_LABEL: Record<PullReviewMode, string> = { publish: "Publish", apply: "Apply" };

const MODES: readonly PullReviewMode[] = ["publish", "apply"];

/** StartReviewDialog starts the review of one pull request of the Reviews view. */
export function StartReviewDialog() {
  const pull = useStartReview();
  const closeStartReview = useAppStore((state) => state.closeStartReview);
  const center = useReviewCenter();
  const row =
    pull === null
      ? null
      : ((center.pullRequests ?? []).find(
          (candidate) =>
            candidate.repositoryId === pull.repositoryId && candidate.number === pull.number,
        ) ?? null);

  if (pull === null) {
    return null;
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeStartReview();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start review</DialogTitle>
        </DialogHeader>
        {row === null ? (
          <>
            <p className="text-sm text-muted-foreground">
              This pull request isn't in the last reading.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeStartReview}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <StartReviewFields row={row} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StartReviewFields({ row }: { row: PullRequestRow }) {
  const closeStartReview = useAppStore((state) => state.closeStartReview);
  const openReview = useAppStore((state) => state.openReview);
  const setPendingReview = useAppStore((state) => state.setPendingReview);
  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const repository = useRepository(row.repositoryId);

  const [instructions, setInstructions] = useState("");
  const [choice, setChoice] = useState<ModelChoice>(() => choiceOf(defaults, "pr_review"));
  // Every review starts in publish mode: applying is a choice made for the pull
  // request at hand, and only the user's own can be applied to.
  const [mode, setMode] = useState<PullReviewMode>("publish");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cloning, setCloning] = useState(false);
  const modeLabelId = useId();

  const needsClone = repository !== null && !repository.cloned;

  const clone = () => {
    setCloning(true);
    setError(null);
    cloneRepository(row.repositoryId)
      .then((started) => {
        if (started) {
          setPendingReview({ repositoryId: row.repositoryId, number: row.number });
          closeStartReview();
        }
      })
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setCloning(false));
  };

  const start = () => {
    if (starting || needsClone) {
      return;
    }
    setStarting(true);
    setError(null);
    startReview({
      repositoryId: row.repositoryId,
      number: row.number,
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    start();
  };

  const onInstructionsKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      start();
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
        <p className="text-sm">{`#${row.number} ${row.title}`}</p>
        <p className="text-xs text-muted-foreground">
          {[shortName(row.repository), row.author, row.card === null ? "" : `#${row.card.number}`]
            .filter((part) => part !== "")
            .join(" · ")}
        </p>
      </div>

      {needsClone ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            {`${row.repository} isn't cloned yet. The review needs a clone to work in.`}
          </p>
          {repository.cloning ? (
            <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              {`Cloning ${row.repository}…`}
            </p>
          ) : (
            <Button type="button" size="sm" disabled={cloning} onClick={clone}>
              Clone and continue
            </Button>
          )}
          {repository.cloneError !== "" && (
            <p role="alert" className="break-all text-sm text-destructive">
              {repository.cloneError}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-instructions">Instructions</Label>
            <Textarea
              id="review-instructions"
              rows={4}
              autoFocus
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              onKeyDown={onInstructionsKeyDown}
              className="max-h-[40dvh] field-sizing-content"
            />
            <p className="text-xs text-muted-foreground">What to look at in this pass. Optional.</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label>Model</Label>
            <ModelPicker label="Review" value={choice} onChange={setChoice} />
          </div>

          {/* Only a pull request of the user's own can be fixed by the agent. */}
          {row.own && (
            <div className="flex flex-col gap-1.5">
              <Label id={modeLabelId}>Mode</Label>
              <ToggleGroup
                aria-labelledby={modeLabelId}
                size="sm"
                value={[mode]}
                onValueChange={(next: string[]) => {
                  const [value] = next;
                  if (value !== undefined) {
                    setMode(asPullReviewMode(value));
                  }
                }}
              >
                {MODES.map((option) => (
                  <ToggleGroupItem key={option} value={option}>
                    {MODE_LABEL[option]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">{MODE_HINT[mode]}</p>
            </div>
          )}
        </>
      )}

      {error !== null && (
        <p role="alert" className="break-all text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={closeStartReview}>
          Cancel
        </Button>
        <Button type="submit" disabled={starting || needsClone}>
          {starting ? "Starting…" : "Start review"}
        </Button>
      </DialogFooter>
    </form>
  );
}
