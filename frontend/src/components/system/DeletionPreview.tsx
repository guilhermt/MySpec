import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { IconGlyph } from "./icons";
import { Link } from "./Link";
import { Shimmer } from "./Shimmer";
import { SkeletonBar } from "./Skeleton";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";
import { Tag } from "./Tag";

/** DeletionLine is one thing an erasure destroys or leaves, with what git said about it. */
export interface DeletionLine {
  /** icon is a glyph of the system; blocked is the diamond of what could not be read and run the spinner of a turn in progress. */
  icon: IconGlyph | "blocked" | "run";
  text: string;
  /** mono ends the text in mono: a branch name. */
  mono?: string;
  /** after is plain text that follows the mono part: " is deleted". */
  after?: string;
  /** tag is the number that goes in a contoured tag: "3 uncommitted files". */
  tag?: string;
  /** detail goes on a line of its own, in the third ink. */
  detail?: string;
  detailMono?: boolean;
  link?: { label: string; href: string };
}

export interface DeletionPreviewProps {
  state: { kind: "reading" } | { kind: "lines"; lines: readonly DeletionLine[] };
}

function Mark({ icon }: { icon: DeletionLine["icon"] }) {
  if (icon === "run") return <Spinner />;
  if (icon === "blocked") return <StateGlyph state="blocked" size="sm" />;
  return <Icon icon={icon} size="sm" className="text-ink-3" />;
}

const BLOCK = "rounded-md bg-surface-0 px-(--space-3) py-(--space-1)";

/** DeletionPreview is what an erasure will destroy, read from git when the dialog opens, in a sunken list; it draws nothing when there is nothing to list. */
export function DeletionPreview({ state }: DeletionPreviewProps) {
  if (state.kind === "reading") {
    return (
      <div className="flex flex-col gap-(--space-2)">
        <div role="status" className="text-(length:--text-meta) leading-(--leading-meta)">
          <Shimmer>Reading the worktree and the branch…</Shimmer>
        </div>
        <div className={cn(BLOCK, "flex flex-col gap-(--space-2) py-(--space-2)")}>
          <SkeletonBar className="w-2/3" />
          <SkeletonBar className="w-1/2" />
          <SkeletonBar className="w-3/5" />
        </div>
      </div>
    );
  }
  if (state.lines.length === 0) return null;
  return (
    <ul
      // biome-ignore lint/a11y/noRedundantRoles: WebKit drops list semantics
      role="list"
      aria-label="What will be destroyed"
      className={cn(
        BLOCK,
        "m-0 list-none text-(length:--text-meta) leading-(--leading-meta) text-ink-1",
      )}
    >
      {state.lines.map((line, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: the lines are a fixed list of things
          key={index}
          className="grid grid-cols-[var(--icon)_minmax(0,1fr)] items-baseline gap-x-(--space-2) border-t border-line-1 py-(--space-2) first:border-t-0"
        >
          <span className="grid place-items-center">
            <Mark icon={line.icon} />
          </span>
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-(--space-2) wrap-anywhere">
            <span>
              {line.text}
              {line.mono !== undefined && (
                <>
                  {" "}
                  <span className="font-mono">{line.mono}</span>
                  {line.after}
                </>
              )}
            </span>
            {line.tag !== undefined && (
              <Tag className="border border-line-3 text-ink-1">{line.tag}</Tag>
            )}
          </span>
          {(line.detail !== undefined || line.link !== undefined) && (
            <span
              className={cn(
                "col-start-2 min-w-0 text-ink-3 wrap-anywhere",
                line.detailMono === true &&
                  "font-mono text-(length:--text-micro) leading-(--leading-micro)",
              )}
            >
              {line.detail}
              {line.link !== undefined && (
                <>
                  {line.detail !== undefined && " "}
                  <Link href={line.link.href} external>
                    {line.link.label}
                  </Link>
                </>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
