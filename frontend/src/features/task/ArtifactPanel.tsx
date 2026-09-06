import { FileText } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { ErrorNotice } from "@/features/notice/Notice";
import { useArtifact } from "@/features/task/useArtifact";
import type { TaskSummary } from "@/lib/wails";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

function Empty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="font-medium">No artifacts yet</p>
      <p className="text-sm text-muted-foreground">
        The PRD will appear here as soon as the agent writes it.
      </p>
    </div>
  );
}

export interface ArtifactPanelProps {
  task: TaskSummary;
}

/** ArtifactPanel shows the PRD next to the conversation that is shaping it. */
export function ArtifactPanel({ task }: ArtifactPanelProps) {
  const artifact = useArtifact(task.id, task.hasPrd, task.artifactVersion);
  const [dismissed, setDismissed] = useState("");

  return (
    <section className="flex h-full min-w-0 flex-col bg-background">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">PRD</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {artifact.status === "empty" && <Empty />}
        {artifact.status === "loading" && (
          <div className="flex flex-col gap-3">
            {LOADING_WIDTHS.map((width) => (
              <Skeleton key={width} className={`h-4 ${width}`} />
            ))}
          </div>
        )}
        {artifact.status === "error" && artifact.error !== dismissed && (
          <ErrorNotice message={artifact.error} onDismiss={() => setDismissed(artifact.error)} />
        )}
        {artifact.status === "ready" && (
          <div className="max-w-[760px] select-text">
            <Markdown>{artifact.content}</Markdown>
          </div>
        )}
      </div>
    </section>
  );
}
