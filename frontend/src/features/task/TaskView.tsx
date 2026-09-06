import { useCallback, useEffect, useState } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { ArtifactPanel } from "@/features/task/ArtifactPanel";
import { TaskHeader } from "@/features/task/TaskHeader";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useTask } from "@/store/app-store";

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
  const panelRef = usePanelRef();
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `myspec.task-panels:${taskId}`,
    panelIds: PANEL_IDS,
  });

  const hasPrd = task?.hasPrd ?? false;
  const exists = task !== null;

  // The conversation is fetched once and then kept: leaving the task and coming
  // back costs nothing, and the events keep being applied while it is away. It
  // waits for the task to be in the snapshot, which a brand new one is not yet.
  useEffect(() => {
    if (exists && useAppStore.getState().transcripts[taskId] === undefined) {
      void loadTranscript(taskId);
    }
  }, [taskId, exists]);

  // Nothing to read yet, and no size the user chose: stay out of the way.
  useEffect(() => {
    if (defaultLayout === undefined && !hasPrd) {
      panelRef.current?.collapse();
    }
  }, [defaultLayout, hasPrd, panelRef]);

  // The first PRD of a task opens the panel by itself, once.
  useEffect(() => {
    if (!hasPrd || wasSeen(taskId)) {
      return;
    }
    markSeen(taskId);
    panelRef.current?.expand();
  }, [taskId, hasPrd, panelRef]);

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
    return <section className="h-dvh bg-background" />;
  }

  return (
    <section className="flex h-dvh min-w-0 flex-col bg-background">
      <TaskHeader task={task} artifactsOpen={artifactsOpen} onToggleArtifacts={toggleArtifacts} />
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <ResizablePanel
          id={CONVERSATION_PANEL}
          defaultSize="60%"
          minSize="40%"
          className="flex min-w-0 flex-col"
        >
          <Conversation taskId={task.id} />
          <Composer task={task} />
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
