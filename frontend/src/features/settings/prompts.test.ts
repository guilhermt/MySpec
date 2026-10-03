import { describe, expect, it } from "vitest";
import {
  editedLabel,
  linesText,
  PLACEHOLDERS,
  PROMPTS,
  withPlaceholderCode,
} from "@/features/settings/prompts";

describe("PROMPTS", () => {
  it("has the nine prompts in workflow order, with the One-Shot planning after the plan", () => {
    expect(PROMPTS.map((prompt) => prompt.stage)).toEqual([
      "prd",
      "tech_spec",
      "plan",
      "one_shot",
      "step_review",
      "commit",
      "pr",
      "pr_review",
      "discussion",
    ]);
  });
});

describe("PLACEHOLDERS", () => {
  it("says what every placeholder becomes", () => {
    expect(Object.keys(PLACEHOLDERS)).toHaveLength(19);
    expect(PLACEHOLDERS["{{task_name}}"]?.meaning).toBe("The name of the task");
    expect(PLACEHOLDERS["{{one_shot_path}}"]?.meaning).toBe("The One-Shot document file");
    expect(PLACEHOLDERS["{{drafts_path}}"]?.meaning).toBe(
      "The file the agent writes the drafts of cards to",
    );
  });

  it("says what the app does only for the three it never drops", () => {
    const kept = Object.entries(PLACEHOLDERS)
      .filter(([, meta]) => meta.whenRemoved !== undefined)
      .map(([name]) => name);

    expect(kept).toEqual(["{{initial_context}}", "{{what_to_commit}}", "{{push}}"]);
  });
});

describe("editedLabel", () => {
  const now = new Date(2026, 8, 27, 15, 30).getTime();

  it.each([
    [new Date(2026, 8, 27, 9, 14), "Edited today"],
    [new Date(2026, 8, 26, 23, 59), "Edited yesterday"],
    [new Date(2026, 8, 20, 10, 0), "Edited Sep 20"],
    [new Date(2026, 0, 2, 10, 0), "Edited Jan 2"],
    [new Date(2025, 8, 20, 10, 0), "Edited Sep 20, 2025"],
  ])("writes %s as %s", (editedAt, label) => {
    expect(editedLabel(editedAt.toISOString(), now)).toBe(label);
  });
});

describe("linesText", () => {
  it.each([
    [92, 87, "Your version has 92 lines; the default of this version has 87."],
    [1, 3, "Your version has 1 line; the default of this version has 3."],
    [87, 87, "Your version and the default of this version both have 87 lines."],
    [1, 1, "Your version and the default of this version both have 1 line."],
    [0, 3, "Your version has 0 lines; the default of this version has 3."],
  ])("says %i and %i", (lines, defaultLines, text) => {
    expect(linesText(lines, defaultLines)).toBe(text);
  });
});

describe("withPlaceholderCode", () => {
  it.each([
    ["Write the PRD of {{task_name}}.", "Write the PRD of `{{task_name}}`."],
    ["{{prd_path}} and {{tech_spec_path}}", "`{{prd_path}}` and `{{tech_spec_path}}`"],
    [
      "Already `{{task_name}}` here, and {{branch}}",
      "Already `{{task_name}}` here, and `{{branch}}`",
    ],
    ["An unknown {{other}} stays", "An unknown {{other}} stays"],
    ["No placeholder at all", "No placeholder at all"],
  ])("turns %j into %j", (text, want) => {
    expect(withPlaceholderCode(text)).toBe(want);
  });

  it("leaves a fenced block alone, whatever the fence", () => {
    const text =
      "Before {{branch}}\n```sh\ncd {{repository}}\n```\n~~~~\n{{pr_url}}\n~~~~\nAfter {{pr_number}}";

    expect(withPlaceholderCode(text)).toBe(
      "Before `{{branch}}`\n```sh\ncd {{repository}}\n```\n~~~~\n{{pr_url}}\n~~~~\nAfter `{{pr_number}}`",
    );
  });

  it("keeps a longer fence open until a fence at least as long closes it", () => {
    const text = "````\n```\n{{branch}}\n````\n{{branch}}";

    expect(withPlaceholderCode(text)).toBe("````\n```\n{{branch}}\n````\n`{{branch}}`");
  });
});
