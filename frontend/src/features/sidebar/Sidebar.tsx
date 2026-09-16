import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WaitingSection } from "@/features/attention/WaitingSection";
import { HistoryButton } from "@/features/history/HistoryButton";
import { SettingsButton } from "@/features/settings/SettingsButton";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { TaskList } from "@/features/sidebar/TaskList";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useAppStore } from "@/store/app-store";

/** NewTaskButton opens the creation dialog, from wherever the app is. */
function NewTaskButton() {
  const openNewTask = useAppStore((state) => state.openNewTask);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label="New task"
        onClick={() => openNewTask()}
      >
        <Plus aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>
        New task <Kbd>Ctrl N</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  return (
    <div className="flex h-dvh min-w-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <WaitingSection />
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-1">
        <RepositoryFilter variant="sidebar" className="min-w-0 flex-1" />
        <NewTaskButton />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <TaskList />
      </ScrollArea>
      <div className="flex h-11 shrink-0 items-center gap-2 border-t px-2">
        <HistoryButton />
        <div className="ml-auto flex items-center gap-1">
          <SettingsButton />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
