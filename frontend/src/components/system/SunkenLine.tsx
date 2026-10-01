import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { IconGlyph } from "./icons";
import { StateGlyph } from "./StateGlyph";

export interface SunkenLineProps {
  /** icon is a muted icon, or the state glyph that says the line waits: blocked, or GitHub. */
  icon?: IconGlyph | "blocked" | "github";
  children: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}

/** SunkenLine is a quiet line sunk into the surface, like the reason an action waits. */
export function SunkenLine({ icon, children, action, id, className }: SunkenLineProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-sm bg-surface-0 py-2 pr-2 pl-3 text-(length:--text-meta) leading-(--leading-meta) text-ink-2",
        className,
      )}
    >
      {icon === "blocked" || icon === "github" ? (
        <StateGlyph state={icon} />
      ) : (
        icon !== undefined && <Icon icon={icon} size="sm" tone="muted" />
      )}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
