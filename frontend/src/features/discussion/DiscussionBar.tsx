import {
  discussionDotTone,
  discussionStatusLabel,
  standingDetail,
} from "@/features/discussion/discussion-status";
import { ToneDot } from "@/features/task/StatusDot";
import { asDiscussionStatus, type DiscussionSummary } from "@/lib/wails";

export interface DiscussionBarProps {
  discussion: DiscussionSummary;
}

/** DiscussionBar says where the discussion stands and what is in its way. */
export function DiscussionBar({ discussion }: DiscussionBarProps) {
  // The dot: see discussionDotTone.
  const tone = discussionDotTone(discussion);
  const detail = standingDetail(discussion);

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
      {detail !== null && (
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={detail}>
          {detail}
        </span>
      )}
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
