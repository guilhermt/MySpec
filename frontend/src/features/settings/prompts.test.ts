import { describe, expect, it } from "vitest";
import { PLACEHOLDERS, PROMPTS } from "@/features/settings/prompts";

describe("PROMPTS", () => {
  it("has the six prompts in workflow order", () => {
    expect(PROMPTS.map((prompt) => prompt.stage)).toEqual([
      "prd",
      "tech_spec",
      "plan",
      "commit",
      "pr",
      "pr_review",
    ]);
  });
});

describe("PLACEHOLDERS", () => {
  it("says what every placeholder becomes", () => {
    expect(Object.keys(PLACEHOLDERS)).toHaveLength(15);
    expect(PLACEHOLDERS["{{task_name}}"]?.meaning).toBe("The name of the task");
  });

  it("says what the app does only for the two it never drops", () => {
    const kept = Object.entries(PLACEHOLDERS)
      .filter(([, meta]) => meta.whenRemoved !== undefined)
      .map(([name]) => name);

    expect(kept).toEqual(["{{initial_context}}", "{{push}}"]);
  });
});
