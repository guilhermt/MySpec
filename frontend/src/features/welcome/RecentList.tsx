import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayPath } from "@/lib/paths";
import type { Recent } from "@/lib/wails";
import { openPath, removeRecent } from "@/store/actions";

export interface RecentListProps {
  recents: readonly Recent[];
}

export function RecentList({ recents }: RecentListProps) {
  return (
    <ul className="flex flex-col">
      {recents.map((recent) => (
        <li
          key={recent.path}
          className="group flex h-10 items-center gap-1 rounded-md pr-1 transition-colors duration-[var(--duration-fast)] hover:bg-accent"
        >
          <button
            type="button"
            onClick={() => void openPath(recent.path)}
            className="flex h-full min-w-0 flex-1 items-baseline gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <span className="shrink-0 font-medium">{recent.name}</span>{" "}
            <span className="truncate font-mono text-xs text-muted-foreground">
              {displayPath(recent.path)}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${recent.name} from recent workspaces`}
            onClick={() => void removeRecent(recent.path)}
            className="opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
