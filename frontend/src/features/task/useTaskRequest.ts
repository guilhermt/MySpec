import { useNow } from "@/features/attention/useNow";
import {
  type OtherConversationModel,
  otherConversationOf,
  pendingRequestOf,
  screenStageOf,
  type TaskRequestModel,
  taskRequestOf,
} from "@/features/task/request";
import { sessionKey, type TaskSummary } from "@/lib/wails";
import { type StepTab, useAppStore, usePrDraft, useRepository } from "@/store/app-store";

// MINUTE is how often the wait on the chip is read again.
const MINUTE = 60_000;

/** TaskRequestView is what the request bar of a task draws: its own bar, or the other conversation's. */
export interface TaskRequestView {
  request: TaskRequestModel | null;
  /** other is the bar of the other conversation of the step, when the one on screen asks nothing. */
  other: OtherConversationModel | null;
}

/**
 * useTaskRequest is the request bar of the task screen, from the task, the tab on screen and the
 * card the conversation on screen holds pending.
 */
export function useTaskRequest(task: TaskSummary, tab: StepTab): TaskRequestView {
  const edited = usePrDraft(task.id);
  const repository = useRepository(task.repositoryId);
  const now = useNow(MINUTE, true);
  const stage = screenStageOf(task, tab);
  const entries = useAppStore((state) =>
    stage === "" ? undefined : state.transcripts[sessionKey(task.id, stage)]?.entries,
  );
  const pending = entries === undefined ? null : pendingRequestOf(entries);
  const request = taskRequestOf(task, tab, now, repository, edited, pending);
  return { request, other: request === null ? otherConversationOf(task, tab, now) : null };
}
