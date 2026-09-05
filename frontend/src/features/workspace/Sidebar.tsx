import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { WorkspaceTree } from "@/features/tree/WorkspaceTree";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";

export function Sidebar() {
  return (
    <div className="flex h-dvh min-w-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="h-11 shrink-0 border-b">
        <WorkspaceSwitcher />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <WorkspaceTree />
      </ScrollArea>
      <div className="flex h-11 shrink-0 items-center border-t px-2">
        <ThemeToggle />
      </div>
    </div>
  );
}
