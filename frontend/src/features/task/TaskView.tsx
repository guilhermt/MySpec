import { useCallback, useEffect, useState } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { ArtifactPanel } from "@/features/task/ArtifactPanel";
import { PlanProblemsNotice } from "@/features/task/PlanProblemsNotice";
import { PRBar } from "@/features/task/PRBar";
import { PRPane } from "@/features/task/PRPane";
import { StageTrack } from "@/features/task/StageTrack";
import { StepBar } from "@/features/task/StepBar";
import { StepPane } from "@/features/task/StepPane";
import { hasArtifacts } from "@/features/task/status";
import { currentStepOf, hasStepSession, stepStage } from "@/features/task/step-status";
import { TaskHeader } from "@/features/task/TaskHeader";
import { prOf } from "@/lib/pull-requests";
import { asTaskStage, sessionKey } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useOpenStepTab, useTask } from "@/store/app-store";

const CONVERSATION_PANEL = "conversation";
const ARTIFACTS_PANEL = "artifacts";

const PANEL_IDS = [CONVERSATION_PANEL, ARTIFACTS_PANEL];

function seenKey(taskId: string): string {
  return `myspec.artifacts.seen:${taskId}`;
}

// Browser storage can be unavailable; the panel then simply opens every time.
function wasSeen(taskId: string): boolean {
  try {
    return localStorage.getItem(seenKey(taskId)) !== null;
  } catch {
    return false;
  }
}

function markSeen(taskId: string): void {
  try {
    localStorage.setItem(seenKey(taskId), "1");
  } catch {
    // Nothing to remember it with; opening it again is harmless.
  }
}

export interface TaskViewProps {
  taskId: string;
}

/** TaskView is the screen of one task: the conversation and what came out of it. */
export function TaskView({ taskId }: TaskViewProps) {
  const task = useTask(taskId);
  const stepTab = useOpenStepTab(taskId);
  const panelRef = usePanelRef();
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `myspec.task-panels:${taskId}`,
    panelIds: PANEL_IDS,
  });

  const anyArtifact = task !== null && hasArtifacts(task);
  const implementing = task !== null && asTaskStage(task.stage) === "implementation";
  const opening = task !== null && asTaskStage(task.stage) === "pr";
  const step = task !== null && implementing ? currentStepOf(task) : null;
  const pr = task === null ? null : prOf(task);
  // The conversation on screen is the one of the stage the task is in: the tab
  // of the step that runs in the implementation stage, the pull request in the
  // PR one. Both open a session of their own only once they get that far.
  const stage = (() => {
    if (implementing) {
      if (step === null) {
        return "";
      }
      return stepTab === "reviewer" && step.reviewer !== null
        ? step.reviewer.sessionStage
        : stepStage(step.number);
    }
    if (opening) {
      return pr?.sessionStage ?? "";
    }
    return task?.stage ?? "";
  })();
  const hasConversation =
    task !== null && (implementing ? hasStepSession(step) : opening ? stage !== "" : true);

  // The conversation is fetched once and then kept: leaving the task and coming
  // back costs nothing, and the events keep being applied while it is away. It
  // waits for the task to be in the snapshot, which a brand new one is not yet.
  useEffect(() => {
    const key = sessionKey(taskId, stage);
    if (hasConversation && useAppStore.getState().transcripts[key] === undefined) {
      void loadTranscript(taskId, stage);
    }
  }, [taskId, stage, hasConversation]);

  // Nothing to read yet, and no size the user chose: stay out of the way.
  useEffect(() => {
    if (defaultLayout === undefined && !anyArtifact) {
      panelRef.current?.collapse();
    }
  }, [defaultLayout, anyArtifact, panelRef]);

  // The first artifact of a task opens the panel by itself, once.
  useEffect(() => {
    if (!anyArtifact || wasSeen(taskId)) {
      return;
    }
    markSeen(taskId);
    panelRef.current?.expand();
  }, [taskId, anyArtifact, panelRef]);

  const toggleArtifacts = useCallback(() => {
    const panel = panelRef.current;
    if (panel === null) {
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [panelRef]);

  if (task === null) {
    return <section className="min-h-0 flex-1 bg-background" />;
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <TaskHeader task={task} artifactsOpen={artifactsOpen} onToggleArtifacts={toggleArtifacts} />
      <StageTrack task={task} />
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        {/* The library's panel scrolls by default; only the conversation scrolls here, so it clips. */}
        <ResizablePanel
          id={CONVERSATION_PANEL}
          defaultSize="60%"
          minSize="40%"
          className="flex min-w-0 flex-col"
          style={{ overflow: "clip" }}
        >
          {implementing ? (
            <>
              <StepBar task={task} />
              <StepPane task={task} />
            </>
          ) : opening ? (
            pr !== null && (
              <>
                <PRBar task={task} pr={pr} />
                <PRPane task={task} pr={pr} />
              </>
            )
          ) : (
            <>
              <Conversation
                key={`conversation:${task.stage}`}
                taskId={task.id}
                stage={task.stage}
                session={task}
              />
              <PlanProblemsNotice task={task} />
              <Composer taskId={task.id} stage={task.stage} session={task} />
            </>
          )}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          id={ARTIFACTS_PANEL}
          panelRef={panelRef}
          defaultSize="40%"
          minSize="25%"
          collapsible
          collapsedSize="0%"
          onResize={(size) => setArtifactsOpen(size.asPercentage > 0)}
        >
          <ArtifactPanel task={task} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
