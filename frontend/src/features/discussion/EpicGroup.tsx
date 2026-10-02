import { DraftCard } from "@/features/discussion/DraftCard";
import type { EpicGroup as Group } from "@/features/discussion/discussion-status";
import { cn } from "@/lib/utils";
import type { DiscussionSummary } from "@/lib/wails";

export interface EpicGroupProps {
  discussion: DiscussionSummary;
  group: Group;
}

/**
 * EpicGroup is an epic of a discussion with the cards under it: they are
 * decided one by one, and the epic goes to GitHub with them once it is
 * approved and its cards are decided.
 */
export function EpicGroup({ discussion, group }: EpicGroupProps) {
  const { epic, members } = group;
  const discarded = epic.decision === "discarded";

  return (
    <section
      aria-label={`Epic ${epic.title}`}
      className={cn("flex flex-col gap-2 rounded-lg border p-2", discarded && "opacity-60")}
    >
      <DraftCard discussion={discussion} draft={epic} />
      {members.length > 0 && (
        <div className="flex flex-col gap-2 pl-4">
          {members.map((member) => (
            <DraftCard key={member.id} discussion={discussion} draft={member} />
          ))}
        </div>
      )}
    </section>
  );
}
