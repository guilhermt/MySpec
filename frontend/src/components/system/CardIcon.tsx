import { cn } from "@/lib/utils";

export interface CardIconProps {
  className?: string;
  "aria-hidden"?: boolean | "true";
}

/** CardIcon is the glyph of a board card, on the 16px grid of the system, as the i-card of the mocks. */
export function CardIcon({ className }: CardIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("lucide", className)}
    >
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
      <path d="M5 6.5h6M5 9.5h3.5" />
    </svg>
  );
}
