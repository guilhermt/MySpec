import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { ReadingAge } from "@/components/system/ReadingAge";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import type { Deploys } from "@/lib/wails";
import { refreshDeploys } from "@/store/actions";

export interface DeploysHeaderProps {
  deploys: Deploys;
  /** now is the clock the age of the reading counts from. */
  now: number;
}

/** DeploysHeader is the header of the place of Deploys: how old its reading is, and Refresh, on the right. */
export function DeploysHeader({ deploys, now }: DeploysHeaderProps) {
  return (
    <LocationHeader>
      <ReadingAge readAt={deploys.readAt} reading={deploys.reading} now={now} />
      <IconButton
        label="Refresh"
        tooltip="Read the deploys again"
        icon={ICONS.refresh}
        size="sm"
        disabled={deploys.reading}
        disabledReason="A reading is running."
        onClick={() => void refreshDeploys()}
      />
    </LocationHeader>
  );
}
