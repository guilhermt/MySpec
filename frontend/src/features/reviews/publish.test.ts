import { describe, expect, it } from "vitest";
import { publishedGoes, verdictName } from "@/features/reviews/publish";

describe("publishedGoes", () => {
  it.each([
    {
      name: "inline and the summary",
      marker: { inline: 2, body: 0, summary: true, minimal: false },
      want: "2 inline comments · the summary in the body",
    },
    {
      name: "one inline comment, nothing else",
      marker: { inline: 1, body: 0, summary: false, minimal: false },
      want: "1 inline comment · nothing in the body",
    },
    {
      name: "findings and the summary in the body",
      marker: { inline: 1, body: 2, summary: true, minimal: false },
      want: "1 inline comment · 2 findings and the summary in the body",
    },
    {
      name: "one finding in the body",
      marker: { inline: 0, body: 1, summary: false, minimal: false },
      want: "1 finding in the body",
    },
    {
      name: "the minimal body",
      marker: { inline: 2, body: 0, summary: false, minimal: true },
      want: '2 inline comments · "Review with 2 inline comments." in the body',
    },
    {
      name: "the minimal body of one comment",
      marker: { inline: 1, body: 0, summary: false, minimal: true },
      want: '1 inline comment · "Review with 1 inline comment." in the body',
    },
    {
      name: "the summary alone",
      marker: { inline: 0, body: 0, summary: true, minimal: false },
      want: "the summary in the body",
    },
    {
      name: "nothing but the verdict",
      marker: { inline: 0, body: 0, summary: false, minimal: false },
      want: "the verdict only",
    },
  ])("$name", ({ marker, want }) => {
    expect(publishedGoes(marker)).toBe(want);
  });
});

describe("verdictName", () => {
  it.each([
    ["request_changes", "Request changes"],
    ["approve", "Approve"],
    ["comment", "Comment"],
    ["", ""],
  ])("names %j as %j", (verdict, want) => {
    expect(verdictName(verdict)).toBe(want);
  });
});
