import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { ICONS, type IconGlyph } from "./icons";
import { PanelResizer } from "./PanelResizer";
import { Presence } from "./Presence";
import {
  type PanelFamily,
  type PanelGeometry,
  panelGeometry,
  useAdjustedPanelWidth,
} from "./panel-width";
import { ScrollArea } from "./ScrollArea";
import { Tooltip } from "./Tooltip";

/** PanelAreaContext is the width of the PanelLayout a panel is in, which its geometry is worked out from. */
const PanelAreaContext = createContext(0);

/** usePanelGeometry is the geometry of a panel of a family in the PanelLayout it is in. */
export function usePanelGeometry(family: PanelFamily): PanelGeometry {
  return panelGeometry(family, useContext(PanelAreaContext), useAdjustedPanelWidth());
}

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
        // Below 1440px of main area only the icon shows, on a square button: the tooltip names the panel first.
        <Tooltip key={panel.id} content={panel.label} sub={panel.tooltip}>
          <Button
            id={panelTriggerId(panel.id)}
            variant="ghost"
            size="sm"
            pressed={open === panel.id}
            className="@max-[1440px]/main:w-(--size-control-sm) @max-[1440px]/main:px-0"
            onClick={() => onOpenChange(open === panel.id ? null : panel.id)}
          >
            <Icon icon={panel.icon} />
            {/* Hidden below 1440px of main area, the label still names the button. */}
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

/**
 * PanelLayout puts a panel beside the reading column while the column keeps the room of the panel's
 * family, and over it otherwise. It measures its width, which the panel works out its own from.
 * A panel that closes stays for its exit.
 */
export function PanelLayout({ children, panel }: PanelLayoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState(0);
  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) {
      return;
    }
    setArea(element.clientWidth);
    const observer = new ResizeObserver(() => setArea(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-clip">{children}</div>
      <PanelAreaContext value={area}>
        <Presence>{panel}</Presence>
      </PanelAreaContext>
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
  const geometry = usePanelGeometry("item");
  return (
    <aside
      aria-label={title}
      style={{ width: geometry.width }}
      data-beside={geometry.beside ? "" : undefined}
      className="aux-panel flex shrink-0 flex-col"
    >
      <PanelResizer geometry={geometry} />
      {/* The line under the head is drawn inside it, as in the place header, to keep it on whole pixels. */}
      <div className="flex h-(--size-head) shrink-0 items-center justify-between gap-(--space-2) pr-(--space-2) pl-(--space-4) shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        <h2 className="truncate text-(length:--text-ui) leading-(--leading-ui) font-semibold text-ink-1">
          {title}
        </h2>
        <IconButton
          icon={ICONS.close}
          label="Close"
          shortcut="Esc"
          size="sm"
          onClick={() => {
            onClose();
            document.getElementById(panelTriggerId(id))?.focus();
          }}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1 text-(length:--text-meta) leading-(--leading-meta)">
        {children}
      </ScrollArea>
    </aside>
  );
}
