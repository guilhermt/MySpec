import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";

/** COPIED_MS is how long a button says Copied before it offers the copy again. */
const COPIED_MS = 2000;

export interface CopyButtonProps {
  text: string;
  /** label names the button: "Copy the error", "Copy gh auth login", "Copy the list". */
  label: string;
  variant: "icon" | "page";
}

type Result = "idle" | "copied" | "failed";

/** CopyButton copies a text to the clipboard and says whether it did; when it can't, the text stays to be selected. */
export function CopyButton({ text, label, variant }: CopyButtonProps) {
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
    <span className="inline-flex shrink-0 items-center gap-(--space-2)">
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
        <span className="inline-flex items-center gap-(--space-1) text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
          <Icon icon={ICONS.done} size="xs" />
          Copied
        </span>
      )}
      {result === "failed" && (
        <span
          role="alert"
          className="text-(length:--text-micro) leading-(--leading-micro) text-state-error"
        >
          Can't copy · select the text
        </span>
      )}
      <span role="status" className="sr-only">
        {result === "copied" ? "Copied" : ""}
      </span>
    </span>
  );
}
