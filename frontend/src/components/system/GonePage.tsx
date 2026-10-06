import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { IconGlyph } from "./icons";
import { Tooltip } from "./Tooltip";

/** GoneAction is one way out of the page of an item that left. */
export interface GoneAction {
  label: string;
  onClick: () => void;
  tooltip?: string;
  /** shortcut is the key of the action, Ctrl+J: written on the button as Ctrl J, and named in the tooltip. */
  shortcut?: string;
  /** disabledReason disables the action and says why. */
  disabledReason?: string;
}

export interface GonePageProps {
  icon: IconGlyph;
  title: string;
  /** description is the paragraph after the title: what happened, in a sentence or two. */
  description?: string;
  /** children is the block between the text and the actions, drawn by the caller. */
  children?: ReactNode;
  /** actions are in their order; the first enabled one is the primary and takes the focus when the page appears. */
  actions: readonly GoneAction[];
}

/**
 * GonePage stands in the place of an item that left while open: what became of it and where to
 * go from here. The first action that can run is the primary one and holds the focus. The blocks
 * take the whole reading measure, whatever their lines hold.
 */
export function GonePage({ icon, title, description, children, actions }: GonePageProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const primary = actions.findIndex((action) => action.disabledReason === undefined);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div className="flex max-w-(--measure-read) flex-col gap-(--space-4) px-(--space-6) pt-(--space-12)">
      <Icon icon={icon} tone="muted" size="md" className="self-start" />
      <p className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
        {title}
      </p>
      {description !== undefined && (
        <p className="max-w-(--measure-read) text-(length:--text-body) leading-(--leading-body) text-ink-2">
          {description}
        </p>
      )}
      {children}
      <div className="flex flex-wrap items-center gap-(--space-2)">
        {actions.map((action, index) => {
          const button = (
            <Button
              key={action.label}
              ref={index === primary ? primaryRef : undefined}
              variant={index === primary ? "primary" : "secondary"}
              onClick={action.onClick}
              {...(action.shortcut !== undefined ? { shortcut: keyOf(action.shortcut) } : {})}
              {...(action.disabledReason !== undefined
                ? { disabled: true, disabledReason: action.disabledReason }
                : {})}
            >
              {action.label}
            </Button>
          );
          return action.tooltip === undefined ? (
            button
          ) : (
            <Tooltip
              key={action.label}
              content={action.tooltip}
              {...(action.shortcut !== undefined ? { shortcut: action.shortcut } : {})}
            >
              {button}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// keyOf is a shortcut as the button writes it, the keys apart: Ctrl+J is Ctrl J.
function keyOf(shortcut: string): string {
  return shortcut.replaceAll("+", " ");
}
