import { describe, expect, it } from "vitest";
import { PLACEHOLDERS, PROMPTS } from "@/features/settings/prompts";

describe("PROMPTS", () => {
  it("has the eight prompts in workflow order, with the One-Shot planning after the plan", () => {
    expect(PROMPTS.map((prompt) => prompt.stage)).toEqual([
      "prd",
      "tech_spec",
      "plan",
      "one_shot",
      "step_review",
      "commit",
      "pr",
      "pr_review",
    ]);
  });
});

describe("PLACEHOLDERS", () => {
  it("says what every placeholder becomes", () => {
    expect(Object.keys(PLACEHOLDERS)).toHaveLength(17);
    expect(PLACEHOLDERS["{{task_name}}"]?.meaning).toBe("The name of the task");
    expect(PLACEHOLDERS["{{one_shot_path}}"]?.meaning).toBe("The One-Shot document file");
  });

  it("says what the app does only for the three it never drops", () => {
    const kept = Object.entries(PLACEHOLDERS)
      .filter(([, meta]) => meta.whenRemoved !== undefined)
      .map(([name]) => name);

    expect(kept).toEqual(["{{initial_context}}", "{{what_to_commit}}", "{{push}}"]);
  });
});
