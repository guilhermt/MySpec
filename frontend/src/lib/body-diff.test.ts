import { describe, expect, it } from "vitest";
import { bodyDiff } from "@/lib/body-diff";

describe("bodyDiff", () => {
  it("has one entry per line of both texts", () => {
    expect(
      bodyDiff("Email and password.\nNo social login.\n", "Email and password.\nSSO too.\n"),
    ).toEqual([
      { kind: "same", text: "Email and password." },
      { kind: "removed", text: "No social login." },
      { kind: "added", text: "SSO too." },
    ]);
  });

  it("reads a body with no trailing newline as its lines alone", () => {
    expect(bodyDiff("One", "One\nTwo")).toEqual([
      { kind: "same", text: "One" },
      { kind: "added", text: "Two" },
    ]);
  });

  it("reads a body typed on GitHub by its lines, carriage returns and all", () => {
    expect(
      bodyDiff("Email and password.\r\nNo social login.\r\n", "Email and password.\nSSO too.\n"),
    ).toEqual([
      { kind: "same", text: "Email and password." },
      { kind: "removed", text: "No social login." },
      { kind: "added", text: "SSO too." },
    ]);
  });

  it("marks nothing when the two texts are the same", () => {
    expect(bodyDiff("One\nTwo\n", "One\nTwo\n")).toEqual([
      { kind: "same", text: "One" },
      { kind: "same", text: "Two" },
    ]);
  });

  it("is empty for two empty texts", () => {
    expect(bodyDiff("", "")).toEqual([]);
  });

  it("marks every line of a body written from nothing", () => {
    expect(bodyDiff("", "A button.\n")).toEqual([{ kind: "added", text: "A button." }]);
  });
});
