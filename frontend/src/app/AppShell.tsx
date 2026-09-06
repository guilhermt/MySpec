import { NodePanel } from "@/features/node-panel/NodePanel";
import { Sidebar } from "@/features/workspace/Sidebar";

export function AppShell() {
  return (
    <div className="grid h-dvh grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <Sidebar />
      <NodePanel />
    </div>
  );
}
