import { useId, useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { messageOf } from "@/lib/errors";

interface SaveDraftDialogProps {
  open: boolean;
  /** resumed says the form holds a draft, which Discard deletes. */
  resumed: boolean;
  /** saveReason is why the form can't be saved as a draft; null when it can. */
  saveReason: string | null;
  onKeep: () => void;
  /** onDiscard and onSave throw when they fail; the dialog shows the failure. */
  onDiscard: () => Promise<void>;
  onSave: () => Promise<void>;
}

/**
 * SaveDraftDialog asks what to do with what the user wrote in the New discussion dialog before it
 * leaves: keep editing, discard it, or save it as a draft. It opens on Keep editing.
 */
export function SaveDraftDialog({
  open,
  resumed,
  saveReason,
  onKeep,
  onDiscard,
  onSave,
}: SaveDraftDialogProps) {
  const reasonId = useId();
  const [busy, setBusy] = useState<"discarding" | "saving" | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const run = (kind: "discarding" | "saving", action: () => Promise<void>) => {
    if (busy !== null) {
      return;
    }
    setBusy(kind);
    setRefusal(null);
    action()
      .catch((failure: unknown) => setRefusal(messageOf(failure)))
      .finally(() => setBusy(null));
  };
  const save = () => {
    if (saveReason === null) {
      run("saving", onSave);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy === null) {
          setRefusal(null);
          onKeep();
        }
      }}
      title="Save this discussion as a draft?"
      alert
      closeDisabled={busy !== null}
      onConfirm={save}
    >
      <DialogBody>
        <p>
          {resumed ? "Discard deletes this draft." : "What you wrote is lost unless you save it."}
        </p>
      </DialogBody>
      <DialogFooter
        {...(saveReason !== null ? { reason: { id: reasonId, text: saveReason } } : {})}
        {...(refusal !== null ? { refusal } : {})}
      >
        <DialogCancel disabled={busy !== null}>Keep editing</DialogCancel>
        <Button
          variant="secondary"
          disabled={busy === "saving"}
          loading={busy === "discarding"}
          loadingLabel="Discarding…"
          onClick={() => run("discarding", onDiscard)}
        >
          Discard
        </Button>
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          disabled={busy === "discarding" || saveReason !== null}
          {...(saveReason !== null ? { reasonId } : {})}
          loading={busy === "saving"}
          loadingLabel="Saving…"
          onClick={save}
        >
          Save draft
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
