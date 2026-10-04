import { useEffect, useId, useState } from "react";
import { Button } from "@/components/system/Button";
import { Checkbox } from "@/components/system/Checkbox";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Shimmer } from "@/components/system/Shimmer";
import {
  discardStepTexts,
  interruptedSentence,
  interruptedSessions,
} from "@/features/task/deletion";
import { usePreviewReading } from "@/features/task/usePreviewReading";
import { asTaskMode, type Step, type TaskSummary } from "@/lib/wails";
import { discardStepInPlace, focusRequestAfterRestart } from "@/store/actions";

export interface DiscardStepDialogProps {
  task: TaskSummary;
  step: Step;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DiscardStepDialog is the last stop before a step is run again from scratch. Cleaning the worktree
 * is the usual choice, so it comes checked, with the uncommitted files counted from git when the
 * dialog opens. A refusal stays in its footer.
 */
export function DiscardStepDialog({ task, step, open, onOpenChange }: DiscardStepDialogProps) {
  const [clean, setClean] = useState(true);
  const [discarding, setDiscarding] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const reading = usePreviewReading(task.id, open, task.worktreePath !== "");
  const describedBy = useId();
  const texts = discardStepTexts(task, step, reading, clean);
  const subject =
    asTaskMode(task.mode) === "one_shot" ? "the implementation" : `step ${step.number}`;

  // Every opening starts from the default, whatever the last one settled on.
  useEffect(() => {
    if (open) {
      setClean(true);
      setRefusal(null);
    }
  }, [open]);

  const discard = async () => {
    if (discarding) {
      return;
    }
    setDiscarding(true);
    setRefusal(null);
    const message = await discardStepInPlace(task.id, clean);
    setDiscarding(false);
    if (message === null) {
      onOpenChange(false);
      focusRequestAfterRestart();
    } else {
      setRefusal(`Couldn't discard ${subject}: ${message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && discarding) {
          return;
        }
        onOpenChange(next);
      }}
      closeDisabled={discarding}
      title={texts.title}
      alert
    >
      <DialogBody>
        <p>{texts.body}</p>
        <div className="flex flex-col gap-(--space-1) rounded-md border border-line-2 px-(--space-3) py-(--space-2-5)">
          <Checkbox
            checked={clean}
            onCheckedChange={setClean}
            disabled={discarding}
            describedBy={describedBy}
            className="px-0 font-medium"
          >
            Also clean the worktree
          </Checkbox>
          <p
            id={describedBy}
            className="pl-(--icon) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
          >
            {reading.kind === "reading" ? (
              <Shimmer>{texts.checkboxDescription}</Shimmer>
            ) : (
              texts.checkboxDescription
            )}
          </p>
        </div>
        {texts.readError !== null && (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            {texts.readError}
          </p>
        )}
        {interruptedSessions(task).map((role) => (
          <p key={role} className="text-ink-3">
            {interruptedSentence(role)}
          </p>
        ))}
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={discarding} />
        <Button
          variant="danger"
          loading={discarding}
          loadingLabel="Discarding…"
          onClick={() => void discard()}
        >
          {texts.confirm}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
