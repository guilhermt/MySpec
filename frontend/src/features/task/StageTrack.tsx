import { Check, ChevronRight, RotateCcw } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StageActionDialog } from "@/features/task/StageActionDialog";
import { nextStage, stageNoun } from "@/features/task/stage-actions";
import { menuItems, type StageMenuItem } from "@/features/task/task-menu";
import {
  type LifecycleStage,
  lifecycleOf,
  type StageState,
  stageLabel,
  stageState,
} from "@/lib/stages";
import { cn } from "@/lib/utils";
import { asTaskMode, asTaskStage, type TaskSummary } from "@/lib/wails";
import { continueStage } from "@/store/actions";

const CHIP = "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs";

const TONE: Record<StageState, string> = {
  done: "text-[var(--status-success)]",
  current: "bg-accent font-medium text-accent-foreground",
  upcoming: "text-muted-foreground",
};

interface StageChipProps {
  id: LifecycleStage;
  state: StageState;
  /** revisiting marks the current stage as reopened rather than first-time. */
  revisiting: boolean;
  items: StageMenuItem[];
  onSelect: (item: StageMenuItem) => void;
}

/** StageChip is one stage of the lifecycle, with its controls when it has any. */
function StageChip({ id, state, revisiting, items, onSelect }: StageChipProps) {
  const reopened = state === "current" && revisiting;
  const body = (
    <>
      {state === "done" && <Check aria-hidden="true" className="size-3" />}
      {reopened && <RotateCcw aria-hidden="true" className="size-3" />}
      {reopened ? `${stageLabel(id)} · revisiting` : stageLabel(id)}
    </>
  );

  if (items.length === 0) {
    return <span className={cn(CHIP, TONE[state])}>{body}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-haspopup="menu"
        className={cn(
          CHIP,
          TONE[state],
          "transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
      >
        {body}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-44">
        {items.map((item) => (
          <DropdownMenuItem key={item.action} onClick={() => onSelect(item)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * ContinueButton moves a reopened stage on. Only the user closes a revisit, so
 * the button waits for the agent to be done and the document to be there.
 */
function ContinueButton({ task }: { task: TaskSummary }) {
  const button = (
    <Button size="sm" disabled={!task.canContinue} onClick={() => void continueStage(task.id)}>
      {`Continue to ${stageNoun(nextStage(asTaskStage(task.stage)))}`}
    </Button>
  );

  if (task.canContinue) {
    return button;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{button}</TooltipTrigger>
      <TooltipContent>Wait for the agent to finish and the document to be written.</TooltipContent>
    </Tooltip>
  );
}

export interface StageTrackProps {
  task: TaskSummary;
}

/** StageTrack shows how far the task got, and holds the controls over stages. */
export function StageTrack({ task }: StageTrackProps) {
  const [pending, setPending] = useState<StageMenuItem | null>(null);
  const mode = asTaskMode(task.mode);
  const current = asTaskStage(task.stage);

  return (
    <div className="flex h-9 shrink-0 items-center border-b px-3">
      {lifecycleOf(mode).map((id, index) => (
        <Fragment key={id}>
          {index > 0 && (
            <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/60" />
          )}
          <StageChip
            id={id}
            state={stageState(task, id)}
            revisiting={task.revisiting}
            items={menuItems(mode, current, id)}
            onSelect={setPending}
          />
        </Fragment>
      ))}

      {task.revisiting && (
        <div className="ml-auto shrink-0 pl-2">
          <ContinueButton task={task} />
        </div>
      )}

      {pending !== null && (
        <StageActionDialog
          task={task}
          action={pending.action}
          stage={pending.stage}
          open
          onOpenChange={(open) => {
            if (!open) {
              setPending(null);
            }
          }}
        />
      )}
    </div>
  );
}
