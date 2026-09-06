import { ChevronsUpDown, FolderOpen } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { RecentItem } from "@/features/welcome/RecentList";
import { openFolderDialog } from "@/store/actions";
import { useRecents, useWorkspace } from "@/store/app-store";

const MENU_ITEM = '[role="menuitem"]';

export function WorkspaceSwitcher() {
  const workspace = useWorkspace();
  const recents = useRecents();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  if (workspace === null) {
    return null;
  }

  const others = recents.filter((recent) => recent.path !== workspace.path);

  // The popover is not a menu widget, so the arrow keys are wired by hand over
  // the items it holds.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM) ?? []);
    if (items.length === 0) {
      return;
    }
    event.preventDefault();
    const active = document.activeElement;
    const current = active instanceof HTMLElement ? items.indexOf(active) : -1;
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = current === -1 ? (step === 1 ? 0 : items.length - 1) : current + step;
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            aria-label={`Switch workspace: ${workspace.name}`}
            className="h-full w-full justify-start gap-2 rounded-none px-3"
          />
        }
      >
        <FolderOpen className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">{workspace.name}</span>
        <ChevronsUpDown className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-1">
        <div role="menu" ref={menuRef} onKeyDown={onKeyDown} className="flex flex-col">
          {others.length === 0 ? (
            <p className="px-2 py-2 text-muted-foreground">No other recent workspaces</p>
          ) : (
            others.map((recent) => (
              <RecentItem key={recent.path} recent={recent} menu onOpen={() => setOpen(false)} />
            ))
          )}
          <Separator className="my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void openFolderDialog();
            }}
            className="flex h-10 items-center justify-between gap-2 rounded-md px-2 text-left outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            Open folder…
            <Kbd>Ctrl O</Kbd>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
