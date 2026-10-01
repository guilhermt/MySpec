import type { ReactNode } from "react";
import { Conversation } from "@/features/chat/Conversation";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { IDLE_SESSION } from "@/features/chat/session";
import { ChangedFilesCard } from "@/features/task/ChangedFilesCard";
import { DraftCard } from "@/features/task/DraftCard";
import { LiveChecks } from "@/features/task/LiveChecks";
import { PlaceColumn } from "@/features/task/PlaceColumn";
import {
  hasComposer,
  hasReviewConversation,
  prFixedCardOf,
  prPlaceOf,
} from "@/features/task/place";
import { screenSituationKindOf } from "@/features/task/request";
import { TaskComposer } from "@/features/task/TaskComposer";
import { TaskRequest } from "@/features/task/TaskRequest";
import { usePRConversationAnchors } from "@/features/task/usePRConversationAnchors";
import { prChecks } from "@/lib/pull-requests";
import { asPRState, asPRStatus, type PullRequest, type TaskSummary } from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

// fixedOf is the fixed card at the end of the conversation of the pull request, if any.
function fixedOf(task: TaskSummary, pr: PullRequest): ReactNode {
  switch (prFixedCardOf(pr)) {
    case "files":
      return <ChangedFilesCard taskId={task.id} review={pr.review} />;
    case "draft":
      return <DraftCard taskId={task.id} pr={pr} />;
    case "checks":
      return <LiveChecks reading={prChecks(pr)} fixed />;
    case null:
      return undefined;
  }
}

export interface PRPaneProps {
  task: TaskSummary;
  pr: PullRequest;
  tab: StepTab;
}

/**
 * PRPane is what the PR stage shows below the header: the conversation of the pull request with its
 * fixed card, the conversation of the review read closed once the review is behind it, or the place
 * without a conversation. The request bar is under each of them.
 */
export function PRPane({ task, pr, tab }: PRPaneProps) {
  const anchors = usePRConversationAnchors(task, pr);
  const view = prPlaceOf(task, pr, hasReviewConversation(task));
  const request = <TaskRequest task={task} tab={tab} />;
  // The line of the merge says when it happened; the closing of the pull request has no time.
  const endLineAt = asPRState(pr.prState) === "merged" ? pr.mergedAt : "";

  switch (view.kind) {
    case "activity":
    case "blocked":
    case "empty":
      return (
        <>
          <PlaceColumn
            view={view}
            checks={<LiveChecks reading={prChecks(pr)} />}
            endLineAt={endLineAt}
          />
          {request}
        </>
      );
    case "closedReview":
      return (
        <>
          <Conversation
            key="conversation:pr_review"
            taskId={task.id}
            stage="pr_review"
            session={IDLE_SESSION}
            readOnly
            after={anchors}
            endLine={
              view.endLine === null ? undefined : (
                <MarkerLine view={view.endLine} createdAt={endLineAt} />
              )
            }
          />
          {request}
        </>
      );
    case "conversation":
      return (
        <>
          <Conversation
            key={`conversation:${pr.sessionStage}`}
            taskId={task.id}
            stage={pr.sessionStage}
            session={pr}
            fixed={fixedOf(task, pr)}
            after={anchors}
            {...(asPRStatus(pr.status) === "opening"
              ? { activity: "Opening the pull request…" }
              : {})}
            replyWaiting={screenSituationKindOf(task, tab) === "reply"}
          />
          {request}
          {hasComposer(view) && (
            <TaskComposer task={task} tab={tab} stage={pr.sessionStage} session={pr} />
          )}
        </>
      );
  }
}
