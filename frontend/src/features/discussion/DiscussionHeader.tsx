import { Archive, MessagesSquare, PanelRight, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArchiveDiscussionDialog } from "@/features/discussion/ArchiveDiscussionDialog";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import {
  discussionStatusLabel,
  discussionStatusTone,
} from "@/features/discussion/discussion-status";
import { ContextGauge } from "@/features/task/ContextGauge";
import { ToneDot } from "@/features/task/StatusDot";
import { discussionSituation, situationTone } from "@/lib/situations";
import { asSessionStatus, type DiscussionSummary } from "@/lib/wails";
import { pause, resume } from "@/store/actions";

export interface DiscussionHeaderProps {
  discussion: DiscussionSummary;
  /** documentsOpen is whether the panel of the documents is showing right now. */
  documentsOpen: boolean;
  onToggleDocuments: () => void;
}

/** DiscussionHeader names the discussion and holds what the user can do to it. */
export function DiscussionHeader({
  discussion,
  documentsOpen,
  onToggleDocuments,
}: DiscussionHeaderProps) {
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const situation = discussionSituation(discussion);
  // What waits on the user takes the colour of its situation; without one, the
  // dot shows what the discussion is doing.
  const tone = situation !== null ? situationTone(situation) : discussionStatusTone(discussion);
  const status = asSessionStatus(discussion.sessionStatus);
  const paused = status === "paused";
  const running = discussion.sessionStage !== "";

  const archiveButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Archive discussion"
      disabled={!discussion.canArchive}
      onClick={() => setArchiving(true)}
    >
      <Archive />
    </Button>
  );

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <MessagesSquare aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <Badge variant="outline">Discussion</Badge>
      <span className="min-w-0 truncate font-medium">{discussion.title}</span>
      <Badge variant="secondary">{discussion.board}</Badge>
      <Badge variant="outline" className="gap-1.5">
        <ToneDot tone={tone} />
        {discussionStatusLabel(discussion)}
      </Badge>

      <span className="flex-1" />

      <ContextGauge percent={discussion.contextPercent} />
      {running && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!paused && status === "error"}
          onClick={() =>
            void (paused
              ? resume(discussion.id, discussion.sessionStage)
              : pause(discussion.id, discussion.sessionStage))
          }
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      )}
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Documents"
          aria-pressed={documentsOpen}
          onClick={onToggleDocuments}
        >
          <PanelRight />
        </TooltipTrigger>
        <TooltipContent>Documents</TooltipContent>
      </Tooltip>
      {discussion.canArchive || discussion.archiveHint === "" ? (
        archiveButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span />}>{archiveButton}</TooltipTrigger>
          <TooltipContent>{discussion.archiveHint}</TooltipContent>
        </Tooltip>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete discussion"
        onClick={() => setDeleting(true)}
      >
        <Trash2 />
      </Button>

      <ArchiveDiscussionDialog
        discussion={discussion}
        open={archiving}
        onOpenChange={setArchiving}
      />
      <DeleteDiscussionDialog discussion={discussion} open={deleting} onOpenChange={setDeleting} />
    </header>
  );
}
