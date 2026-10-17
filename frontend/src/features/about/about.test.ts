import { describe, expect, it } from "vitest";
import {
  checkedText,
  checkedTip,
  releaseHeading,
  resultOf,
  signLabel,
  versionTitle,
} from "@/features/about/about";
import { makeUpdate, makeUpdateRelease } from "@/test/wails-mock";

const NOW = Date.parse("2026-10-17T14:10:00");

describe("versionTitle", () => {
  it.each([
    ["0.4.0", "MySpec 0.4.0"],
    ["dev", "MySpec dev"],
  ])("heads %s as %s", (version, title) => {
    expect(versionTitle(makeUpdate({ version }))).toBe(title);
  });
});

describe("signLabel", () => {
  it("names the version and where the sign leads", () => {
    expect(signLabel("0.5.0")).toBe("MySpec 0.5.0 is available. Open About.");
  });
});

describe("releaseHeading", () => {
  it("writes the day of this year without the year", () => {
    expect(releaseHeading(makeUpdateRelease({ version: "0.4.0" }), NOW)).toBe("0.4.0 · Oct 16");
  });

  it("writes the year before this one", () => {
    const release = makeUpdateRelease({ version: "0.4.0", publishedAt: "2025-10-16T12:00:00Z" });

    expect(releaseHeading(release, NOW)).toBe("0.4.0 · Oct 16, 2025");
  });
});

describe("checkedText and checkedTip", () => {
  it("says how long ago the check ended and when", () => {
    const checkedAt = new Date(Date.parse("2026-10-17T14:05:00")).toISOString();

    expect(checkedText(checkedAt, NOW)).toBe("Checked 5m ago");
    expect(checkedTip(checkedAt, NOW)).toBe("Last checked at 14:05");
  });

  it("says just now under a minute", () => {
    const checkedAt = new Date(NOW - 10_000).toISOString();

    expect(checkedText(checkedAt, NOW)).toBe("Checked just now");
  });

  it("names the day of an earlier check in the tooltip", () => {
    const checkedAt = new Date(Date.parse("2026-10-16T17:40:00")).toISOString();

    expect(checkedTip(checkedAt, NOW)).toBe("Last checked yesterday at 17:40");
  });
});

describe("resultOf", () => {
  const failure = { kind: "offline", detail: "" };

  it("is local for a build that never checks, before anything else", () => {
    expect(resultOf(makeUpdate({ checks: false, failure, latest: "0.5.0" }))).toEqual({
      kind: "local",
    });
  });

  it("is the failure, with its reason, before a known version", () => {
    expect(resultOf(makeUpdate({ failure, latest: "0.5.0" }))).toEqual({
      kind: "failed",
      reason: "No connection to GitHub.",
    });
  });

  it("is available with a newer version known", () => {
    expect(resultOf(makeUpdate({ latest: "0.5.0" }))).toEqual({ kind: "available" });
  });

  it("is latest after a successful check without a newer version", () => {
    expect(resultOf(makeUpdate())).toEqual({ kind: "latest" });
  });

  it("is none before the first check", () => {
    expect(resultOf(makeUpdate({ checkedAt: "" }))).toEqual({ kind: "none" });
  });
});
