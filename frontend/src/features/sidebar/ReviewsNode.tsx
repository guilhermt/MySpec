import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { reviewRowLabel, reviewStatusTone } from "@/features/reviews/review-status";
import { ToneDot } from "@/features/task/StatusDot";
import { reviewName, situationTone } from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { ReviewSummary } from "@/lib/wails";
import {
  useAppStore,
  useFlashing,
  useOpenReviewId,
  useReviewCenter,
  useReviews,
  useReviewsOpen,
  useSidebarCollapsed,
} from "@/store/app-store";

/** REVIEWS_NODE is the id the node of the reviews is collapsed by. */
export const REVIEWS_NODE = "reviews";

const HEADER_BUTTON_CLASS =
  "flex h-7 items-center rounded-md outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

interface ReviewRowItemProps {
  review: ReviewSummary;
  selected: boolean;
}

/** ReviewRowItem is one active review under the node, opening it on click. */
function ReviewRowItem({ review, selected }: ReviewRowItemProps) {
  const openReview = useAppStore((state) => state.openReview);
  const flashingIds = useFlashing();
  // The dot and the highlight take the tone of the most urgent situation.
  const [urgent] = review.situations ?? [];
  const tone = urgent !== undefined ? situationTone(urgent) : reviewStatusTone(review);
  const flashing =
    !selected && (review.situations ?? []).some((situation) => flashingIds.has(situation.id));
  const label = reviewRowLabel(review);
  const name = reviewName(review);

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        aria-label={`${name}, ${review.title}, ${label}`}
        onClick={() => openReview(review.id)}
        data-tone={flashing ? tone : undefined}
        className={cn(
          "flex h-12 w-full flex-col justify-center gap-0.5 rounded-md px-2 text-left outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          flashing && "attention-flash",
        )}
      >
        <span className="flex w-full items-center gap-1">
          <ToneDot tone={tone} className="mx-0.5" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <span className={cn("shrink-0 text-xs", !selected && "text-muted-foreground")}>
            {label}
          </span>
        </span>
        <span className="truncate pl-4 text-xs text-muted-foreground" title={review.title}>
          {review.title}
        </span>
      </button>
    </li>
  );
}

/**
 * ReviewsNode is the way into the Reviews view, with the count of the pull
 * requests pending a review, and the active reviews under it. The reviews pass
 * through neither the repository filter of the sidebar nor the filters of the
 * view: a review under way is always there.
 */
export function ReviewsNode() {
  const reviews = useReviews();
  const { pendingCount } = useReviewCenter();
  const reviewsOpen = useReviewsOpen();
  const openReviewId = useOpenReviewId();
  const openReviews = useAppStore((state) => state.openReviews);
  const toggleSidebarNode = useAppStore((state) => state.toggleSidebarNode);
  const expandSidebarNodes = useAppStore((state) => state.expandSidebarNodes);
  const collapsed = useSidebarCollapsed().has(REVIEWS_NODE);

  // A review that opens shows under the node. Collapsing it afterwards stays.
  useEffect(() => {
    if (openReviewId !== null) {
      expandSidebarNodes([REVIEWS_NODE]);
    }
  }, [openReviewId, expandSidebarNodes]);

  return (
    <nav aria-label="Reviews" className="flex shrink-0 flex-col border-b p-1">
      <div className="flex min-w-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`${collapsed ? "Expand" : "Collapse"} Reviews`}
          aria-expanded={!collapsed}
          onClick={() => toggleSidebarNode(REVIEWS_NODE)}
          className={cn(HEADER_BUTTON_CLASS, "w-6 shrink-0 justify-center text-muted-foreground")}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")}
          />
        </button>
        <button
          type="button"
          aria-current={reviewsOpen ? "page" : undefined}
          onClick={() => openReviews()}
          className={cn(
            HEADER_BUTTON_CLASS,
            "min-w-0 flex-1 gap-2 px-1 text-xs font-medium",
            reviewsOpen && "bg-accent text-accent-foreground hover:bg-accent",
          )}
        >
          <span className="truncate">Reviews</span>
          {pendingCount > 0 && (
            <span
              role="img"
              aria-label={`${pendingCount} pending`}
              className="ml-auto rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-sidebar-accent-foreground"
            >
              {pendingCount}
            </span>
          )}
        </button>
      </div>
      {!collapsed && reviews.length > 0 && (
        // Five rows of h-12 make 60: the sixth is the first to scroll, as in
        // Waiting for you, so the tasks below keep their room.
        <ScrollArea className="max-h-60 **:data-[slot=scroll-area-viewport]:max-h-60">
          <ul className="flex flex-col">
            {reviews.map((review) => (
              <ReviewRowItem
                key={review.id}
                review={review}
                selected={review.id === openReviewId}
              />
            ))}
          </ul>
        </ScrollArea>
      )}
    </nav>
  );
}
