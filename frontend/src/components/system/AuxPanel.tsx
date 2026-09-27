import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import type { IconGlyph } from "./icons";
import { ScrollArea } from "./ScrollArea";
import { Tooltip } from "./Tooltip";

/** panelTriggerId is the id of the button that opens the panel id, where the focus returns when it closes. */
export function panelTriggerId(id: string): string {
  return `panel-trigger-${id}`;
}

export interface PanelGroupProps<Id extends string> {
  panels: readonly { id: Id; label: string; tooltip: string; icon: IconGlyph }[];
  open: Id | null;
  onOpenChange: (id: Id | null) => void;
}

/** PanelGroup is the toggling buttons of the panels of a place, in its header. */
export function PanelGroup<Id extends string>({ panels, open, onOpenChange }: PanelGroupProps<Id>) {
  return (
    <>
      {panels.map((panel) => (
        <Tooltip key={panel.id} content={panel.tooltip}>
          <Button
            id={panelTriggerId(panel.id)}
            variant="ghost"
            size="sm"
            pressed={open === panel.id}
            onClick={() => onOpenChange(open === panel.id ? null : panel.id)}
          >
            <Icon icon={panel.icon} />
            {/* Below 1440px of main area only the icon shows; the label still names the button. */}
            <span className="@max-[1440px]/main:sr-only">{panel.label}</span>
          </Button>
        </Tooltip>
      ))}
    </>
  );
}

export interface PanelLayoutProps {
  /** children is the reading column; panel the open panel, if any. */
  children: ReactNode;
  panel: ReactNode;
}

/** PanelLayout puts a panel beside the reading column from 1120px of main area, and over it below. */
export function PanelLayout({ children, panel }: PanelLayoutProps) {
  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-clip">{children}</div>
      {panel}
    </div>
  );
}

export interface AuxPanelProps {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** AuxPanel is an auxiliary panel: an aside with its title, the close button and a body that scrolls. */
export function AuxPanel({ id, title, onClose, children }: AuxPanelProps) {
  // Not modal: the focus moves freely between the panel and the column, and
  // Esc is the global shortcut's, in the order of the layers of the app.
  return (
    <aside aria-label={title} className="aux-panel flex flex-col">
      <div className="flex h-(--size-head) shrink-0 items-center justify-between gap-2 pr-2 pl-4 shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        <h2 className="truncate text-(length:--text-ui) font-semibold text-ink-1">{title}</h2>
        <IconButton
          icon={X}
          label="Close"
          shortcut="Esc"
          size="sm"
          onClick={() => {
            onClose();
            document.getElementById(panelTriggerId(id))?.focus();
          }}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1 text-(length:--text-meta)">{children}</ScrollArea>
    </aside>
  );
}
