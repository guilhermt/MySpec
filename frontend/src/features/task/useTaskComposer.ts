import type { ComposerProps } from "@/features/chat/Composer";
import { useConversationCards } from "@/features/chat/useConversationCards";
import { prComposerContext } from "@/features/task/pr-findings";
import { screenSituationKindOf } from "@/features/task/request";
import { useTaskRequest } from "@/features/task/useTaskRequest";
import type { TaskSummary } from "@/lib/wails";
import { asTaskStage } from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

/** TaskComposerContext is what the composer of the task screen learns from the task and the bar. */
export type TaskComposerContext = Omit<ComposerProps, "taskId" | "stage" | "session">;

/**
 * useTaskComposer is what the composer of the conversation on screen needs from the task: the
 * pending cards, the quick replies with the reply situation, whether the bar or a card has the
 * primary, and the situations that change what it says.
 */
export function useTaskComposer(
  task: TaskSummary,
  tab: StepTab,
  stage: string,
): TaskComposerContext {
  const { request } = useTaskRequest(task, tab);
  const cards = useConversationCards(task.id, stage);
  const kind = screenSituationKindOf(task, tab);
  const barPrimary = request?.actions.some((button) => button.variant === "primary") ?? false;
  return {
    question: cards.question,
    permissionPending: cards.permission,
    otherPrimary: barPrimary || cards.question !== null || cards.permission,
    chips: kind === "reply" ? cards.chips : [],
    context: {
      ...(asTaskStage(task.stage) === "pr"
        ? prComposerContext(task, kind)
        : {
            findings: false,
            reviseFindings: false,
            askForChange: kind === "step_review" || kind === "step_empty",
          }),
      item: "task",
    },
  };
}
