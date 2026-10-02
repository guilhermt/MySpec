import {
  discussionBarLabel,
  discussionDotTone,
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
      {/* The middle is the way out, so it is announced with the label it explains. */}
      <span
        role="status"
        aria-live="polite"
        className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
      >
        <span className="flex shrink-0 items-center gap-1.5">
          <ToneDot tone={tone} />
          {discussionBarLabel(discussion)}
        </span>
        {detail !== null && (
          <>
            {" "}
            <span className="min-w-0 truncate" title={detail}>
              {detail}
            </span>
          </>
        )}
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
