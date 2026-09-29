import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { asTaskMode, type Step, type TaskSummary } from "@/lib/wails";
import { cleanAndStartStep } from "@/store/actions";

/** MAX_LINES is how many changes the dialog lists before it counts the rest. */
const MAX_LINES = 12;

export interface CleanAndStartDialogProps {
  task: TaskSummary;
  step: Step;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CleanAndStartDialog is the last stop before the changes that block a step are thrown away and
 * the step starts: the changes git listed, as git listed them.
 */
export function CleanAndStartDialog({ task, step, open, onOpenChange }: CleanAndStartDialogProps) {
  const title =
    asTaskMode(task.mode) === "one_shot"
      ? "Clean the worktree and start the implementation?"
      : `Clean the worktree and start step ${step.number}?`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} alert>
      {/* The body lives only while the dialog is open, so every opening starts without the last failure. */}
      {open && <CleanAndStartBody taskId={task.id} step={step} onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function CleanAndStartBody({
  taskId,
  step,
  onOpenChange,
}: {
  taskId: string;
  step: Step;
  onOpenChange: (open: boolean) => void;
}) {
  const [cleaning, setCleaning] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const lines = (step.block?.detail ?? "").split("\n").filter((line) => line.trim() !== "");
  const shown = lines.slice(0, MAX_LINES);
  const more = lines.length - shown.length;

  const clean = async () => {
    setCleaning(true);
    const failure = await cleanAndStartStep(taskId);
    setCleaning(false);
    if (failure === null) {
      onOpenChange(false);
    } else {
      setRefusal(failure);
    }
  };

  return (
    <>
      <DialogBody>
        <p>These changes are thrown away:</p>
        <ul className="flex flex-col rounded-sm bg-surface-0 px-3 py-2 font-mono text-(length:--text-meta) leading-(--leading-meta) text-ink-1 select-text">
          {shown.map((line) => (
            <li key={line} className="break-all">
              {line}
            </li>
          ))}
          {more > 0 && <li className="font-sans text-ink-3">{`and ${more} more`}</li>}
        </ul>
        <p className="text-ink-3">Nothing else in the repository changes.</p>
      </DialogBody>
      <DialogFooter {...(refusal !== null ? { refusal } : {})}>
        <DialogCancel />
        <Button
          variant="danger"
          loading={cleaning}
          loadingLabel="Cleaning…"
          onClick={() => void clean()}
        >
          {refusal === null ? "Clean and start" : "Try again"}
        </Button>
      </DialogFooter>
    </>
  );
}
