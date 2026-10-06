import { afterEach, describe, expect, it } from "vitest";
import { installInputModality } from "@/lib/input-modality";

describe("installInputModality", () => {
  let remove = () => {};
  afterEach(() => {
    remove();
    delete document.documentElement.dataset.input;
  });

  it("starts at pointer and follows the last input", () => {
    remove = installInputModality();
    expect(document.documentElement.dataset.input).toBe("pointer");

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.documentElement.dataset.input).toBe("keyboard");

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.documentElement.dataset.input).toBe("pointer");
  });

  it("stops following once removed", () => {
    remove = installInputModality();
    remove();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(document.documentElement.dataset.input).toBe("pointer");
  });
});
