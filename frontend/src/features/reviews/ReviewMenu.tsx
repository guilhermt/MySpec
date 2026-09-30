import { Fragment, useState } from "react";
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
import { ReviewAgainDialog } from "@/features/reviews/ReviewAgainDialog";
import { type ReviewMenuAction, reviewMenu } from "@/features/reviews/review-header";
import { TaskMenuRow } from "@/features/task/TaskMenu";
import type { ReviewSummary } from "@/lib/wails";
import { openExternal, openReviewInEditor, refreshReviewPR } from "@/store/actions";

/** Opened is the dialog an item of the ⋯ left open. */
type Opened = "reviewAgain" | "deleteReview";

// MINUTE is how often the age of the reading in the ⋯ is read again.
const MINUTE = 60_000;

export interface ReviewMenuProps {
  review: ReviewSummary;
}

/** ReviewMenu is the ⋯ of a review: its pull request, another pass, and its deletion. */
export function ReviewMenu({ review }: ReviewMenuProps) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [reading, setReading] = useState(false);
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
      case "deleteReview":
        setOpened(action);
        break;
    }
  };
  const close = (open: boolean) => {
    if (!open) {
      setOpened(null);
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
                  <TaskMenuRow
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

      <ReviewAgainDialog review={review} open={opened === "reviewAgain"} onOpenChange={close} />
      <DeleteReviewDialog review={review} open={opened === "deleteReview"} onOpenChange={close} />
    </>
  );
}
