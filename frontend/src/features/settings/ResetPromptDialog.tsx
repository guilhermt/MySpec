import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { promptMeta } from "@/features/settings/prompts";
import { messageOf } from "@/lib/errors";
import type { Prompt, PromptStage } from "@/lib/wails";
import { restorePrompt } from "@/store/actions";

export interface ResetPromptDialogProps {
  stage: PromptStage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** onReset is called with the default prompt once it is back, before the dialog closes. */
  onReset: (prompt: Prompt) => void;
}

/**
 * ResetPromptDialog is the last stop before an edited prompt goes back to the default. It opens on
 * Cancel, stays open while the prompt is reset, and keeps a failure in its footer.
 */
export function ResetPromptDialog({ stage, open, onOpenChange, onReset }: ResetPromptDialogProps) {
  const { name } = promptMeta(stage);
  const [resetting, setResetting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const reset = async () => {
    if (resetting) {
      return;
    }
    setResetting(true);
    setFailure(null);
    try {
      onReset(await restorePrompt(stage));
      onOpenChange(false);
    } catch (reason) {
      setFailure(messageOf(reason));
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a failure that comes back has its footer.
        if (!next && resetting) {
          return;
        }
        if (next) {
          setFailure(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={resetting}
      title={`Reset the ${name} prompt to the default?`}
      alert
    >
      <DialogBody>
        <p>
          Your edits are replaced by the default of this version, and the prompt follows the default
          of new versions again.
        </p>
        <p className="text-ink-3">A session that is running keeps the prompt it started with.</p>
      </DialogBody>
      <DialogFooter {...(failure === null ? {} : { refusal: failure })}>
        <DialogCancel disabled={resetting} />
        <Button
          variant="danger"
          loading={resetting}
          loadingLabel="Resetting…"
          onClick={() => void reset()}
        >
          Reset prompt
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
