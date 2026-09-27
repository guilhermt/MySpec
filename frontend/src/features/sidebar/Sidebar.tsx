import { Plus } from "lucide-react";
import { useRef } from "react";
import { ScrollArea } from "@/components/system/ScrollArea";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HistoryButton } from "@/features/history/HistoryButton";
import { SettingsButton } from "@/features/settings/SettingsButton";
import { MissingClones } from "@/features/sidebar/MissingClones";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { ReviewsNode } from "@/features/sidebar/ReviewsNode";
import { emptyTreeText } from "@/features/sidebar/sidebar-tree";
import { Tree } from "@/features/sidebar/Tree";
import { useWidth } from "@/features/sidebar/useFits";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useAppStore, useRepositoryFilter } from "@/store/app-store";

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
  const app = useAppStore((state) => state.app);
  const filter = useRepositoryFilter();
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  // Before a first measure the sidebar counts as wide.
  const narrow = width > 0 && width < NARROW_PX;
  const empty = app === null ? null : emptyTreeText(app, filter);

  return (
    <div
      ref={ref}
      className="flex h-dvh min-w-0 flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      <ReviewsNode />
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-1">
        <RepositoryFilter variant="sidebar" className="min-w-0 flex-1" />
        <NewTaskButton />
      </div>
      <MissingClones />
      <ScrollArea className="min-h-0 flex-1">
        {empty !== null && (
          <p className="px-(--tree-pad) pt-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            {empty}
          </p>
        )}
        <Tree narrow={narrow} />
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
