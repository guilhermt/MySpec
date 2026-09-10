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
import { ErrorNotice } from "@/features/notice/Notice";
import { OrphanPRs } from "@/features/task/OrphanPRs";
import { api, type DeletePreview } from "@/lib/wails";
import { deleteTask } from "@/store/actions";

const LOADING_WIDTHS = ["w-full", "w-3/4", "w-1/2"];

// A task in the history has no worktree, no branch and no session left: the
// deletion only takes the records with it.
const NOTHING: DeletePreview = { sessionRunning: false, worktrees: [], branches: [], prs: [] };

/** Preview is what the dialog knows about what the deletion would destroy. */
interface Preview {
  status: "loading" | "ready" | "error";
  data: DeletePreview | null;
  error: string;
}

const LOADING: Preview = { status: "loading", data: null, error: "" };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** count reads a number of things with the name of the thing, in English. */
function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

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
  // git in every worktree of the task. A late answer to a dialog the user has
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
  const worktrees = data?.worktrees ?? [];
  const branches = data?.branches ?? [];
  const dirty = worktrees.filter((worktree) => worktree.dirty).length;
  const unmerged = branches.filter((branch) => !branch.merged).length;

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
          <ErrorNotice message={preview.error} onDismiss={() => setDismissed(preview.error)} />
        )}

        {data !== null && (
          <>
            {data.sessionRunning && (
              <Section>
                <p>The conversation in progress will be interrupted.</p>
              </Section>
            )}

            {worktrees.length > 0 && (
              <Section>
                <p>
                  {`${count(worktrees.length, "worktree", "worktrees")} will be removed`}
                  {dirty > 0 && ` · ${dirty} with uncommitted changes`}
                </p>
                <ul className="flex flex-col gap-1">
                  {worktrees.map((worktree) => (
                    <li key={worktree.repoPath} className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 truncate">{worktree.repository}</span>
                        {worktree.dirty && (
                          <Badge variant="secondary">{`${worktree.files} uncommitted`}</Badge>
                        )}
                      </span>
                      <span className="font-mono text-xs break-all text-muted-foreground">
                        {worktree.path}
                      </span>
                      {worktree.error !== "" && (
                        <span className="text-xs text-destructive">{worktree.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {branches.length > 0 && (
              <Section>
                <p>
                  {`${count(branches.length, "branch", "branches")} will be deleted`}
                  {unmerged > 0 && ` · ${unmerged} not merged`}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {branches.map((branch) => (
                    <li key={branch.repoPath} className="flex items-center gap-1.5">
                      <span className="font-mono text-xs break-all">{branch.name}</span>
                      {!branch.merged && <Badge variant="secondary">not merged</Badge>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <OrphanPRs prs={data.prs ?? []} />
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
