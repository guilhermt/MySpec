import type { ReactNode } from "react";
import { BackgroundWork } from "@/components/BackgroundWork";
import { backgroundOf } from "@/components/background-work";
import { tabId } from "@/components/system/Tabs";
import { Conversation } from "@/features/chat/Conversation";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { IDLE_SESSION } from "@/features/chat/session";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { prAgentTabsOf } from "@/features/task/agent-tabs";
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
import { type StepTab, useSubagentReturn } from "@/store/app-store";

// activityOf is what the app does at the end of the conversation while it opens the pull request or
// pushes the commit of a round.
function activityOf(pr: PullRequest): { activity: string } | Record<string, never> {
  switch (asPRStatus(pr.status)) {
    case "opening":
      return { activity: "Opening the pull request…" };
    case "pushing":
      return { activity: `Pushing the commit to #${pr.prNumber}…` };
    default:
      return {};
  }
}

// fixedOf is the fixed card at the end of the conversation of the pull request, if any. The changed
// files are the pull request's, on both tabs; the live checks are the reviewer's.
function fixedOf(task: TaskSummary, pr: PullRequest, onImplementer: boolean): ReactNode {
  const card = prFixedCardOf(pr, task.divergence);
  if (onImplementer && card !== "files") {
    return undefined;
  }
  switch (card) {
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
 * without a conversation. With the two conversations of the review, the tab chosen says which one.
 * The request bar is under each of them.
 */
export function PRPane({ task, pr, tab }: PRPaneProps) {
  const anchors = usePRConversationAnchors(task, pr);
  const subagentReturn = useSubagentReturn(task.id);
  const view = prPlaceOf(task, pr, hasReviewConversation(task));
  const request = <TaskRequest task={task} tab={tab} />;
  // The line of the merge says when it happened; the closing of the pull request has no time.
  const endLineAt = asPRState(pr.prState) === "merged" ? pr.mergedAt : "";
  const tabs = prAgentTabsOf(task, pr, tab, 0) !== null;
  const onImplementer = tabs && tab === "implementer";

  const content = (() => {
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
      case "closedReview": {
        const stage = onImplementer ? "pr_fix" : "pr_review";
        return (
          <>
            <Conversation
              key={`conversation:${stage}`}
              taskId={task.id}
              stage={stage}
              session={IDLE_SESSION}
              readOnly
              anchor={subagentReturn}
              {...(onImplementer ? {} : { after: anchors })}
              endLine={
                view.endLine === null ? undefined : (
                  <MarkerLine view={view.endLine} createdAt={endLineAt} />
                )
              }
            />
            {request}
          </>
        );
      }
      case "conversation": {
        // The implementer's conversation is read-only once its session is closed.
        const closed = onImplementer && pr.implementer === null;
        const stage = onImplementer ? "pr_fix" : pr.sessionStage;
        const session = onImplementer ? (pr.implementer ?? IDLE_SESSION) : pr;
        return (
          <>
            <Conversation
              key={`conversation:${stage}`}
              taskId={task.id}
              stage={stage}
              session={session}
              fixed={fixedOf(task, pr, onImplementer)}
              anchor={subagentReturn}
              {...(onImplementer ? {} : { after: anchors })}
              {...(closed ? { readOnly: true } : {})}
              {...activityOf(pr)}
              replyWaiting={screenSituationKindOf(task, tab) === "reply"}
            />
            {request}
            <BackgroundWork
              itemId={task.id}
              stage={stage}
              tasks={backgroundOf(task.running, stage)}
            />
            {hasComposer(view) && !closed && (
              <TaskComposer
                key={`composer:${stage}`}
                task={task}
                tab={tab}
                stage={stage}
                session={session}
              />
            )}
          </>
        );
      }
    }
  })();

  // The tabs of AgentTabs sit over the conversation, so the panel names the tab that chose it.
  return tabs ? (
    <div
      id={AGENT_CONVERSATION}
      role="tabpanel"
      aria-labelledby={tabId(AGENT_CONVERSATION, tab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      {content}
    </div>
  ) : (
    content
  );
}
