import { useEffect } from "react";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tabs } from "@/components/system/Tabs";
import type { AgentTabModel } from "@/features/task/agent-tabs";
import { asSituationGroup, type TaskSummary } from "@/lib/wails";
import { type StepTab, stepTabKey, useAppStore, useFlashing } from "@/store/app-store";

/** AGENT_CONVERSATION is the id of the conversation the tabs switch. */
export const AGENT_CONVERSATION = "agent-conversation";

/**
 * useStoredFirstTab stores the first tab of a slot once it has grounds to be picked: from then on
 * the product never moves between the tabs on its own. Before that, and without a situation on
 * either side, the first tab is only a guess to have something to display, and it waits, unstored.
 */
export function useStoredFirstTab(taskId: string, slot: number, decided: boolean, first: StepTab) {
  const stored = useAppStore((state) => state.openStepTab[stepTabKey(taskId, slot)] !== undefined);
  const selectStepTab = useAppStore((state) => state.selectStepTab);
  useEffect(() => {
    if (decided && !stored) {
      selectStepTab(taskId, slot, first);
    }
  }, [decided, stored, selectStepTab, taskId, slot, first]);
}

export interface AgentTabsProps {
  task: TaskSummary;
  tabs: AgentTabModel[];
  chosen: StepTab;
  onSelect: (tab: StepTab) => void;
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
 * AgentTabs switches a conversation between the agent that implements and the one that reviews:
 * in a step, from the first review pass to the commit; in the pull request, from the reviewer's
 * conversation on.
 */
export function AgentTabs({ task, tabs, chosen, onSelect }: AgentTabsProps) {
  const flashing = useFlashing();
  return (
    <Tabs
      label="Conversations"
      controls={AGENT_CONVERSATION}
      value={chosen}
      onValueChange={onSelect}
      items={tabs.map((tab) => ({
        id: tab.tab,
        label: tab.name,
        glyph: tab.glyph !== null && <StateGlyph state={tab.glyph} size="sm" />,
        ...(tab.word !== ""
          ? { word: { text: tab.word, tone: tab.word === "error" ? "error" : "wait" } as const }
          : {}),
        disabled: tab.disabled,
        ...(tab.disabled ? { disabledLabel: tab.disabledLabel } : {}),
        accessibleName: tab.label,
        tooltip: tab.label,
        flash: tab.tab === chosen ? null : flashOf(tab, task, flashing),
      }))}
    />
  );
}
