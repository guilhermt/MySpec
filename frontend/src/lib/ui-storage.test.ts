import { afterEach, describe, expect, it, vi } from "vitest";
import { boardViewKey, readStored, SIDEBAR_COLLAPSED_KEY, writeStored } from "@/lib/ui-storage";

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ui-storage", () => {
  it("reads back what was written", () => {
    writeStored("myspec.test", ["a", "b"]);

    expect(readStored("myspec.test", [], isStrings)).toEqual(["a", "b"]);
  });

  it("falls back when nothing was written", () => {
    expect(readStored("myspec.test", ["fallback"], isStrings)).toEqual(["fallback"]);
  });

  it("falls back on a value that is not JSON", () => {
    localStorage.setItem("myspec.test", "{not json");

    expect(readStored("myspec.test", ["fallback"], isStrings)).toEqual(["fallback"]);
  });

  it("falls back on a value of another shape", () => {
    localStorage.setItem("myspec.test", JSON.stringify({ collapsed: true }));

    expect(readStored("myspec.test", ["fallback"], isStrings)).toEqual(["fallback"]);
  });

  it("falls back when the storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(readStored("myspec.test", ["fallback"], isStrings)).toEqual(["fallback"]);
  });

  it("does nothing when the storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => writeStored("myspec.test", ["a"])).not.toThrow();
  });

  it("names the keys under the app prefix", () => {
    expect(boardViewKey("board-1")).toBe("myspec.board.board-1");
    expect(SIDEBAR_COLLAPSED_KEY).toBe("myspec.sidebar.collapsed");
  });
});
