import { Plus } from "lucide-react";
import { useRef } from "react";
import { ScrollArea } from "@/components/system/ScrollArea";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HistoryButton } from "@/features/history/HistoryButton";
import { SettingsButton } from "@/features/settings/SettingsButton";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { Tree } from "@/features/sidebar/Tree";
import { useWidth } from "@/features/sidebar/useFits";
import { useRevealOpenItem } from "@/features/sidebar/useRevealOpenItem";
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

/** NARROW_PX is the width under which the rows of the tree take their short forms. */
const NARROW_PX = 330;

export function Sidebar() {
  const ref = useRef<HTMLElement>(null);
  const width = useWidth(ref);
  // Before a first measure the sidebar counts as wide.
  const narrow = width > 0 && width < NARROW_PX;
  useRevealOpenItem();

  return (
    <aside
      ref={ref}
      aria-label="Work"
      className="flex h-dvh min-w-0 flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-1">
        <RepositoryFilter variant="sidebar" className="min-w-0 flex-1" />
        <NewTaskButton />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Tree narrow={narrow} />
      </ScrollArea>
      <div className="flex h-11 shrink-0 items-center gap-2 border-t px-2">
        <HistoryButton />
        <div className="ml-auto flex items-center gap-1">
          <SettingsButton />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
