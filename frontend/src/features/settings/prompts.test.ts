import { describe, expect, it } from "vitest";
import { PLACEHOLDERS, PROMPTS } from "@/features/settings/prompts";

describe("PROMPTS", () => {
  it("has the seven prompts in workflow order", () => {
    expect(PROMPTS.map((prompt) => prompt.stage)).toEqual([
      "prd",
      "tech_spec",
      "plan",
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
  });

  it("says what the app does only for the three it never drops", () => {
    const kept = Object.entries(PLACEHOLDERS)
      .filter(([, meta]) => meta.whenRemoved !== undefined)
      .map(([name]) => name);

    expect(kept).toEqual(["{{initial_context}}", "{{what_to_commit}}", "{{push}}"]);
  });
});
