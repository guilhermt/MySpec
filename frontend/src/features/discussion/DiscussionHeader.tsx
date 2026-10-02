import { ItemPause } from "@/components/ItemPause";
import { PanelGroup } from "@/components/system/AuxPanel";
import { ContextMeter } from "@/components/system/ContextMeter";
import { ICONS } from "@/components/system/icons";
import { Stepper } from "@/components/system/Stepper";
import { useNow } from "@/features/attention/useNow";
import { DiscussionMenu } from "@/features/discussion/DiscussionMenu";
import { discussionPauseRefusal, discussionStepper } from "@/features/discussion/discussion-header";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { asSessionStatus, DISCUSSION_STAGE, type DiscussionSummary, sessionKey } from "@/lib/wails";
import { useAppStore, usePanel } from "@/store/app-store";

/** PANELS are the panels of a discussion, in their order, each with what it shows. */
const PANELS = [
  {
    id: "details",
    label: "Details",
    tooltip: "The board, the cards, the repositories read, the rounds",
    icon: ICONS.details,
  },
  {
    id: "documents",
    label: "Documents",
    tooltip: "The context and the document of the discussion",
    icon: ICONS.file,
  },
] as const;

// MINUTE is how often the times in the header are read again.
const MINUTE = 60_000;

export interface DiscussionHeaderProps {
  discussion: DiscussionSummary;
}

/**
 * DiscussionHeader is the header of the place of a discussion: the title, the pill of its round, and
 * on the right the context meter, Pause or Resume, the panels and the ⋯. The meter and Pause are
 * there only while the discussion has a session.
 */
export function DiscussionHeader({ discussion }: DiscussionHeaderProps) {
  const now = useNow(MINUTE, true);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);
  // A conversation that couldn't be read is settled too: the pill stops glowing.
  const transcriptSettled = useAppStore((state) => {
    const status = state.transcripts[sessionKey(discussion.id, DISCUSSION_STAGE)]?.status;
    return status === "ready" || status === "error";
  });
  const stepper = discussionStepper(discussion, now);
  const hasSession = discussion.sessionStage !== "";

  return (
    <LocationHeader
      progress={
        <Stepper
          steps={stepper.steps}
          pill={stepper.pill}
          label={stepper.label}
          tooltip={stepper.tooltip}
          loading={!transcriptSettled}
        />
      }
    >
      {hasSession && (
        <ContextMeter
          percent={discussion.contextPercent === 0 ? null : discussion.contextPercent}
          paused={asSessionStatus(discussion.sessionStatus) === "paused"}
          compact="narrow"
          detail={`Context used by the discussion: ${discussion.contextPercent === 0 ? "…" : `${Math.round(discussion.contextPercent)}%`}`}
        />
      )}
      <ItemPause
        id={discussion.id}
        item="the discussion"
        session={
          hasSession
            ? {
                stage: discussion.sessionStage,
                sessionStatus: discussion.sessionStatus,
                pausedAt: discussion.pausedAt,
              }
            : null
        }
        refusal={() => discussionPauseRefusal(discussion)}
        now={now}
      />
      <PanelGroup panels={PANELS} open={panel} onOpenChange={openPanel} />
      <DiscussionMenu discussion={discussion} />
    </LocationHeader>
  );
}
