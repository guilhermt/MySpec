import { describe, expect, it } from "vitest";
import {
  age,
  ageLong,
  clockTime,
  duration,
  fullTime,
  readClock,
  readMoment,
  reviewMoment,
  shortTime,
  startedTime,
} from "@/lib/when";

// NOW is Sunday, September 27, 2026, 15:00 in the local time of the runner.
const NOW = new Date(2026, 8, 27, 15, 0).getTime();
const local = (...parts: [number, number, number, number, number]) =>
  new Date(...parts).toISOString();

describe("clockTime", () => {
  it.each([
    ["today", local(2026, 8, 27, 9, 14), "09:14"],
    ["yesterday", local(2026, 8, 26, 16, 2), "Yesterday 16:02"],
    ["this year", local(2026, 8, 22, 9, 14), "Sep 22, 09:14"],
    ["another year", local(2025, 8, 22, 9, 14), "Sep 22, 2025, 09:14"],
    ["no time", "", ""],
  ])("writes a time of %s", (_, iso, text) => {
    expect(clockTime(iso, NOW)).toBe(text);
  });
});

describe("startedTime", () => {
  it.each([
    ["today", local(2026, 8, 27, 9, 14), "Today 09:14"],
    ["yesterday", local(2026, 8, 26, 16, 2), "Yesterday 16:02"],
    ["this year", local(2026, 8, 22, 9, 14), "Sep 22, 09:14"],
    ["no time", "", ""],
  ])("writes a start of %s", (_, iso, text) => {
    expect(startedTime(iso, NOW)).toBe(text);
  });
});

describe("shortTime", () => {
  it.each([
    ["today", local(2026, 8, 27, 9, 14), "09:14"],
    ["before", local(2026, 8, 22, 9, 14), "Sep 22"],
    ["no time", "", ""],
  ])("writes a conversation row of %s", (_, iso, text) => {
    expect(shortTime(iso, NOW)).toBe(text);
  });
});

describe("fullTime", () => {
  it.each([
    [local(2026, 8, 27, 9, 14), "Sunday, September 27, 2026, 09:14"],
    ["", ""],
  ])("writes %s whole", (iso, text) => {
    expect(fullTime(iso)).toBe(text);
  });
});

describe("age", () => {
  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [-60_000, "just now"],
    [2 * 60_000, "2m ago"],
    [59 * 60_000, "59m ago"],
    [3 * 60 * 60_000, "3h ago"],
    [2 * 24 * 60 * 60_000, "2d ago"],
  ])("reads %i ms as %s", (elapsed, text) => {
    expect(age(new Date(NOW - elapsed).toISOString(), NOW)).toBe(text);
  });

  it("says nothing of a time it does not have", () => {
    expect(age("", NOW)).toBe("");
    expect(age("not a time", NOW)).toBe("");
  });
});

describe("readMoment and readClock", () => {
  it.each([
    ["today", local(2026, 8, 27, 14, 8), "14:08", "at 14:08"],
    ["yesterday", local(2026, 8, 26, 17, 40), "yesterday at 17:40", "yesterday at 17:40"],
    ["before", local(2026, 8, 21, 17, 40), "Sep 21 at 17:40", "Sep 21 at 17:40"],
    ["no time", "", "", ""],
  ])("writes a reading of %s", (_, iso, moment, clock) => {
    expect(readMoment(iso, NOW)).toBe(moment);
    expect(readClock(iso, NOW)).toBe(clock);
  });
});

describe("reviewMoment", () => {
  it.each([
    ["today", local(2026, 8, 27, 10, 2), "today at 10:02"],
    ["yesterday", local(2026, 8, 26, 17, 40), "yesterday at 17:40"],
    ["before", local(2026, 8, 22, 9, 30), "on Sep 22 at 09:30"],
    ["no time", "", ""],
  ])("writes a review of %s", (_, iso, moment) => {
    expect(reviewMoment(iso, NOW)).toBe(moment);
  });
});

describe("ageLong", () => {
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it.each([
    ["under a minute", ago(59_000), "just now"],
    ["a minute", ago(60_000), "1 minute ago"],
    ["minutes", ago(42 * 60_000), "42 minutes ago"],
    ["an hour", ago(60 * 60_000), "1 hour ago"],
    ["hours", ago(2 * 60 * 60_000 + 59 * 60_000), "2 hours ago"],
    ["a day", ago(24 * 60 * 60_000), "1 day ago"],
    ["days", ago(3 * 24 * 60 * 60_000), "3 days ago"],
    ["no time", "", ""],
  ])("writes an age of %s", (_, iso, text) => {
    expect(ageLong(iso, NOW)).toBe(text);
  });
});

describe("duration", () => {
  it.each([
    [0, "0s"],
    [42_000, "42s"],
    [4 * 60_000 + 12_000, "4m 12s"],
    [60 * 60_000 + 3 * 60_000 + 20_000, "1h 3m"],
    [-5_000, "0s"],
  ])("reads %i ms as %s", (ms, text) => {
    expect(duration(ms)).toBe(text);
  });
});
