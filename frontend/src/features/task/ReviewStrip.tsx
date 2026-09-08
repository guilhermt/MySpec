import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ToneDot } from "@/features/task/StatusDot";
import { reviewCountLabel } from "@/features/task/step-status";
import { cn } from "@/lib/utils";
import {
  asReviewFileKind,
  type ReviewFile,
  type ReviewFileKind,
  type Step,
  type TaskSummary,
} from "@/lib/wails";
import { openFileInEditor } from "@/store/actions";

const EXPANDED_KEY = "myspec.review.expanded";

// Browser storage can be unavailable; the list is then simply always expanded.
function wasExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) !== "0";
  } catch {
    return true;
  }
}

function rememberExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    // Nothing to remember it with; the default is a fine place to start.
  }
}

// The letter git itself uses for the change, which is what the user reads in
// the editor next to every file.
const KIND_LETTER: Record<ReviewFileKind, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  untracked: "U",
};

const FILE_ROW = "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs";

/** FileRow is one changed file, and the way into it in the editor. */
function FileRow({ taskId, file }: { taskId: string; file: ReviewFile }) {
  const kind = asReviewFileKind(file.kind);
  const content = (
    <>
      <Badge variant="outline" className="w-5 shrink-0 px-0 font-mono">
        {KIND_LETTER[kind]}
      </Badge>
      <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
        {file.path}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <ToneDot tone={file.staged ? "done" : "attention"} />
        {file.staged ? "Staged" : "Pending"}
      </span>
    </>
  );

  // A deleted file has nothing left to open in the editor.
  if (kind === "deleted") {
    return (
      <div className={FILE_ROW} title="The file was deleted, so there is nothing to open">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void openFileInEditor(taskId, file.path)}
      className={cn(FILE_ROW, "transition-colors hover:bg-accent")}
    >
      {content}
    </button>
  );
}

export interface ReviewStripProps {
  task: TaskSummary;
  step: Step;
}

/**
 * ReviewStrip is how far the review of the step has got, read from git as the
 * user stages what they have read in the editor.
 */
export function ReviewStrip({ task, step }: ReviewStripProps) {
  const [expanded, setExpanded] = useState(wasExpanded);

  const review = step.review;
  if (review === null) {
    return null;
  }

  if (review.error !== "") {
    return (
      <div className="shrink-0 border-b px-3 py-2">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <p className="text-sm font-medium">Couldn't read the worktree</p>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap select-text">
            {review.error}
          </pre>
        </div>
      </div>
    );
  }

  if (review.total === 0) {
    return (
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-xs text-muted-foreground">
          The agent didn't change anything, so there is nothing to approve. Ask for the change in
          the conversation, or discard the step.
        </p>
      </div>
    );
  }

  const files = review.files ?? [];

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Review progress"
          aria-valuenow={review.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-[var(--status-success)] transition-[width] duration-[var(--duration-base)] ease-[var(--ease-standard)]"
            style={{ width: `${review.percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {reviewCountLabel(review)}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
            rememberExpanded(!expanded);
          }}
          className="flex shrink-0 items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3.5 transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)]",
              expanded && "rotate-90",
            )}
          />
          {expanded ? "Hide files" : "Show files"}
        </button>
      </div>
      {expanded && (
        <ul className="flex max-h-64 flex-col overflow-y-auto">
          {files.map((file) => (
            <li key={file.path}>
              <FileRow taskId={task.id} file={file} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
