import { describe, expect, it } from "vitest";
import { isTyping } from "./keys";

describe("isTyping", () => {
  it("takes an input and a textarea for a field", () => {
    expect(isTyping(document.createElement("input"))).toBe(true);
    expect(isTyping(document.createElement("textarea"))).toBe(true);
  });

  it("leaves a button, any other element and no target to the shortcuts", () => {
    expect(isTyping(document.createElement("button"))).toBe(false);
    expect(isTyping(document.createElement("div"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
