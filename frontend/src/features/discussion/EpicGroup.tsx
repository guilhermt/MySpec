import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { DraftCard } from "@/features/discussion/DraftCard";
import type { EpicGroup as Group } from "@/features/discussion/discussion-status";
import { outcomeLabel } from "@/features/discussion/discussion-status";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { DiscussionSummary } from "@/lib/wails";
import { publishEpic } from "@/store/actions";

export interface EpicGroupProps {
  discussion: DiscussionSummary;
  group: Group;
}

/**
 * EpicGroup is an epic of a discussion with the cards under it: they are
 * decided one by one, and published together, from the epic down.
 */
export function EpicGroup({ discussion, group }: EpicGroupProps) {
  const { epic, members } = group;
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const discarded = epic.decision === "discarded";

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await publishEpic(discussion.id, epic.id);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setPublishing(false);
    }
  };

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
      <div className="flex flex-wrap items-center gap-2 px-1">
        {discarded && <span className="text-xs text-muted-foreground">Discarded</span>}
        {epic.outcome !== "" && (
          <span className="flex items-center gap-1.5 text-xs">
            {outcomeLabel(epic)}
            <ExternalLink
              href={epic.url}
              className="underline-offset-4 hover:underline"
            >{`${epic.repository}#${epic.number}`}</ExternalLink>
          </span>
        )}
        {/* A failure of the run reads on the card of the draft it stopped at,
            the epic's own card included: the footer only offers the run. */}
        {epic.outcome === "" && epic.publishError === "" && (
          <>
            <Button
              variant="outline"
              size="xs"
              disabled={!epic.canPublish || epic.publishing || publishing}
              onClick={() => void publish()}
            >
              Publish epic
            </Button>
            {epic.hint !== "" && <span className="text-xs text-muted-foreground">{epic.hint}</span>}
          </>
        )}
        {error !== null && (
          <span role="alert" className="min-w-0 truncate text-xs text-destructive" title={error}>
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
