import { describe, expect, it } from "vitest";
import { displayPath } from "@/lib/paths";

describe("displayPath", () => {
  it("replaces the home directory with a tilde", () => {
    expect(displayPath("/home/dev/projects/api")).toBe("~/projects/api");
  });

  it("replaces a bare home directory", () => {
    expect(displayPath("/home/dev")).toBe("~");
  });

  it("leaves paths outside home untouched", () => {
    expect(displayPath("/srv/code/api")).toBe("/srv/code/api");
  });

  it("does not match a directory that merely starts with home", () => {
    expect(displayPath("/homework/api")).toBe("/homework/api");
  });
});
