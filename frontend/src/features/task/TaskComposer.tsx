import { Composer } from "@/features/chat/Composer";
import type { SessionState } from "@/features/chat/session";
import { useTaskComposer } from "@/features/task/useTaskComposer";
import type { TaskSummary } from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

export interface TaskComposerProps {
  task: TaskSummary;
  tab: StepTab;
  /** stage names the session of the conversation on screen. */
  stage: string;
  session: SessionState;
}

/** TaskComposer is the composer of the conversation on the task screen, told what the task asks. */
export function TaskComposer({ task, tab, stage, session }: TaskComposerProps) {
  const props = useTaskComposer(task, tab, stage);
  return <Composer taskId={task.id} stage={stage} session={session} {...props} />;
}
