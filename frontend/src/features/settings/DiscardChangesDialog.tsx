import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { promptMeta } from "@/features/settings/prompts";
import { useAppStore, useSettingsUi } from "@/store/app-store";

/** DiscardChangesDialog is the last stop before an unsaved edit of a prompt is lost. */
export function DiscardChangesDialog() {
  const { promptEdit, pendingLeave } = useSettingsUi();
  const confirmLeave = useAppStore((state) => state.confirmLeave);
  const cancelLeave = useAppStore((state) => state.cancelLeave);
  const name = promptEdit === null ? "" : promptMeta(promptEdit.stage).name;

  return (
    <AlertDialog
      open={pendingLeave !== null}
      onOpenChange={(open) => {
        if (!open) {
          cancelLeave();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            {`The edits to the ${name} prompt haven't been saved.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmLeave}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
