import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore, useHistory, useHistoryUi } from "@/store/app-store";

/** HistoryButton is the way into the archived tasks, at the foot of the sidebar. */
export function HistoryButton() {
  const history = useHistory();
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
      {history.length > 0 && <Badge variant="secondary">{history.length}</Badge>}
    </Button>
  );
}
