import { Fragment, useState } from "react";
import { MenuRow } from "@/components/MenuRow";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/system/Menu";
import { useNow } from "@/features/attention/useNow";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { type ReviewMenuAction, reviewMenu } from "@/features/reviews/review-header";
import type { ReviewSummary } from "@/lib/wails";
import { openExternal, openReviewInEditor, refreshReviewPR } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

// MINUTE is how often the age of the reading in the ⋯ is read again.
const MINUTE = 60_000;

export interface ReviewMenuProps {
  review: ReviewSummary;
}

/** ReviewMenu is the ⋯ of a review: its pull request, another pass, and its deletion. */
export function ReviewMenu({ review }: ReviewMenuProps) {
  const [deleting, setDeleting] = useState(false);
  const [reading, setReading] = useState(false);
  const openReviewDialog = useAppStore((state) => state.openReviewDialog);
  const groups = reviewMenu(review, useNow(MINUTE, true));

  const refresh = async () => {
    setReading(true);
    try {
      await refreshReviewPR(review.id);
    } finally {
      setReading(false);
    }
  };

  const run = (action: ReviewMenuAction) => {
    switch (action) {
      case "openPR":
        void openExternal(review.url);
        break;
      case "refreshPR":
        void refresh();
        break;
      case "openInEditor":
        void openReviewInEditor(review.id);
        break;
      case "reviewAgain":
        // The dialog is the review screen's, which the bar and Ctrl+Enter open too.
        openReviewDialog(review.id, "again");
        break;
      case "deleteReview":
        setDeleting(true);
        break;
    }
  };

  return (
    <>
      <Menu>
        <MenuTrigger render={<IconButton label="More actions" icon={ICONS.more} size="sm" />} />
        <MenuContent align="end">
          {groups.map((group) => (
            <Fragment key={group.label ?? "last"}>
              {group.label === null && <MenuSeparator />}
              <MenuGroup>
                {group.label !== null && <MenuGroupLabel>{group.label}</MenuGroupLabel>}
                {group.items.map((item) => (
                  <MenuRow
                    key={item.id}
                    item={
                      item.action === "refreshPR" && reading ? { ...item, sub: "Reading…" } : item
                    }
                    onSelect={() => run(item.action)}
                  />
                ))}
              </MenuGroup>
            </Fragment>
          ))}
        </MenuContent>
      </Menu>

      <DeleteReviewDialog review={review} open={deleting} onOpenChange={setDeleting} />
    </>
  );
}
