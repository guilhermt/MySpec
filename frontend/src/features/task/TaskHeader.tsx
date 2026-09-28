import { useState } from "react";
import { PauseButton } from "@/components/PauseButton";
import { PanelGroup } from "@/components/system/AuxPanel";
import { ContextMeter } from "@/components/system/ContextMeter";
import { ICONS } from "@/components/system/icons";
import type { PillView } from "@/components/system/Pill";
import { Stepper } from "@/components/system/Stepper";
import { useNow } from "@/features/attention/useNow";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { loadingSteps, stepperOf } from "@/features/task/stepper";
import { TaskMenu } from "@/features/task/TaskMenu";
import {
  contextDetail,
  isPaused,
  pauseRefusal,
  screenSession,
  waitingSession,
} from "@/features/task/task-session";
import { asSessionStatus, asTaskMode, type TaskCard, type TaskSummary } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { pause, resume } from "@/store/actions";
import { useAppStore, useEarlierConversation, useOpenStepTab, usePanel } from "@/store/app-store";

export interface TaskHeaderProps {
  /** task is null in the instant before the first snapshot that brings a new task. */
  task: TaskSummary | null;
}

/** LOADING_STEPS are the stages the loading stepper glows over: the Structured ones a new task starts with. */
const LOADING_STEPS = loadingSteps();

/** LOADING_PILL fills the pill of the loading stepper, which draws none. */
const LOADING_PILL: PillView = {
  name: "",
  position: "",
  qualifier: "",
  keepsQualifier: false,
  glyph: null,
  word: "",
  shimmer: false,
  paused: false,
  state: "",
};

/** STRUCTURED_PANELS are the panels of a Structured task, in their order, each with what it shows. */
const STRUCTURED_PANELS = [
  {
    id: "details",
    label: "Details",
    tooltip: "Steps, earlier conversations, reports and the facts of the task",
    icon: ICONS.details,
  },
  {
    id: "artifacts",
    label: "Artifacts",
    tooltip: "PRD, tech spec, step files and the pull request draft",
    icon: ICONS.file,
  },
] as const;

/** ONE_SHOT_PANELS are the panels of a One-Shot task, which has no steps nor PRD. */
const ONE_SHOT_PANELS = [
  {
    id: "details",
    label: "Details",
    tooltip: "Earlier conversations, reports and the facts of the task",
    icon: ICONS.details,
  },
  {
    id: "artifacts",
    label: "Artifacts",
    tooltip: "The One-Shot document and the pull request draft",
    icon: ICONS.file,
  },
] as const;

/** cardPanel is the panel of the card a task was created from, which only such a task has. */
function cardPanel(card: TaskCard) {
  return {
    id: "card",
    label: "Card",
    tooltip: `The card ${card.repository}#${card.number} on the board`,
    icon: ICONS.card,
  } as const;
}

/**
 * TaskHeader is the header of the place of a task: the title, the stepper, and on the right the
 * context meter, Pause or Resume, the panels and the ⋯. Before the first snapshot of a new task it
 * has the empty title and the loading stepper, and nothing on the right.
 */
export function TaskHeader({ task }: TaskHeaderProps) {
  const now = useNow(60_000, task !== null);
  if (task === null) {
    return (
      <LocationHeader
        progress={
          <Stepper
            steps={LOADING_STEPS}
            pill={LOADING_PILL}
            label="Progress"
            tooltip={[LOADING_STEPS.map((step) => `○ ${step.name}`).join("  ")]}
            loading
          />
        }
      />
    );
  }
  const stepper = stepperOf(task, now);
  return (
    <LocationHeader
      progress={
        <Stepper
          steps={stepper.steps}
          pill={stepper.pill}
          label={stepper.label}
          tooltip={stepper.tooltip}
        />
      }
    >
      <TaskTools task={task} now={now} />
    </LocationHeader>
  );
}

/** TaskTools is the right of the header of a task, in its order. */
function TaskTools({ task, now }: { task: TaskSummary; now: number }) {
  const tab = useOpenStepTab(task.id);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);
  const earlier = useEarlierConversation(task.id);
  const panels = asTaskMode(task.mode) === "one_shot" ? ONE_SHOT_PANELS : STRUCTURED_PANELS;
  // An earlier conversation on screen is not the one the meter measures, so it steps aside.
  const onScreen = earlier === null ? screenSession(task, tab) : null;

  return (
    <>
      {onScreen !== null && (
        <ContextMeter
          percent={onScreen.contextPercent === 0 ? null : onScreen.contextPercent}
          paused={asSessionStatus(onScreen.sessionStatus) === "paused"}
          compact="narrow"
          detail={contextDetail(onScreen)}
        />
      )}
      <TaskPause task={task} now={now} />
      <PanelGroup
        panels={task.card === null ? panels : [...panels, cardPanel(task.card)]}
        open={panel}
        onOpenChange={openPanel}
      />
      <TaskMenu task={task} />
    </>
  );
}

/**
 * TaskPause pauses or resumes the conversation the task waits on, with no dialog: Pausing… until the
 * call comes back.
 */
function TaskPause({ task, now }: { task: TaskSummary; now: number }) {
  const [loading, setLoading] = useState(false);
  const session = waitingSession(task);
  if (session === null) {
    return null;
  }
  const paused = isPaused(task);
  const refusal = paused ? null : pauseRefusal(task, session);

  const act = async () => {
    setLoading(true);
    try {
      await (paused ? resume(task.id, session.stage) : pause(task.id, session.stage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PauseButton
      paused={paused}
      loading={loading}
      {...(refusal !== null ? { disabledReason: refusal } : {})}
      pausedSince={session.pausedAt === "" ? "" : clockTime(session.pausedAt, now)}
      item="the task"
      onClick={() => void act()}
    />
  );
}
