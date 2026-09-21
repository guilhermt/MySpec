import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAppStore,
  useDiscussionHistory,
  useHistory,
  useHistoryUi,
  useReviewHistory,
} from "@/store/app-store";

/** HistoryButton is the way into the archived tasks, reviews and discussions, at the foot of the sidebar. */
export function HistoryButton() {
  const count = useHistory().length + useReviewHistory().length + useDiscussionHistory().length;
  const { historyOpen } = useHistoryUi();
  const openHistory = useAppStore((state) => state.openHistory);

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={historyOpen}
      onClick={() => openHistory()}
      className={cn(historyOpen && "bg-accent text-accent-foreground")}
    >
      <Archive />
      History
      {count > 0 && <Badge variant="secondary">{count}</Badge>}
    </Button>
  );
}
