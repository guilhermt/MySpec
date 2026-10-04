import { type ReactNode, useMemo } from "react";
import { FindingsCard } from "@/components/FindingsCard";
import { Markdown } from "@/features/chat/Markdown";
import { leaveDecisionCard } from "@/features/chat/useFeed";
import { EDIT_NOTES, reportMarkerIds } from "@/features/reviews/review-conversation";
import { cardOf, disabledNote } from "@/features/task/pr-findings";
import { findingViewsOf } from "@/lib/findings";
import { asPRStatus, type Entry, type PullRequest, type TaskSummary } from "@/lib/wails";
import {
  decidePRFindingInPlace,
  openPRFindingInEditor,
  savePRFindingTextInPlace,
} from "@/store/actions";
import { useAppStore, useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];

// END is the key the conversation gives what has no entry to follow: the end of the conversation.
const END = "end";

// passRevision is the report a pass of the pull request stands at now, null when the task no longer has it.
function passRevision(taskId: string, pass: number): number | null {
  const task = useAppStore.getState().app?.tasks?.find((each) => each.id === taskId);
  return task?.pr?.reports?.find((each) => each.pass === pass)?.revision ?? null;
}

/**
 * usePRConversationAnchors is what the conversation of the review of the pull request of a task
 * draws after one of its entries: the card of findings after the latest report of the current pass.
 */
export function usePRConversationAnchors(
  task: TaskSummary,
  pr: PullRequest,
): ReadonlyMap<string, ReactNode> {
  const entries = useTranscript(task.id, "pr_review")?.entries ?? NO_ENTRIES;
  return useMemo(() => {
    const anchors = new Map<string, ReactNode>();
    const card = cardOf(pr);
    if (card === null) {
      return anchors;
    }
    const { report } = card;
    const blocked = asPRStatus(pr.status) === "blocked";
    const now = Date.now();
    anchors.set(
      reportMarkerIds(entries).get(report.pass) ?? END,
      <FindingsCard
        key="findings"
        owner={task.id}
        pass={report.pass}
        revision={report.revision}
        currentRevision={() => passRevision(task.id, report.pass)}
        findings={report.findings ?? []}
        views={findingViewsOf(
          report.findings ?? [],
          card.disabled
            ? (finding) => (blocked ? "Not sent" : disabledNote(report, finding, now))
            : null,
        )}
        editNote={EDIT_NOTES.apply}
        disabled={card.disabled}
        decide={(number, decision) =>
          decidePRFindingInPlace(task.id, report.pass, number, decision)
        }
        saveText={(number, text) => savePRFindingTextInPlace(task.id, report.pass, number, text)}
        openEditor={(number) => void openPRFindingInEditor(task.id, report.pass, number)}
        renderText={(text) => <Markdown cutCode>{text}</Markdown>}
        onLeave={leaveDecisionCard}
      />,
    );
    return anchors;
  }, [task, pr, entries]);
}
