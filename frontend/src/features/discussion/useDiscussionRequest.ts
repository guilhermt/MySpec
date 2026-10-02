import { useNow } from "@/features/attention/useNow";
import {
  type DiscussionRequestModel,
  discussionRequestOf,
} from "@/features/discussion/discussion-request";
import { pendingRequestOf } from "@/features/task/request";
import { DISCUSSION_STAGE, type DiscussionSummary, sessionKey } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

// MINUTE is how often the wait on the chip is read again.
const MINUTE = 60_000;

/**
 * useDiscussionRequest is the request bar of the discussion screen, from the discussion and the
 * card its conversation holds pending; null when the discussion asks nothing.
 */
export function useDiscussionRequest(discussion: DiscussionSummary): DiscussionRequestModel | null {
  const now = useNow(MINUTE, true);
  const entries = useAppStore(
    (state) => state.transcripts[sessionKey(discussion.id, DISCUSSION_STAGE)]?.entries,
  );
  const pending = entries === undefined ? null : pendingRequestOf(entries);
  return discussionRequestOf(discussion, now, pending);
}

/**
 * currentDiscussionRequest is the request bar as it stands now, read when a key asks for it instead
 * of followed by the screen.
 */
export function currentDiscussionRequest(
  discussion: DiscussionSummary,
): DiscussionRequestModel | null {
  const entries =
    useAppStore.getState().transcripts[sessionKey(discussion.id, DISCUSSION_STAGE)]?.entries;
  return discussionRequestOf(
    discussion,
    Date.now(),
    entries === undefined ? null : pendingRequestOf(entries),
  );
}
