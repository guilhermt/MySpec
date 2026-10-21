import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";

export interface ImageThumbProps {
  src: string;
  /** label names the button that opens the image. */
  label: string;
  size: "sm" | "md";
  /** caption is the line under the thumbnail, cut to one line. */
  caption?: string;
  onOpen: () => void;
  /** onRemove draws the × in the corner; without it the image stays. */
  onRemove?: () => void;
  removeLabel?: string;
}

const SQUARES = { sm: "size-(--size-thumb)", md: "size-(--size-thumb-lg)" } as const;
const WIDTHS = { sm: "w-(--size-thumb)", md: "w-(--size-thumb-lg)" } as const;

/**
 * ImageThumb is a square thumbnail of an image that opens it large, with the × that takes it back
 * when it can be removed. An image that doesn't load shows the image icon.
 */
export function ImageThumb({
  src,
  label,
  size,
  caption,
  onOpen,
  onRemove,
  removeLabel,
}: ImageThumbProps) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={cn("flex flex-col gap-(--space-1)", WIDTHS[size])}>
      <div className="relative">
        <button
          type="button"
          aria-label={label}
          onClick={onOpen}
          className={cn(
            "flex cursor-pointer items-center justify-center overflow-hidden rounded-md border border-line-2 bg-surface-0 transition-colors duration-(--duration-fast) ease-standard hover:border-line-3 focus-visible:focus-ring",
            SQUARES[size],
          )}
        >
          {broken ? (
            <Icon icon={ICONS.image} className="text-ink-4" />
          ) : (
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
              className="size-full object-cover"
            />
          )}
        </button>
        {onRemove !== undefined && (
          <div className="absolute top-(--space-1) right-(--space-1) rounded-sm bg-surface-3">
            <IconButton
              size="xs"
              icon={ICONS.close}
              label={removeLabel ?? "Remove"}
              onClick={onRemove}
            />
          </div>
        )}
      </div>
      {caption !== undefined && (
        <span className="truncate text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          {caption}
        </span>
      )}
    </div>
  );
}
