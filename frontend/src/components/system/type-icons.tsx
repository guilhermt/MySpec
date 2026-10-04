import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlyphProps {
  className?: string;
  "aria-hidden"?: boolean | "true";
}

// Each glyph draws on the 16px grid of the system; the stroke width comes from
// the global rule of icons, which the lucide class opts them into.
function glyph(name: string, paths: ReactNode) {
  function Glyph({ className, ...props }: GlyphProps) {
    return (
      // biome-ignore lint/a11y/noSvgWithoutTitle: a glyph is drawn aria-hidden, beside the text that names it
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
        className={cn("lucide", className)}
      >
        {paths}
      </svg>
    );
  }
  Glyph.displayName = name;
  return Glyph;
}

/** TaskIcon is the type glyph of a task. */
export const TaskIcon = glyph(
  "TaskIcon",
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
    <path d="M5.5 6.5h5M5.5 9.5h3" />
  </>,
);

/** OneShotIcon is the type glyph of a One-Shot task. */
export const OneShotIcon = glyph(
  "OneShotIcon",
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
    <path fill="currentColor" stroke="none" d="M8.9 4.6 5.9 8.7h2.2l-.9 2.8 3-4.1H8z" />
  </>,
);

/** ReviewIcon is the type glyph of a pull request review. */
export const ReviewIcon = glyph(
  "ReviewIcon",
  <>
    <circle cx="4.5" cy="3.8" r="1.6" />
    <circle cx="4.5" cy="12.2" r="1.6" />
    <circle cx="11.5" cy="12.2" r="1.6" />
    <path d="M4.5 5.4v5.2M11.5 10.6V7a2 2 0 0 0-2-2H7.4" />
    <path d="M8.8 3.5 7.3 5l1.5 1.5" />
  </>,
);

/** DiscussionIcon is the type glyph of a discussion. */
export const DiscussionIcon = glyph(
  "DiscussionIcon",
  <path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h7.2A1.4 1.4 0 0 1 13 4.4v5.2A1.4 1.4 0 0 1 11.6 11H7.2L4.2 13.3V11A1.4 1.4 0 0 1 3 9.6z" />,
);

/** MarkIcon is the mark of MySpec. */
export const MarkIcon = glyph(
  "MarkIcon",
  <>
    <path d="M3.5 12.5h3v-3h3v-3h3" />
    <path d="M12.5 3.5v3" />
  </>,
);
