import { describe, expect, it } from "vitest";
import { messageOf } from "@/lib/errors";

describe("messageOf", () => {
  it("is the message of an error", () => {
    expect(messageOf(new Error("the clone is missing"))).toBe("the clone is missing");
  });

  it("prints what is not an error", () => {
    expect(messageOf("gone")).toBe("gone");
  });
});
