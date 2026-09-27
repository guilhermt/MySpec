import { useState } from "react";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import type { NoticeRow } from "@/features/sidebar/sidebar-tree";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { changeRepositoryPath } from "@/store/actions";

export interface CloneNoticeProps {
  notice: NoticeRow;
  tabIndex: 0 | -1;
}

const MICRO = "text-(length:--text-micro) leading-(--leading-micro)";

/**
 * CloneNotice is a repository of the node whose clone is gone, as a line of
 * the tree: a click or Enter changes the path, and a refusal shows under it.
 */
export function CloneNotice({ notice, tabIndex }: CloneNoticeProps) {
  const [error, setError] = useState<string | null>(null);

  const change = async () => {
    setError(null);
    try {
      await changeRepositoryPath(notice.repositoryId);
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <>
      <Tooltip content={notice.tooltip}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard of its notices */}
        <div
          role="treeitem"
          aria-level={2}
          aria-label={notice.label}
          aria-selected={false}
          tabIndex={tabIndex}
          data-entry-id={notice.id}
          onClick={() => void change()}
          className="grid w-full cursor-pointer grid-cols-[var(--icon)_minmax(0,1fr)_auto] items-center gap-x-(--space-2-5) rounded-md py-(--row-pad-y) pr-(--space-2) pl-(--tree-pad) text-ink-2 outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring"
        >
          <span className="grid place-items-center">
            <StateGlyph state="blocked" />
          </span>
          <span className="truncate text-(length:--text-ui) leading-(--leading-ui)">
            {notice.text}
          </span>
          <span aria-hidden="true" className={cn(MICRO, "whitespace-nowrap text-brand-ink")}>
            Change path ↵
          </span>
        </div>
      </Tooltip>
      {error !== null && (
        <p
          role="alert"
          className="px-(--tree-pad) text-(length:--text-meta) leading-(--leading-meta) text-state-error"
        >
          {error}
        </p>
      )}
    </>
  );
}
