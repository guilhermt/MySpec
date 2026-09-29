import { type KeyboardEvent, useRef, useState } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import { stepFeed } from "@/features/chat/useFeed";
import { cn } from "@/lib/utils";
import { asReviewFileKind, type Review, type ReviewFile, type ReviewFileKind } from "@/lib/wails";
import { openFileInEditor } from "@/store/actions";

/** SHOWN_FILES is the most files the card lists whole; above it, the first ones and Show N more files. */
const SHOWN_FILES = 12;

/** LOADING_ROWS is how many lines of skeleton stand in for the files before the first reading. */
const LOADING_ROWS = ["w-3/4", "w-1/2", "w-2/3"];

// The letter git itself uses for the change, which is what the user reads in the editor next to
// every file.
const KIND_LETTER: Record<ReviewFileKind, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  untracked: "U",
};

/** ROW selects a line of the card that the arrows walk: a file, or the way to the rest of them. */
const ROW = "[data-file-row]";

// stageOf is where the file stands in the index.
function stageOf(file: ReviewFile): string {
  if (file.staged) {
    return "staged";
  }
  return file.partial ? "partly staged" : "not staged";
}

/** FileRow is one changed file, and the way into it in the editor. */
function FileRow({ taskId, file }: { taskId: string; file: ReviewFile }) {
  const deleted = asReviewFileKind(file.kind) === "deleted";
  const stage = stageOf(file);
  return (
    <li>
      <Tooltip
        content={
          deleted
            ? "The file was deleted, so there is nothing to open"
            : `Open ${file.path} in VS Code`
        }
      >
        <button
          type="button"
          data-file-row
          tabIndex={-1}
          {...(deleted ? { "aria-disabled": true } : {})}
          onClick={deleted ? undefined : () => void openFileInEditor(taskId, file.path)}
          className="-mx-(--space-2) grid w-[calc(100%+var(--space-2)*2)] min-h-(--size-control-sm) grid-cols-[var(--icon)_var(--key-size)_minmax(0,1fr)_auto] items-center gap-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) outline-none transition-colors duration-(--duration-fast) ease-standard not-aria-disabled:hover:bg-veil-hover not-aria-disabled:active:bg-veil-press focus-visible:focus-ring aria-disabled:cursor-default"
        >
          <span className="grid place-items-center">
            {file.staged ? (
              <Icon icon={ICONS.done} size="sm" className="text-ink-3" />
            ) : (
              <StateGlyph state="todo" size="sm" />
            )}
          </span>
          <span className="text-center font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
            {KIND_LETTER[asReviewFileKind(file.kind)]}
          </span>
          <span
            className={cn(
              "truncate font-mono text-(length:--text-micro) leading-(--leading-micro) [font-variant-ligatures:none]",
              deleted ? "text-ink-4" : file.staged ? "text-ink-3" : "text-ink-1",
            )}
          >
            {file.path}
          </span>
          <span
            className={cn(
              "text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap",
              file.staged ? "text-ink-3" : file.partial ? "text-ink-2" : "font-medium text-ink-1",
            )}
          >
            {stage}
          </span>
        </button>
      </Tooltip>
    </li>
  );
}

// Body is what the card holds: the skeleton before the first reading, the error of a reading that
// failed, or the files.
function Body({ taskId, review }: { taskId: string; review: Review | null }) {
  const [all, setAll] = useState(false);
  if (review === null) {
    return (
      <Skeleton label="Reading the worktree" className="py-(--space-1)">
        {LOADING_ROWS.map((width) => (
          <SkeletonBar key={width} className={width} />
        ))}
      </Skeleton>
    );
  }
  if (review.error !== "") {
    return (
      <div className="flex flex-col gap-(--space-1) py-(--space-1)">
        <p className="text-(length:--text-meta) leading-(--leading-meta) font-medium text-state-error">
          Couldn't read the worktree
        </p>
        <pre className="overflow-x-auto font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2 select-text">
          {review.error}
        </pre>
      </div>
    );
  }
  const files = review.files ?? [];
  const more = all ? 0 : Math.max(files.length - SHOWN_FILES, 0);
  return (
    <ul className="flex flex-col divide-y divide-line-1">
      {files.slice(0, files.length - more).map((file) => (
        <FileRow key={file.path} taskId={taskId} file={file} />
      ))}
      {more > 0 && (
        <li className="py-(--space-0-5)">
          <button
            type="button"
            data-file-row
            tabIndex={-1}
            onClick={() => setAll(true)}
            className="-ml-(--space-1-5) inline-flex h-(--size-control-xs) items-center gap-(--space-1-5) rounded-sm px-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-3 outline-none hover:bg-veil-hover hover:text-ink-1 active:bg-veil-press focus-visible:focus-ring"
          >
            {`Show ${more} more files`}
          </button>
        </li>
      )}
    </ul>
  );
}

export interface ChangedFilesCardProps {
  taskId: string;
  /** review is the last reading of the worktree; null before the first one. */
  review: Review | null;
}

/**
 * ChangedFilesCard is what the step or the round of the pull request changed in the worktree, at
 * the end of the conversation: a file per line with where it stands in the index, each one opening
 * in VS Code. It is one stop of the feed: ↑ and ↓ walk its lines and go on to the entry before or
 * after it at its ends, and Enter opens the file.
 */
export function ChangedFilesCard({ taskId, review }: ChangedFilesCardProps) {
  const ref = useRef<HTMLElement>(null);
  const count = review === null || review.error !== "" ? null : (review.files ?? []).length;
  const header = count === null ? "Changed files" : `Changed files · ${count}`;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const card = ref.current;
    const by = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (card === null || by === 0 || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    const rows = [...card.querySelectorAll<HTMLElement>(ROW)];
    const at = rows.indexOf(event.target as HTMLElement);
    // From the card itself, ↓ enters its first line; from a line, the arrows walk the next one.
    const next = at === -1 ? (by === 1 ? 0 : -1) : at + by;
    const row = rows[next];
    if (next < 0 || row === undefined) {
      stepFeed(card, by);
      return;
    }
    row.focus();
    row.scrollIntoView?.({ block: "nearest" });
  };

  return (
    <article
      ref={ref}
      data-feed-item
      data-feed-keys="own"
      tabIndex={-1}
      aria-label={header}
      aria-busy={review === null}
      onKeyDown={onKeyDown}
      className="flex flex-col rounded-lg bg-surface-2 shadow-xs outline-none focus-visible:focus-ring"
    >
      <p className="px-(--space-4) py-(--space-2) text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2 shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        {header}
      </p>
      <div className="px-(--space-4) py-(--space-2)">
        <Body taskId={taskId} review={review} />
      </div>
    </article>
  );
}
