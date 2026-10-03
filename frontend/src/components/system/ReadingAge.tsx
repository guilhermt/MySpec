import { age, clockTime, readClock } from "@/lib/when";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

export interface ReadingAgeProps {
  /** readAt is when the stored reading happened, "" for a list never read. */
  readAt: string;
  reading: boolean;
  now: number;
  /** never says a list never read: Not read yet, in place of nothing. */
  never?: boolean;
  /** failure says the last reading failed, and when. */
  failure?: { failedAt: string };
}

/**
 * ReadingAge is the age of what a list shows: Read 2m ago with the exact time in the tooltip, or
 * Reading… while a reading runs, or ◇ Read failed 18m ago when the last one failed. A list never
 * read says nothing, or Not read yet when it is asked to.
 */
export function ReadingAge({ readAt, reading, now, never, failure }: ReadingAgeProps) {
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
  if (failure !== undefined) {
    const last = readAt === "" ? "" : ` · last read ${readClock(readAt, now)}`;
    return (
      <Tooltip content={`Failed at ${clockTime(failure.failedAt, now)}${last}`}>
        <span className="inline-flex items-center gap-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-2">
          <StateGlyph state="blocked" size="sm" />
          Read failed {age(failure.failedAt, now)}
        </span>
      </Tooltip>
    );
  }
  if (readAt === "") {
    return never ? (
      <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-4">
        Not read yet
      </span>
    ) : null;
  }
  const text = `Read ${age(readAt, now)}`;
  return (
    <Tooltip content={`Last read ${readClock(readAt, now)}`}>
      <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-4">
        {text}
      </span>
    </Tooltip>
  );
}
