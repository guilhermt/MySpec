import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import type { IconGlyph } from "./icons";
import { whenExitEnds } from "./Presence";

/** TOAST_MS is how long a toast stays, counted while it has neither the pointer nor the focus. */
export const TOAST_MS = 10_000;

export interface ToastProps {
  icon: IconGlyph;
  text: string;
  action: { label: string; onClick: () => void };
  onDismiss: () => void;
  /** duration is how long the toast stays, counted only while it has neither the pointer nor the focus. */
  duration?: number;
  /** leaving is the toast pushed out by a newer one: it plays its exit, then tells onDismiss. */
  leaving?: boolean;
}

/**
 * Toast is a short notice in the live region of the shell, with one action under its text. It
 * leaves on its own once its time runs out; the pointer or the focus on it hold the time, which
 * goes on with what was left when both are gone. It leaves by its exit, after its action, its ×
 * or its time, and tells onDismiss once the exit is over.
 */
export function Toast({
  icon,
  text,
  action,
  onDismiss,
  duration = TOAST_MS,
  leaving: pushedOut = false,
}: ToastProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [leftOnItsOwn, setLeaving] = useState(false);
  const leaving = leftOnItsOwn || pushedOut;
  const ref = useRef<HTMLDivElement>(null);
  const left = useRef(duration);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const held = hovered || focused;

  useEffect(() => {
    if (held || leaving) {
      return;
    }
    const started = Date.now();
    const timer = setTimeout(() => setLeaving(true), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [held, leaving]);

  useEffect(() => {
    if (!leaving) {
      return;
    }
    return whenExitEnds(ref.current, () => dismiss.current());
  }, [leaving]);

  return (
    <div
      ref={ref}
      {...(leaving ? { "data-leaving": "", inert: true } : {})}
      className="toast flex max-w-(--size-toast) items-start gap-2.5 rounded-lg bg-surface-3 py-2.5 pr-2 pl-3 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-(--shadow-float)"
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
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5"
          onClick={() => {
            action.onClick();
            setLeaving(true);
          }}
        >
          {action.label}
        </Button>
      </div>
      <IconButton icon={X} label="Dismiss" size="sm" onClick={() => setLeaving(true)} />
    </div>
  );
}
