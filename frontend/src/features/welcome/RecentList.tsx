import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayPath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { Recent } from "@/lib/wails";
import { openPath, removeRecent } from "@/store/actions";

export interface RecentItemProps {
  recent: Recent;
  /** Menu rows live inside the switcher popover and carry menu semantics. */
  menu?: boolean;
  onOpen?: () => void;
}

export function RecentItem({ recent, menu = false, onOpen }: RecentItemProps) {
  const Row = menu ? "div" : "li";
  // Only the open action joins the menu ring; the remove button is reached with Tab.
  const itemRole = menu ? "menuitem" : undefined;

  return (
    <Row
      role={menu ? "none" : undefined}
      className="group flex h-10 items-center gap-1 rounded-md pr-1 transition-colors duration-[var(--duration-fast)] hover:bg-accent"
    >
      <button
        type="button"
        role={itemRole}
        onClick={() => {
          onOpen?.();
          void openPath(recent.path);
        }}
        className="flex h-full min-w-0 flex-1 items-baseline gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="shrink-0 font-medium">{recent.name}</span>{" "}
        <span className="truncate font-mono text-xs text-muted-foreground group-hover:text-foreground">
          {displayPath(recent.path)}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${recent.name} from recent workspaces`}
        onClick={() => void removeRecent(recent.path)}
        className={cn(
          "transition-opacity duration-[var(--duration-fast)] focus-visible:opacity-100",
          menu ? "opacity-60 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <X />
      </Button>
    </Row>
  );
}

export interface RecentListProps {
  recents: readonly Recent[];
}

export function RecentList({ recents }: RecentListProps) {
  return (
    <ul className="flex flex-col">
      {recents.map((recent) => (
        <RecentItem key={recent.path} recent={recent} />
      ))}
    </ul>
  );
}
