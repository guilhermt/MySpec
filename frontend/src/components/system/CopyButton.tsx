import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";
import { LiveRegion } from "./LiveRegion";

/** COPIED_MS is how long a button says Copied before it offers the copy again. */
const COPIED_MS = 2000;

export interface CopyButtonProps {
  text: string;
  /** label names the button: "Copy the error", "Copy gh auth login", "Copy the list". */
  label: string;
  variant: "icon" | "page";
  /**
   * note is the side Copied and the failure stand on, away from the edge the button keeps: after it
   * by default, before it where the button ends a line, as in the header of a CopyBlock.
   */
  note?: "after" | "before";
}

type Result = "idle" | "copied" | "failed";

/** NOTE is what the button says beside it, out of the flow, on the side of note. */
const NOTE =
  "absolute inset-y-0 flex items-center text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap";
const AFTER = "left-[calc(100%+var(--space-2))]";
const BEFORE = "right-[calc(100%+var(--space-2))]";

/**
 * CopyButton copies a text to the clipboard and says whether it did; when it can't, the text stays to
 * be selected. Copied, the button shows the check and Copied stands beside it, out of the flow, so the
 * button keeps its width and its place.
 */
export function CopyButton({ text, label, variant, note = "after" }: CopyButtonProps) {
  const [result, setResult] = useState<Result>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setResult("failed");
      return;
    }
    setResult("copied");
    timer.current = setTimeout(() => setResult("idle"), COPIED_MS);
  }

  return (
    <span className="relative inline-flex shrink-0 items-center">
      {variant === "icon" ? (
        <IconButton
          label={label}
          icon={result === "copied" ? ICONS.done : ICONS.copy}
          size="xs"
          onClick={() => void copy()}
        />
      ) : (
        <Button
          size="sm"
          icon={result === "copied" ? ICONS.done : ICONS.copy}
          onClick={() => void copy()}
        >
          {label}
        </Button>
      )}
      {result === "copied" && (
        <span
          data-copy-note=""
          className={cn(NOTE, note === "after" ? AFTER : BEFORE, "text-ink-3")}
        >
          Copied
        </span>
      )}
      {result === "failed" && (
        <span
          role="alert"
          data-copy-note=""
          className={cn(NOTE, note === "after" ? AFTER : BEFORE, "text-state-error")}
        >
          Can't copy · select the text
        </span>
      )}
      <LiveRegion kind="status" className="sr-only">
        {result === "copied" ? "Copied" : ""}
      </LiveRegion>
    </span>
  );
}
