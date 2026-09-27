import { Archive, Trash2 } from "lucide-react";
import { useState } from "react";
import { PauseButton } from "@/components/PauseButton";
import { PanelGroup } from "@/components/system/AuxPanel";
import { ICONS } from "@/components/system/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArchiveDiscussionDialog } from "@/features/discussion/ArchiveDiscussionDialog";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import {
  discussionStatusLabel,
  discussionStatusTone,
} from "@/features/discussion/discussion-status";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { ContextGauge } from "@/features/task/ContextGauge";
import { ToneDot } from "@/features/task/StatusDot";
import { discussionSituation, situationTone } from "@/lib/situations";
import { asSessionStatus, type DiscussionSummary } from "@/lib/wails";
import { pause, resume } from "@/store/actions";
import { useAppStore, usePanel } from "@/store/app-store";

export interface DiscussionHeaderProps {
  discussion: DiscussionSummary;
}

/**
 * DiscussionHeader is the header of the place of a discussion, with what the user can do to it on
 * the right.
 */
export function DiscussionHeader({ discussion }: DiscussionHeaderProps) {
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);

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
    <LocationHeader>
      <Badge variant="outline" className="gap-1.5">
        <ToneDot tone={tone} />
        {discussionStatusLabel(discussion)}
      </Badge>
      <ContextGauge percent={discussion.contextPercent} />
      {running && (
        <PauseButton
          paused={paused}
          disabled={!paused && status === "error"}
          onClick={() =>
            void (paused
              ? resume(discussion.id, discussion.sessionStage)
              : pause(discussion.id, discussion.sessionStage))
          }
        />
      )}
      <PanelGroup
        panels={[
          {
            id: "documents",
            label: "Documents",
            tooltip: "The document and the context",
            icon: ICONS.file,
          },
        ]}
        open={panel}
        onOpenChange={openPanel}
      />
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
    </LocationHeader>
  );
}
