import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskSummary } from "@/lib/wails";
import { asTaskStage } from "@/lib/wails";

export interface StageBadgeProps {
  task: TaskSummary;
}

export function StageBadge({ task }: StageBadgeProps) {
  if (asTaskStage(task.stage) !== "prd_done") {
    return <Badge variant="outline">PRD</Badge>;
  }
  return (
    <Badge variant="outline" className="text-[var(--status-success)]">
      <Check aria-hidden="true" />
      PRD done
    </Badge>
  );
}
