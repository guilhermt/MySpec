import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { ErrorNotice } from "@/features/notice/Notice";
import { reportLabel, verdictLabel } from "@/features/reviews/review-status";
import { useReviewArtifact } from "@/features/reviews/useReviewArtifact";
import type { ReviewPass, ReviewSummary } from "@/lib/wails";
import { openExternal } from "@/store/actions";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/** CONTEXT_FILE is the document the app writes for the agent before every pass. */
const CONTEXT_FILE = "context.md";

/** Selection is the list of reports, or the document drilled into. */
type Selection = "list" | "context" | { pass: number };

function isPass(selection: Selection): selection is { pass: number } {
  return typeof selection === "object";
}

/** Published says what became of a pass that was sent to GitHub. */
export function Published({ pass }: { pass: ReviewPass }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{`Published · ${verdictLabel(pass.verdict)} · ${new Date(pass.publishedAt).toLocaleString()}`}</span>
      {pass.publishedUrl !== "" && (
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0 text-xs"
          onClick={() => void openExternal(pass.publishedUrl)}
        >
          Open on GitHub
        </Button>
      )}
    </div>
  );
}

export interface ReportsPanelProps {
  review: ReviewSummary;
}

/** ReportsPanel is what the review has written, next to the conversation. */
export function ReportsPanel({ review }: ReportsPanelProps) {
  const [selection, setSelection] = useState<Selection>("list");
  const [dismissed, setDismissed] = useState("");

  const passes = (review.passes ?? []).filter((pass) => pass.recorded);
  const open = isPass(selection)
    ? (passes.find((pass) => pass.pass === selection.pass) ?? null)
    : null;
  // A report the review no longer has falls back to the list it came from.
  const view: Selection = isPass(selection) && open === null ? "list" : selection;
  const name = view === "list" ? null : open === null ? CONTEXT_FILE : open.file;
  const artifact = useReviewArtifact(review.id, name, open?.revision ?? passes.length);

  return (
    <section className="flex h-full min-w-0 flex-col bg-background">
      <header className="flex h-9 shrink-0 items-center border-b px-3">
        {view === "list" ? (
          <span className="text-sm font-medium">Reports</span>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelection("list")}>
              ← Reports
            </Button>
            <span className="min-w-0 truncate text-sm font-medium">
              {open === null ? "Context" : reportLabel(open)}
            </span>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {view === "list" ? (
          <ul className="flex flex-col">
            <li>
              <button
                type="button"
                onClick={() => setSelection("context")}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                Context
              </button>
            </li>
            {passes.map((pass) => (
              <li key={pass.pass}>
                <button
                  type="button"
                  onClick={() => setSelection({ pass: pass.pass })}
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  {reportLabel(pass)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {artifact.status === "loading" && (
              <div className="flex flex-col gap-3">
                {LOADING_WIDTHS.map((width) => (
                  <Skeleton key={width} className={`h-4 ${width}`} />
                ))}
              </div>
            )}
            {artifact.status === "error" && artifact.error !== dismissed && (
              <ErrorNotice
                message={artifact.error}
                onDismiss={() => setDismissed(artifact.error)}
              />
            )}
            {artifact.status === "ready" && (
              <div className="max-w-[58.5rem] select-text">
                {open?.published === true && <Published pass={open} />}
                <Markdown>{artifact.content}</Markdown>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
