import { describe, expect, it } from "vitest";
import { contextDetail } from "@/features/chat/session";

describe("contextDetail", () => {
  it.each<[string, number | null, string]>([
    ["the percent used", 44, "Context window 44% used"],
    ["a real zero", 0, "Context window 0% used"],
    ["a rounded percent", 43.6, "Context window 44% used"],
    ["no reading yet", null, "Context window not read yet"],
  ])("says %s", (_, percent, detail) => {
    expect(contextDetail(percent)).toBe(detail);
  });
});
