import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Banner } from "@/features/notice/Notice";
import { OrphanPR } from "@/features/task/OrphanPRs";
import { messageOf } from "@/lib/errors";
import { api, type DeletePreview } from "@/lib/wails";
import { deleteTask } from "@/store/actions";

const LOADING_WIDTHS = ["w-full", "w-3/4", "w-1/2"];

// A task in the history has no worktree, no branch and no session left: the
// deletion only takes the records with it.
const NOTHING: DeletePreview = { sessionRunning: false, worktree: null, branch: null, pr: null };

/** Preview is what the dialog knows about what the deletion would destroy. */
interface Preview {
  status: "loading" | "ready" | "error";
  data: DeletePreview | null;
  error: string;
}

const LOADING: Preview = { status: "loading", data: null, error: "" };

/** Section is one group of what the deletion takes, inside the dialog. */
function Section({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">{children}</div>;
}

export interface DeleteTaskDialogProps {
  taskId: string;
  name: string;
  /** archived is a task of the history, which has nothing left on disk. */
  archived: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteTaskDialog is the last stop before a task is gone. It reads from git
 * what the deletion would destroy, and says it before asking. The screen closes
 * on its own: the next snapshot no longer has the task.
 */
export function DeleteTaskDialog({
  taskId,
  name,
  archived,
  open,
  onOpenChange,
}: DeleteTaskDialogProps) {
  const [preview, setPreview] = useState<Preview>(LOADING);
  const [dismissed, setDismissed] = useState("");

  // The reading is worth doing when the dialog opens, not before: it goes to
  // git in the worktree of the task. A late answer to a dialog the user has
  // already closed is dropped.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (archived) {
      setPreview({ status: "ready", data: NOTHING, error: "" });
      return;
    }
    let stale = false;
    setPreview(LOADING);
    api
      .previewDelete(taskId)
      .then((data) => {
        if (!stale) {
          setPreview({ status: "ready", data, error: "" });
        }
      })
      .catch((reason: unknown) => {
        if (!stale) {
          setPreview({ status: "error", data: null, error: messageOf(reason) });
        }
      });
    return () => {
      stale = true;
    };
  }, [open, archived, taskId]);

  const data = preview.data;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete "${name}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {archived
              ? "This removes the archived task and its documents from the history. It can't be undone."
              : "This removes the documents, the steps and every record of the task. It can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {preview.status === "loading" && (
          <div className="flex flex-col gap-2">
            {LOADING_WIDTHS.map((width) => (
              <Skeleton key={width} className={`h-4 ${width}`} />
            ))}
          </div>
        )}

        {/* The preview is information, not a precondition: the deletion goes
            ahead whatever git had to say about the worktrees. */}
        {preview.status === "error" && preview.error !== dismissed && (
          <Banner
            className="bg-destructive/10"
            title="Couldn't check what the deletion removes"
            onDismiss={() => setDismissed(preview.error)}
          >
            {preview.error}
          </Banner>
        )}

        {data !== null && (
          <>
            {data.sessionRunning && (
              <Section>
                <p>The conversation in progress will be interrupted.</p>
              </Section>
            )}

            {data.worktree !== null && (
              <Section>
                <p className="flex items-center gap-1.5">
                  The worktree will be removed
                  {data.worktree.dirty && (
                    <Badge variant="secondary">{`${data.worktree.files} uncommitted`}</Badge>
                  )}
                </p>
                <span className="font-mono text-xs break-all text-muted-foreground">
                  {data.worktree.path}
                </span>
                {data.worktree.error !== "" && (
                  <span className="text-xs text-destructive">{data.worktree.error}</span>
                )}
              </Section>
            )}

            {data.branch !== null && (
              <Section>
                <p className="flex items-center gap-1.5">
                  The branch <span className="font-mono">{data.branch.name}</span> will be deleted
                  {!data.branch.merged && <Badge variant="secondary">not merged</Badge>}
                </p>
                {data.branch.error !== "" && (
                  <span className="text-xs text-destructive">{data.branch.error}</span>
                )}
              </Section>
            )}

            <OrphanPR pr={data.pr} />
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void deleteTask(taskId);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
