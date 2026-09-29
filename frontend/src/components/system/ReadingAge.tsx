import { age, readClock } from "@/lib/when";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

export interface ReadingAgeProps {
  /** readAt is when the stored reading happened, "" for a list never read. */
  readAt: string;
  reading: boolean;
  now: number;
}

/**
 * ReadingAge is the age of what a list shows: Read 2m ago with the exact time in the tooltip, or
 * Reading… while a reading runs. A list never read says nothing.
 */
export function ReadingAge({ readAt, reading, now }: ReadingAgeProps) {
  if (reading) {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-3"
      >
        <Spinner />
        Reading…
      </span>
    );
  }
  if (readAt === "") return null;
  const text = `Read ${age(readAt, now)}`;
  return (
    <Tooltip content={`Last read ${readClock(readAt, now)}`}>
      <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-4">
        {text}
      </span>
    </Tooltip>
  );
}
