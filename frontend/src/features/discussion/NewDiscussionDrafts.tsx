import { useEffect, useRef } from "react";
import { CutText } from "@/components/system/CutText";
import { Tooltip } from "@/components/system/Tooltip";
import { draftExcerpt, draftLabel, UNTITLED } from "@/features/discussion/new-discussion";
import { cn } from "@/lib/utils";
import type { NewDiscussionDraft } from "@/lib/wails";
import { age, fullTime } from "@/lib/when";

interface NewDiscussionDraftsProps {
  drafts: readonly NewDiscussionDraft[];
  /** showBoard names the board on each row, when the drafts are of several. */
  showBoard: boolean;
  boardTitle: (boardId: string) => string;
  now: number;
  onPick: (draft: NewDiscussionDraft) => void;
}

/** NewDiscussionDrafts lists the drafts of the New discussion dialog, to resume one. */
export function NewDiscussionDrafts({
  drafts,
  showBoard,
  boardTitle,
  now,
  onPick,
}: NewDiscussionDraftsProps) {
  const list = useRef<HTMLUListElement>(null);
  // The list opens with the focus on its first row.
  useEffect(() => {
    list.current?.querySelector("button")?.focus();
  }, []);

  return (
    <ul
      ref={list}
      aria-label="Drafts"
      className="flex flex-col divide-y divide-line-1 rounded-sm border border-line-1"
    >
      {drafts.map((draft) => {
        const label = draftLabel(draft);
        const second = [showBoard ? boardTitle(draft.boardId) : "", draftExcerpt(draft.text)]
          .filter((part) => part !== "")
          .join(" · ");
        return (
          <li key={draft.id}>
            <button
              type="button"
              onClick={() => onPick(draft)}
              className="flex w-full flex-col gap-(--space-0-5) px-(--space-3) py-(--space-2) text-left hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring"
            >
              <span className="flex items-baseline gap-(--space-2) text-(length:--text-ui) leading-(--leading-ui)">
                <CutText
                  text={label}
                  className={cn(
                    "flex-1 font-medium",
                    label === UNTITLED ? "text-ink-3" : "text-ink-1",
                  )}
                />
                <Tooltip content={fullTime(draft.savedAt)}>
                  <span className="shrink-0 text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                    {age(draft.savedAt, now)}
                  </span>
                </Tooltip>
              </span>
              {second !== "" && (
                <CutText
                  text={second}
                  className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
