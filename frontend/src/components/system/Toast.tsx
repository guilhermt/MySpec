import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import type { IconGlyph } from "./icons";

/** TOAST_MS is how long a toast stays, counted while it has neither the pointer nor the focus. */
export const TOAST_MS = 10_000;

export interface ToastProps {
  icon: IconGlyph;
  text: string;
  action: { label: string; onClick: () => void };
  onDismiss: () => void;
  /** duration is how long the toast stays, counted only while it has neither the pointer nor the focus. */
  duration?: number;
}

/**
 * Toast is a short notice in the live region of the shell, with one action under its text. It
 * leaves on its own once its time runs out; the pointer or the focus on it hold the time, which
 * goes on with what was left when both are gone.
 */
export function Toast({ icon, text, action, onDismiss, duration = TOAST_MS }: ToastProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const left = useRef(duration);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const held = hovered || focused;

  useEffect(() => {
    if (held) {
      return;
    }
    const started = Date.now();
    const timer = setTimeout(() => dismiss.current(), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [held]);

  return (
    <div
      className="toast flex w-(--size-toast) max-w-full items-start gap-2.5 rounded-lg bg-surface-3 py-2.5 pr-2 pl-3 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-(--shadow-float)"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        // The focus moving between the parts of the toast does not let the time go on.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <span className="inline-grid h-(--leading-ui) place-items-center">
        <Icon icon={icon} tone="muted" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <p className="min-w-0 break-words">{text}</p>
        <Button variant="ghost" size="sm" className="-ml-2.5" onClick={action.onClick}>
          {action.label}
        </Button>
      </div>
      <IconButton icon={X} label="Dismiss" size="sm" onClick={onDismiss} />
    </div>
  );
}
