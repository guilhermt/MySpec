import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";
import { ScrollArea } from "./ScrollArea";
import { Tooltip } from "./Tooltip";

/**
 * LIST_PANEL_COLUMN_MIN is the width of main area, in px, from which the panel of a list stands beside
 * the list instead of covering it, where the list keeps 440px: the mirror of the container query of
 * .list-panel in globals.css.
 */
export const LIST_PANEL_COLUMN_MIN = 800;

/** LIST_COLUMN is the reading column of a list: --list-measure on whole pixels, with --space-6 at each side at least. */
export const LIST_COLUMN =
  "mx-auto w-[min(round(down,var(--list-measure),1px),100%-2*var(--space-6))] pb-(--space-12)";

export interface ListPanelProps {
  /** label names the panel: "Card #474". */
  label: string;
  number: string;
  repository: string;
  url: string;
  onOpenExternal: (url: string) => void;
  onClose: () => void;
  /** scrollKey resets the body's scroll to the top when it changes: another card. */
  scrollKey: string;
  /** openShortcut is the key of Open on GitHub, in its tooltip: "O". */
  openShortcut?: string;
  children: ReactNode;
}

/**
 * ListPanel is the panel of the item a list has open: its reference with the way to GitHub and to
 * close it, over a body that scrolls. It goes in a PanelLayout, which keeps it for its exit.
 */
export function ListPanel({
  label,
  number,
  repository,
  url,
  onOpenExternal,
  onClose,
  scrollKey,
  openShortcut,
  children,
}: ListPanelProps) {
  const viewport = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: another item starts its body at the top
  useEffect(() => {
    viewport.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  return (
    <aside aria-label={label} className="list-panel flex flex-col">
      {/* The line under the head is drawn inside it, as in AuxPanel, to keep it on whole pixels. */}
      <div className="flex h-(--size-head) shrink-0 items-center gap-(--space-2) pr-(--space-2) pl-(--space-4) shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        <span className="min-w-0 flex-1 truncate text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          <span className="font-mono">{number}</span>
          {` · ${repository}`}
        </span>
        {/* The button is named for the card and the tooltip says the way, so it is a Button, not an IconButton. */}
        <Tooltip
          content="Open on GitHub"
          {...(openShortcut !== undefined ? { shortcut: openShortcut } : {})}
        >
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Open ${number} on GitHub`}
            className="w-(--size-control-sm) px-0"
            onClick={() => onOpenExternal(url)}
          >
            <Icon icon={ICONS.external} />
          </Button>
        </Tooltip>
        <IconButton icon={ICONS.close} label="Close" shortcut="Esc" size="sm" onClick={onClose} />
      </div>
      <ScrollArea
        viewportRef={viewport}
        className="min-h-0 flex-1 text-(length:--text-meta) leading-(--leading-meta)"
      >
        {children}
      </ScrollArea>
    </aside>
  );
}
