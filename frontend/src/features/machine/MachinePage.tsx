import { MachineChecks } from "@/components/system/MachineChecks";
import { Shimmer } from "@/components/system/Shimmer";
import { CheckAgainButton } from "@/features/machine/CheckAgainButton";
import { CLAUDE_ITEMS, GH_ITEMS, itemViews } from "@/features/machine/machine";
import { SettingsBlock, SettingsPage } from "@/features/settings/SettingsPage";
import { useMachine } from "@/store/app-store";

/** MachinePage is Settings › Machine: what MySpec needs of the machine, item by item, with Check again. */
export function MachinePage() {
  const machine = useMachine();
  return (
    <SettingsPage
      title="Machine"
      sentence="What MySpec needs on this machine: Claude Code and the GitHub CLI. Fix what's missing in a terminal, then check again."
      action={<CheckAgainButton />}
    >
      {machine.checked ? (
        <>
          <SettingsBlock title="Claude Code">
            <MachineChecks items={itemViews(machine, CLAUDE_ITEMS)} />
          </SettingsBlock>
          <SettingsBlock title="GitHub CLI">
            <MachineChecks items={itemViews(machine, GH_ITEMS)} />
          </SettingsBlock>
        </>
      ) : (
        <Shimmer>Checking this machine…</Shimmer>
      )}
    </SettingsPage>
  );
}
