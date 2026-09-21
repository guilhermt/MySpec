import {
  discussionStatusLabel,
  discussionStatusTone,
} from "@/features/discussion/discussion-status";
import { ToneDot } from "@/features/task/StatusDot";
import { discussionSituation, situationTone } from "@/lib/situations";
import { asDiscussionStatus, type DiscussionSummary } from "@/lib/wails";

export interface DiscussionBarProps {
  discussion: DiscussionSummary;
}

/** DiscussionBar says where the discussion stands and what is in its way. */
export function DiscussionBar({ discussion }: DiscussionBarProps) {
  const situation = discussionSituation(discussion);
  // What waits on the user takes the colour of its situation; without one, the
  // dot shows what the discussion is doing.
  const tone = situation !== null ? situationTone(situation) : discussionStatusTone(discussion);

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <span
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <ToneDot tone={tone} />
        {discussionStatusLabel(discussion)}
      </span>
      {discussion.unreadableDrafts !== "" && (
        <span
          className="min-w-0 truncate text-xs text-[var(--status-attention)]"
          title={discussion.unreadableDrafts}
        >
          {discussion.unreadableDrafts}
        </span>
      )}
      {asDiscussionStatus(discussion.status) === "publishing" && (
        <span className="shrink-0 text-xs text-muted-foreground">Publishing…</span>
      )}
    </div>
  );
}
