const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const CLOCK = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_OF_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const FULL_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "full" });

// parse is the instant of a time, null when it is empty or does not parse.
function parse(iso: string): Date | null {
  if (iso === "") {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// daysBefore is how many calendar days, in local time, a date lies before now: 0 today, 1 yesterday.
function daysBefore(date: Date, now: number): number {
  const today = new Date(now);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(today) - start(date)) / DAY_MS);
}

/** clockTime is a time as the app writes it: 09:14 today, Yesterday 16:02, Sep 22, 09:14 this year, Sep 22, 2025, 09:14 before. */
export function clockTime(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  const clock = CLOCK.format(date);
  switch (daysBefore(date, now)) {
    case 0:
      return clock;
    case 1:
      return `Yesterday ${clock}`;
    default:
      return date.getFullYear() === new Date(now).getFullYear()
        ? `${DAY.format(date)}, ${clock}`
        : `${DAY_OF_YEAR.format(date)}, ${clock}`;
  }
}

/** startedTime is the time of a Started field: Today 09:14, then as clockTime. */
export function startedTime(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  return daysBefore(date, now) === 0 ? `Today ${CLOCK.format(date)}` : clockTime(iso, now);
}

/** shortTime is the time of a conversation row: 09:14 today, Sep 22 before. */
export function shortTime(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  return daysBefore(date, now) === 0 ? CLOCK.format(date) : DAY.format(date);
}

/** fullTime is the whole date of a tooltip: Sunday, September 27, 2026, 09:14. */
export function fullTime(iso: string): string {
  const date = parse(iso);
  return date === null ? "" : `${FULL_DATE.format(date)}, ${CLOCK.format(date)}`;
}

/** age is how long ago: just now under a minute, 2m ago, 3h ago, 2d ago. */
export function age(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  const elapsed = now - date.getTime();
  if (elapsed < MINUTE_MS) {
    return "just now";
  }
  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  }
  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  }
  return `${Math.floor(elapsed / DAY_MS)}d ago`;
}

/** ageLong is how long ago, in words: just now under a minute, 1 minute ago, 2 hours ago, 3 days ago. */
export function ageLong(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  const elapsed = now - date.getTime();
  if (elapsed < MINUTE_MS) {
    return "just now";
  }
  const [count, unit] =
    elapsed < HOUR_MS
      ? [Math.floor(elapsed / MINUTE_MS), "minute"]
      : elapsed < DAY_MS
        ? [Math.floor(elapsed / HOUR_MS), "hour"]
        : [Math.floor(elapsed / DAY_MS), "day"];
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/** readMoment is when a reading happened: 14:08 today, yesterday at 17:40, Sep 21 at 17:40 before. */
export function readMoment(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  const clock = CLOCK.format(date);
  switch (daysBefore(date, now)) {
    case 0:
      return clock;
    case 1:
      return `yesterday at ${clock}`;
    default:
      return `${DAY.format(date)} at ${clock}`;
  }
}

/** reviewMoment is when a review was submitted, to follow a verb: today at 10:02, yesterday at 17:40, on Sep 22 at 09:30. */
export function reviewMoment(iso: string, now: number): string {
  const date = parse(iso);
  if (date === null) {
    return "";
  }
  const moment = readMoment(iso, now);
  switch (daysBefore(date, now)) {
    case 0:
      return `today at ${moment}`;
    case 1:
      return moment;
    default:
      return `on ${moment}`;
  }
}

/** readClock is when a reading happened, for its tooltip: "at 14:08" today, "yesterday at 17:40", "Sep 21 at 17:40" before. */
export function readClock(iso: string, now: number): string {
  const moment = readMoment(iso, now);
  const date = parse(iso);
  return date !== null && daysBefore(date, now) === 0 ? `at ${moment}` : moment;
}

/** duration is a length of time: 42s, 4m 12s, 1h 3m. */
export function duration(ms: number): string {
  const seconds = Math.max(Math.floor(ms / SECOND_MS), 0);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
