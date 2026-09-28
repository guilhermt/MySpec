import { useEffect } from "react";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tabs } from "@/components/system/Tabs";
import { useNow } from "@/features/attention/useNow";
import { type AgentTabModel, agentTabsOf, firstTab } from "@/features/task/agent-tabs";
import { asSituationGroup, type Step, type TaskSummary } from "@/lib/wails";
import { stepTabKey, useAppStore, useFlashing, useOpenStepTab } from "@/store/app-store";
import { firstTabDecided } from "@/store/step-tab";

const MINUTE = 60_000;

/** AGENT_CONVERSATION is the id of the conversation the tabs switch. */
export const AGENT_CONVERSATION = "agent-conversation";

export interface AgentTabsProps {
  task: TaskSummary;
  step: Step;
}

// The flash takes the veil of the gravity of the situation of the tab.
function flashOf(tab: AgentTabModel, task: TaskSummary, flashing: ReadonlySet<string>) {
  if (tab.situationId === null || !flashing.has(tab.situationId)) {
    return null;
  }
  const situation = (task.situations ?? []).find((candidate) => candidate.id === tab.situationId);
  return situation !== undefined && asSituationGroup(situation.group) === "error"
    ? "error"
    : "wait";
}

/**
 * AgentTabs switches the conversation of a step between the agent that implements it and the one
 * that reviews it, from the first review pass to the commit.
 */
export function AgentTabs({ task, step }: AgentTabsProps) {
  const chosen = useOpenStepTab(task.id);
  const stored = useAppStore(
    (state) => state.openStepTab[stepTabKey(task.id, step.number)] !== undefined,
  );
  const selectStepTab = useAppStore((state) => state.selectStepTab);
  const flashing = useFlashing();
  const now = useNow(MINUTE, true);
  const tabs = agentTabsOf(task, step, chosen, now);
  const shown = tabs !== null;

  // The first opening stores the choice, and from then on the product never moves between the
  // tabs on its own. Before the reviewer's session starts and without a situation on either side,
  // firstTab only guesses "implementer" to have something to display; that guess waits, unstored,
  // until firstTab has real grounds to decide.
  useEffect(() => {
    if (shown && !stored && firstTabDecided(task, step)) {
      selectStepTab(task.id, step.number, firstTab(task, step));
    }
  }, [shown, stored, selectStepTab, task, step]);

  if (tabs === null) {
    return null;
  }

  return (
    <Tabs
      label="Conversations"
      controls={AGENT_CONVERSATION}
      value={chosen}
      onValueChange={(tab) => selectStepTab(task.id, step.number, tab)}
      items={tabs.map((tab) => ({
        id: tab.tab,
        label: tab.name,
        glyph: tab.glyph !== null && <StateGlyph state={tab.glyph} size="sm" />,
        ...(tab.word !== ""
          ? { word: { text: tab.word, tone: tab.word === "error" ? "error" : "wait" } as const }
          : {}),
        disabled: tab.disabled,
        ...(tab.disabled ? { disabledLabel: "starts with pass 1" } : {}),
        accessibleName: tab.label,
        tooltip: tab.label,
        flash: tab.tab === chosen ? null : flashOf(tab, task, flashing),
      }))}
    />
  );
}
