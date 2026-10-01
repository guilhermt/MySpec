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
 * go from here. The first action that can run is the primary one and holds the focus.
 */
export function GonePage({ icon, title, description, children, actions }: GonePageProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const primary = actions.findIndex((action) => action.disabledReason === undefined);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div className="flex max-w-(--measure-read) flex-col items-start gap-4 px-(--space-8) pt-(--space-12)">
      <Icon icon={icon} tone="muted" size="md" />
      <p className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
        {title}
      </p>
      {description !== undefined && (
        <p className="max-w-(--measure-read) text-(length:--text-body) leading-(--leading-body) text-ink-2">
          {description}
        </p>
      )}
      {children}
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action, index) => {
          const button = (
            <Button
              key={action.label}
              ref={index === primary ? primaryRef : undefined}
              variant={index === primary ? "primary" : "secondary"}
              onClick={action.onClick}
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
