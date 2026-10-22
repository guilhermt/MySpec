import { describe, expect, it } from "vitest";
import { outputView } from "@/features/chat/output";

const lines = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => `line ${from + i}`).join("\n");

describe("outputView", () => {
  it("shows an output of up to 16 lines whole", () => {
    expect(outputView(lines(16), 16)).toEqual({ text: lines(16), above: 0 });
  });

  it("shows the last 12 lines of a longer output and counts the rest", () => {
    expect(outputView(lines(17), 17)).toEqual({ text: lines(12, 6), above: 5 });
  });

  it("counts the lines the text does not hold when it is only the tail", () => {
    expect(outputView(lines(12, 25), 36)).toEqual({ text: lines(12, 25), above: 24 });
  });

  it("shows an empty output as nothing above", () => {
    expect(outputView("", 0)).toEqual({ text: "", above: 0 });
  });
});
