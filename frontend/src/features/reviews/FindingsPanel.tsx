import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FindingCard } from "@/features/reviews/FindingCard";
import { decidedCount, lastRecordedPass, reportLabel } from "@/features/reviews/review-status";
import { cn } from "@/lib/utils";
import type { ReviewSummary } from "@/lib/wails";

export interface FindingsPanelProps {
  review: ReviewSummary;
}

/**
 * FindingsPanel is the report of the last pass as a list the user decides on,
 * one finding at a time. A pass already published is there to read. The summary belongs to the
 * publish dialog.
 */
export function FindingsPanel({ review }: FindingsPanelProps) {
  const pass = lastRecordedPass(review);
  // A pass still to publish is what the screen is for; a published one gives
  // the conversation the room back. Every new pass starts from that again.
  const defaultOpen = pass === null || !pass.published;
  const [open, setOpen] = useState(defaultOpen);
  const [openFor, setOpenFor] = useState(pass?.pass ?? 0);
  if (openFor !== (pass?.pass ?? 0)) {
    setOpenFor(pass?.pass ?? 0);
    setOpen(defaultOpen);
  }

  if (pass === null) {
    return null;
  }
  const findings = pass.findings ?? [];
  const decided = decidedCount(pass);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="shrink-0 border-b">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
        <ChevronRight
          aria-hidden="true"
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="font-medium">{reportLabel(pass)}</span>
        {findings.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {`${decided} of ${findings.length} decided`}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-[50dvh] overflow-y-auto px-3 pb-3">
        <div className="mx-auto flex w-full max-w-[58.5rem] flex-col gap-3">
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to change.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {findings.map((finding) => (
                <FindingCard
                  key={finding.number}
                  reviewId={review.id}
                  pass={pass.pass}
                  revision={pass.revision}
                  finding={finding}
                  published={pass.published}
                />
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
