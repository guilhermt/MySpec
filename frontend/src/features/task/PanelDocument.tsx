import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { StepDocument } from "@/features/task/StepDocument";
import { useArtifact } from "@/features/task/useArtifact";

export interface PanelDocumentProps {
  taskId: string;
  /** file is the artifact name for readArtifact: PRD.md, steps/3-wire-the-api.md, step-reviews/3-1.md. */
  file: string;
  artifactVersion: number;
  /** title names the document next to the way back: PRD, Step 3 · Review 1 · changes. */
  title: string;
  /** back is the panel the way back returns to: Details, Artifacts. */
  back: string;
  onBack: () => void;
  /** step reads a step file, without the metadata header it may carry. */
  step?: boolean;
}

/** LOADING_WIDTHS are the three bars of the skeleton while a document is read. */
const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/**
 * PanelDocument is a document of a task opened in place of the list of a panel: the way back and the
 * title, then the document in Markdown. Reading, three bars; a failed read says so, and Try again
 * reads it once more. The focus goes to the way back when it opens.
 */
export function PanelDocument({
  taskId,
  file,
  artifactVersion,
  title,
  back,
  onBack,
  step = false,
}: PanelDocumentProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-(--space-3)">
      <div className="flex min-w-0 items-center gap-(--space-2)">
        <Button ref={backRef} variant="ghost" size="sm" onClick={onBack}>
          {`← ${back}`}
        </Button>
        <h3 className="min-w-0 truncate font-semibold text-ink-1">{title}</h3>
      </div>
      {/* A new attempt mounts the reading again, which reads the file again. */}
      <DocumentBody
        key={attempt}
        taskId={taskId}
        file={file}
        artifactVersion={artifactVersion}
        title={title}
        step={step}
        onRetry={() => setAttempt((count) => count + 1)}
      />
    </div>
  );
}

interface DocumentBodyProps {
  taskId: string;
  file: string;
  artifactVersion: number;
  title: string;
  step: boolean;
  onRetry: () => void;
}

/** DocumentBody reads one document and shows it, or the bars while it reads, or why it couldn't. */
function DocumentBody({ taskId, file, artifactVersion, title, step, onRetry }: DocumentBodyProps) {
  const artifact = useArtifact(taskId, file, artifactVersion);

  if (artifact.status === "error") {
    return (
      <NoticeStrip
        title={`Couldn't read ${file}`}
        reason={artifact.error}
        className="bg-state-error-veil"
        action={
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  if (artifact.status === "ready") {
    return step ? (
      <StepDocument content={artifact.content} />
    ) : (
      <div className="select-text">
        <Markdown>{artifact.content}</Markdown>
      </div>
    );
  }
  return (
    <Skeleton label={`Reading ${title}`}>
      {LOADING_WIDTHS.map((width) => (
        <SkeletonBar key={width} className={width} />
      ))}
    </Skeleton>
  );
}
