import { describe, expect, it } from "vitest";
import {
  decidedCounts,
  type FindingLike,
  fileName,
  findingName,
  headingOf,
  isDecided,
  locationText,
  nextToDecide,
  previousToDecide,
} from "@/lib/findings";

function finding(number: number, overrides: Partial<FindingLike> = {}): FindingLike {
  return {
    number,
    decision: "",
    path: "web/src/settings/GeneralForm.tsx",
    line: 84,
    title: "",
    ...overrides,
  };
}

describe("nextToDecide", () => {
  const findings = [
    finding(1, { decision: "approved" }),
    finding(2),
    finding(3, { decision: "discarded" }),
    finding(4),
  ];

  it.each([
    { name: "from the start", after: null, want: 2 },
    { name: "after the first", after: 1, want: 2 },
    { name: "after the one to decide", after: 2, want: 4 },
    { name: "wraps from the end", after: 4, want: 2 },
  ])("$name", ({ after, want }) => {
    expect(nextToDecide(findings, after)).toBe(want);
  });

  it("is null when everything is decided", () => {
    expect(nextToDecide([finding(1, { decision: "approved" })], null)).toBeNull();
  });
});

describe("previousToDecide", () => {
  const findings = [finding(1), finding(2, { decision: "approved" }), finding(3), finding(4)];

  it.each([
    { name: "from the end", before: null, want: 4 },
    { name: "before the last", before: 4, want: 3 },
    { name: "skips what is decided", before: 3, want: 1 },
    { name: "wraps from the start", before: 1, want: 4 },
  ])("$name", ({ before, want }) => {
    expect(previousToDecide(findings, before)).toBe(want);
  });

  it("is null without a finding to decide", () => {
    expect(previousToDecide([], null)).toBeNull();
  });
});

describe("the text of a finding", () => {
  it("names the location of an anchored finding and of a general one", () => {
    expect(locationText(finding(1))).toBe("web/src/settings/GeneralForm.tsx:84");
    expect(locationText(finding(1, { path: "", line: 0 }))).toBe(
      "General · not on a line of the diff",
    );
  });

  it("takes the file name off a path", () => {
    expect(fileName("web/src/settings/GeneralForm.tsx")).toBe("GeneralForm.tsx");
    expect(fileName("README.md")).toBe("README.md");
  });

  it("puts the location where the title is missing", () => {
    expect(headingOf(finding(1, { title: "The form never saves" }))).toEqual({
      title: "The form never saves",
      locationAsTitle: false,
    });
    expect(headingOf(finding(1))).toEqual({
      title: "web/src/settings/GeneralForm.tsx:84",
      locationAsTitle: true,
    });
  });

  it.each([
    {
      name: "with a title",
      one: finding(2, { title: "The form never saves", line: 31 }),
      want: "Finding 2 of 3: The form never saves. web/src/settings/GeneralForm.tsx, line 31. Not decided.",
    },
    {
      name: "without a title",
      one: finding(2, { path: "web/src/settings/useSettingsForm.ts", line: 31 }),
      want: "Finding 2 of 3: web/src/settings/useSettingsForm.ts, line 31. Not decided.",
    },
    {
      name: "general and approved",
      one: finding(2, { title: "No test", path: "", line: 0, decision: "approved" }),
      want: "Finding 2 of 3: No test. General. Approved.",
    },
    {
      name: "discarded",
      one: finding(2, { title: "No test", decision: "discarded" }),
      want: "Finding 2 of 3: No test. web/src/settings/GeneralForm.tsx, line 84. Discarded.",
    },
  ])("names a finding $name", ({ one, want }) => {
    expect(findingName(one, 3)).toBe(want);
  });
});

describe("decidedCounts", () => {
  it("counts what was decided", () => {
    const findings = [
      finding(1, { decision: "approved" }),
      finding(2, { decision: "discarded" }),
      finding(3),
    ];
    expect(decidedCounts(findings)).toEqual({ decided: 2, approved: 1, discarded: 1, total: 3 });
    expect(isDecided(finding(3))).toBe(false);
  });
});

describe("findingName with code in the title", () => {
  it("reads the title without its backticks", () => {
    const named = findingName(
      {
        number: 1,
        decision: "",
        path: "pnpm-lock.yaml",
        line: 3,
        title: "Pins two versions of `vite`",
      },
      2,
    );
    expect(named).toBe(
      "Finding 1 of 2: Pins two versions of vite. pnpm-lock.yaml, line 3. Not decided.",
    );
  });
});
