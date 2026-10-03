import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { SunkenLine } from "@/components/system/SunkenLine";
import { archiveSummary } from "@/features/discussion/discussion-header";
import type { Draft } from "@/lib/wails";
import { archiveDiscussionInPlace } from "@/store/actions";

export interface ArchiveDiscussionDialogProps {
  discussion: { id: string; title: string; drafts: readonly Draft[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ArchiveDiscussionDialog is the last stop before a discussion leaves the list: a minimal dialog
 * that opens on Cancel and says what the history keeps of it. A refusal stays in its footer.
 */
export function ArchiveDiscussionDialog({
  discussion,
  open,
  onOpenChange,
}: ArchiveDiscussionDialogProps) {
  const [archiving, setArchiving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const archive = async () => {
    if (archiving) {
      return;
    }
    setArchiving(true);
    setRefusal(null);
    const message = await archiveDiscussionInPlace(discussion.id);
    setArchiving(false);
    if (message === null) {
      onOpenChange(false);
    } else {
      setRefusal(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && archiving) {
          return;
        }
        if (!next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={archiving}
      title={`Archive “${discussion.title}”?`}
      alert
      onConfirm={() => void archive()}
    >
      <DialogBody>
        <p>
          The conversation ends. The document, the drafts and what was published stay in History.
        </p>
        <SunkenLine>{archiveSummary(discussion.drafts)}</SunkenLine>
        <p className="text-ink-3">
          A task started from one of these cards gets the document in its context, also after the
          archive.
        </p>
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={archiving} />
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          loading={archiving}
          loadingLabel="Archiving…"
          onClick={() => void archive()}
        >
          Archive
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
