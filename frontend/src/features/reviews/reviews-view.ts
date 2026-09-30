import type { PullRequestRow, ReviewCenter } from "@/lib/wails";

/**
 * visibleRows is what the Reviews view lists: the pull requests the filters
 * keep, in reading order, and only the ones that wait for the user when
 * pendingOnly is on.
 */
export function visibleRows(center: ReviewCenter, pendingOnly = false): PullRequestRow[] {
  return (center.pullRequests ?? []).filter(
    (row) => !row.filtered && (!pendingOnly || row.pending),
  );
}
