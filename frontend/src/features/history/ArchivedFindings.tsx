import { useState } from "react";
import { CutText } from "@/components/system/CutText";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Chevron } from "@/features/chat/entries/Chevron";
import { LINE, SUNKEN } from "@/features/chat/entries/MarkerLine";
import { Markdown } from "@/features/chat/Markdown";
import type { OutFinding } from "@/features/history/archived";
import { cn } from "@/lib/utils";

// FindingLine is one finding that left the pass: closed, its title, where it points and where it
// went, opening the text that went.
function FindingLine({ finding }: { finding: OutFinding }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          aria-label={[finding.title, finding.location, finding.went]
            .filter((part) => part !== "")
            .join(" · ")}
          className={cn(
            LINE,
            "w-[calc(100%+var(--space-4))] outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring",
          )}
        >
          <Chevron open={open} />
          <CutText text={finding.title} className="text-ink-1" />
          {finding.location !== "" && (
            <CutText
              text={finding.location}
              className={cn("shrink-[2] text-ink-3", finding.anchored && "font-mono")}
            />
          )}
          <span className="ml-auto shrink-0 whitespace-nowrap text-ink-3">{finding.went}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-(--space-1) pb-(--space-2) pl-(--space-5) select-text">
            <Markdown cutCode>{finding.text}</Markdown>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export interface ArchivedFindingsProps {
  /** pass is the number of the pass, which names the list. */
  pass: number;
  findings: readonly OutFinding[];
}

/**
 * ArchivedFindings are the findings that left a pass of an archived review, in a sunken block: one
 * closed line each, with where it went, that opens the text that went.
 */
export function ArchivedFindings({ pass, findings }: ArchivedFindingsProps) {
  return (
    <ul aria-label={`Findings of pass ${pass}`} className={cn(SUNKEN, "flex flex-col")}>
      {findings.map((finding) => (
        <FindingLine key={finding.id} finding={finding} />
      ))}
    </ul>
  );
}
