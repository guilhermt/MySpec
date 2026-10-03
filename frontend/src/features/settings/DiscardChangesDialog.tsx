import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { promptMeta } from "@/features/settings/prompts";
import { useAppStore, useSettingsUi } from "@/store/app-store";

/** DiscardChangesDialog is the last stop before an unsaved edit of a prompt is lost. It opens on Keep editing. */
export function DiscardChangesDialog() {
  const { promptEdit, pendingLeave } = useSettingsUi();
  const confirmLeave = useAppStore((state) => state.confirmLeave);
  const cancelLeave = useAppStore((state) => state.cancelLeave);
  const name = promptEdit === null ? "" : promptMeta(promptEdit.stage).name;

  return (
    <Dialog
      open={pendingLeave !== null}
      onOpenChange={(open) => {
        if (!open) {
          cancelLeave();
        }
      }}
      title="Discard your changes?"
      alert
    >
      <DialogBody>
        <p>{`The edits to the ${name} prompt haven't been saved.`}</p>
      </DialogBody>
      <DialogFooter>
        <DialogCancel>Keep editing</DialogCancel>
        <Button variant="danger" onClick={confirmLeave}>
          Discard
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
