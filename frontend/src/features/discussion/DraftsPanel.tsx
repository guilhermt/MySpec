import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DraftCard } from "@/features/discussion/DraftCard";
import { draftsSummary, epicGroups, looseDrafts } from "@/features/discussion/discussion-status";
import { EpicGroup } from "@/features/discussion/EpicGroup";
import { cn } from "@/lib/utils";
import type { DiscussionSummary, Draft } from "@/lib/wails";
import { groupIntoEpic } from "@/store/actions";

// MIN_GROUP is how many drafts an epic needs to be worth making.
const MIN_GROUP = 2;

export interface DraftsPanelProps {
  discussion: DiscussionSummary;
}

// An entry of the panel, in the order the drafts sit in: a loose card, or an
// epic with the cards under it.
type Entry =
  | { kind: "draft"; position: number; draft: Draft }
  | { kind: "epic"; position: number; group: ReturnType<typeof epicGroups>[number] };

// A draft can only be picked for an epic while nothing has been published of it.
function selectable(draft: Draft): boolean {
  return !draft.published && draft.outcome === "";
}

/**
 * DraftsPanel is the cards a discussion wrote, as a list the user decides on,
 * one draft at a time. A new reading of the drafts opens it again.
 */
export function DraftsPanel({ discussion }: DraftsPanelProps) {
  const [open, setOpen] = useState(true);
  const [openFor, setOpenFor] = useState(discussion.draftsRevision);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  if (openFor !== discussion.draftsRevision) {
    setOpenFor(discussion.draftsRevision);
    setOpen(true);
  }

  const drafts = discussion.drafts ?? [];
  if (drafts.length === 0) {
    return null;
  }
  const loose = looseDrafts(drafts);
  const entries: Entry[] = [
    ...epicGroups(drafts).map(
      (group): Entry => ({ kind: "epic", position: group.epic.position, group }),
    ),
    ...loose.map((draft): Entry => ({ kind: "draft", position: draft.position, draft })),
  ].sort((one, other) => one.position - other.position);

  // A draft that got published in the meantime leaves the selection with it.
  const picked = loose.filter((draft) => selectable(draft) && selected.has(draft.id));
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelected(next);
  };

  const group = async () => {
    await groupIntoEpic(
      discussion.id,
      picked.map((draft) => draft.id),
    );
    setSelected(new Set());
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="shrink-0 border-b">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
        <ChevronRight
          aria-hidden="true"
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="font-medium">Drafts</span>
        <span className="text-xs text-muted-foreground">{draftsSummary(drafts)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-[50dvh] overflow-y-auto px-3 pb-3">
        <div className="mx-auto flex w-full max-w-[58.5rem] flex-col gap-3">
          {loose.some(selectable) && (
            <div role="toolbar" aria-label="Grouping" className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={picked.length < MIN_GROUP}
                onClick={() => void group()}
              >
                Group into an epic
              </Button>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {entries.map((entry) =>
              entry.kind === "epic" ? (
                <li key={entry.group.epic.id}>
                  <EpicGroup discussion={discussion} group={entry.group} />
                </li>
              ) : (
                <li key={entry.draft.id} className="flex items-start gap-2">
                  {selectable(entry.draft) && (
                    <Checkbox
                      aria-label={`Select draft ${entry.draft.title}`}
                      checked={selected.has(entry.draft.id)}
                      onCheckedChange={(checked) => toggle(entry.draft.id, checked)}
                      className="mt-3.5"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <DraftCard discussion={discussion} draft={entry.draft} />
                  </div>
                </li>
              ),
            )}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
