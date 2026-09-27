import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { Banner } from "@/features/notice/Notice";
import { useArtifact } from "@/features/task/useArtifact";
import { stepReportLabel } from "@/lib/review-modes";
import type { StepReport } from "@/lib/wails";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

export interface OneShotViewProps {
  taskId: string;
  /** hasDocument is whether one-shot.md is written. */
  hasDocument: boolean;
  /** reports are the reports of the agent review of the single step, by pass. */
  reports: readonly StepReport[];
  artifactVersion: number;
  /** empty is what the view says while the document is not written. */
  empty: string;
}

/**
 * OneShotView is the document of a One-Shot task, with the reports of the agent
 * review of its single step, in the artifact panel and in the history.
 */
export function OneShotView({
  taskId,
  hasDocument,
  reports,
  artifactVersion,
  empty,
}: OneShotViewProps) {
  const [report, setReport] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState("");

  // A report the step no longer has, once the step is discarded, falls back to the document.
  const open = reports.find((candidate) => candidate.file === report) ?? null;
  const artifact = useArtifact(
    taskId,
    open !== null ? `step-reviews/${open.file}` : hasDocument ? "one-shot.md" : null,
    artifactVersion,
  );

  return (
    <>
      {open !== null && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b px-3">
          <Button variant="ghost" size="sm" onClick={() => setReport(null)}>
            ← One-Shot
          </Button>
          <span className="min-w-0 truncate text-sm font-medium">
            {stepReportLabel(open.pass, open.clean)}
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {open === null && reports.length > 0 && (
          <nav aria-label="Reviews" className="mb-4">
            <ul className="flex flex-wrap gap-1">
              {reports.map((candidate) => (
                <li key={candidate.file}>
                  <Button variant="outline" size="xs" onClick={() => setReport(candidate.file)}>
                    {stepReportLabel(candidate.pass, candidate.clean)}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {artifact.status === "empty" && (
          <p className="text-sm text-muted-foreground italic">{empty}</p>
        )}
        {artifact.status === "loading" && (
          <div className="flex flex-col gap-3">
            {LOADING_WIDTHS.map((width) => (
              <Skeleton key={width} className={`h-4 ${width}`} />
            ))}
          </div>
        )}
        {artifact.status === "error" && artifact.error !== dismissed && (
          <Banner
            className="bg-destructive/10"
            title="Couldn't read the document"
            onDismiss={() => setDismissed(artifact.error)}
          >
            {artifact.error}
          </Banner>
        )}
        {artifact.status === "ready" && (
          <div className="max-w-[58.5rem] select-text">
            <Markdown>{artifact.content}</Markdown>
          </div>
        )}
      </div>
    </>
  );
}
