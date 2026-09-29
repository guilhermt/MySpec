import { Composer } from "@/features/chat/Composer";
import type { SessionState } from "@/features/chat/session";
import { useConversationCards } from "@/features/chat/useConversationCards";

export interface ConversationComposerProps {
  taskId: string;
  stage: string;
  session: SessionState;
}

const NO_CONTEXT = { findings: false, askForChange: false };

/**
 * ConversationComposer is the composer of a conversation without a request bar, a review's or a
 * discussion's: it answers the cards the conversation holds pending, whose button is the primary.
 */
export function ConversationComposer({ taskId, stage, session }: ConversationComposerProps) {
  const { question, permission } = useConversationCards(taskId, stage);
  return (
    <Composer
      taskId={taskId}
      stage={stage}
      session={session}
      question={question}
      permissionPending={permission}
      otherPrimary={question !== null || permission}
      context={NO_CONTEXT}
    />
  );
}
