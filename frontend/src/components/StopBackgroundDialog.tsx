import { useState } from "react";
import { BackgroundWorkList } from "@/components/BackgroundWorkList";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import type { SessionTasks } from "@/lib/wails";
import { stopTasksOf } from "@/store/actions";

export interface StopBackgroundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** verb is the gesture, in the infinitive: "pause", "close". */
  verb: string;
  /** itemId is the item whose conversations the gesture ends. */
  itemId: string;
  /** sessions are the conversations the gesture ends, with what runs in each. */
  sessions: readonly SessionTasks[];
  /** onConfirm does the gesture, once what runs is stopped; it answers the refusal, or null. */
  onConfirm: () => Promise<string | null>;
}

/**
 * StopBackgroundDialog is the confirmation of a gesture that has no dialog of its own, Pause and
 * Close task, when a subagent runs: it lists what runs, which does not resume, and stops it before
 * the gesture. The button says Stopping… until the gesture is done, and a gesture refused keeps the
 * dialog open with the reason in its footer.
 */
export function StopBackgroundDialog({
  open,
  onOpenChange,
  verb,
  itemId,
  sessions,
  onConfirm,
}: StopBackgroundDialogProps) {
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const confirm = async () => {
    if (working) {
      return;
    }
    setWorking(true);
    setRefusal(null);
    await stopTasksOf(itemId, sessions);
    const message = await onConfirm();
    setWorking(false);
    if (message === null) {
      onOpenChange(false);
    } else {
      setRefusal(`Couldn't ${verb}: ${message}`);
    }
  };

  const gerund = verb.endsWith("e") ? `${verb.slice(0, -1)}ing` : `${verb}ing`;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the gesture runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && working) {
          return;
        }
        if (!next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={working}
      title="Stop the work in the background?"
      alert
    >
      <DialogBody>
        <p>{`${gerund.charAt(0).toUpperCase()}${gerund.slice(1)} stops what runs in the background. It won't resume.`}</p>
        <BackgroundWorkList itemId={itemId} sessions={sessions} />
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={working} />
        <Button
          variant="danger"
          loading={working}
          loadingLabel="Stopping…"
          onClick={() => void confirm()}
        >
          {`Stop and ${verb}`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
