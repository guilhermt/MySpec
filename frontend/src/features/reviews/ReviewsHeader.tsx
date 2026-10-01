import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { ReadingAge } from "@/components/system/ReadingAge";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import type { ReviewCenter } from "@/lib/wails";
import { refreshPullRequests } from "@/store/actions";

export interface ReviewsHeaderProps {
  center: ReviewCenter;
  /** now is the clock the age of the reading counts from. */
  now: number;
}

/** ReviewsHeader is the header of the place of Reviews: how old its reading is, and Refresh, on the right. */
export function ReviewsHeader({ center, now }: ReviewsHeaderProps) {
  return (
    <LocationHeader>
      <ReadingAge readAt={center.readAt} reading={center.reading} now={now} />
      <IconButton
        label="Refresh"
        tooltip="Read the pull requests again"
        icon={ICONS.refresh}
        size="sm"
        disabled={center.reading}
        disabledReason="A reading is running."
        onClick={() => void refreshPullRequests()}
      />
    </LocationHeader>
  );
}
