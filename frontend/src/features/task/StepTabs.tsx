import type { SessionState } from "@/features/chat/session";
import { ToneDot } from "@/features/task/StatusDot";
import { conversationDisplay } from "@/features/task/step-status";
import { reviewerSituation, situationLabel, situationTone, stepSituation } from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { Situation, Step, TaskSummary } from "@/lib/wails";
import { useAppStore, useFlashing, useOpenStepTab } from "@/store/app-store";

export interface StepTabsProps {
  task: TaskSummary;
  step: Step;
}

/**
 * StepTabs switches the conversation of a step between the agent that
 * implements it and the one that reviews it. It shows once the step has a
 * reviewer, and stays for as long as that conversation exists.
 */
export function StepTabs({ task, step }: StepTabsProps) {
  const openTab = useOpenStepTab(task.id);
  const selectStepTab = useAppStore((state) => state.selectStepTab);

  if (step.reviewer === null) {
    return null;
  }

  // The app never moves between the tabs on its own: only a click, or opening a
  // situation, changes the one on screen.
  return (
    <div
      role="tablist"
      aria-label="Conversations"
      className="flex h-9 shrink-0 items-center border-b px-2"
    >
      <Tab
        name="Implementer"
        session={task}
        situation={stepSituation(task, step.number)}
        selected={openTab === "implementer"}
        onSelect={() => selectStepTab(task.id, step.number, "implementer")}
      />
      <Tab
        name="Reviewer"
        session={step.reviewer}
        situation={reviewerSituation(task, step.number)}
        selected={openTab === "reviewer"}
        onSelect={() => selectStepTab(task.id, step.number, "reviewer")}
      />
    </div>
  );
}

interface TabProps {
  name: string;
  session: SessionState;
  situation: Situation | null;
  selected: boolean;
  onSelect: () => void;
}

function Tab({ name, session, situation, selected, onSelect }: TabProps) {
  const flashing = useFlashing();
  const display = conversationDisplay(session);
  // What waits on the user takes the colour of its situation; without one, the
  // tab shows what the conversation is doing.
  const tone = situation !== null ? situationTone(situation) : display.tone;
  // A new situation draws the eye to a tab the user is not on; the selected
  // one is already in front of them.
  const flash = !selected && situation !== null && flashing.has(situation.id);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      data-tone={flash ? tone : undefined}
      className={cn(
        "flex h-9 min-w-0 items-center gap-1.5 border-b-2 px-2 text-sm transition-colors",
        selected
          ? "border-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground",
        flash && "attention-flash",
      )}
    >
      <ToneDot tone={tone} />
      <span className="truncate">{name}</span>
      {/* The space keeps the accessible name of the tab readable. */}{" "}
      {situation !== null ? (
        <span className="truncate text-xs text-muted-foreground">{situationLabel(situation)}</span>
      ) : (
        <span className="sr-only">{display.label}</span>
      )}
    </button>
  );
}
