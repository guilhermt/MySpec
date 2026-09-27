import { afterEach, describe, expect, it } from "vitest";
import { layerOpen, modalOpen } from "@/lib/layers";

function mount(attributes: Record<string, string>): void {
  const element = document.createElement("div");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.append(element);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("modalOpen", () => {
  it.each([
    [{ "data-slot": "dialog-content" }, true],
    [{ "data-slot": "alert-dialog-content" }, true],
    [{ role: "menu", "data-open": "" }, false],
    [{ "data-slot": "popover-content", "data-open": "" }, false],
  ])("tells %o apart", (attributes, open) => {
    mount(attributes);
    expect(modalOpen()).toBe(open);
  });

  it("finds nothing on an empty screen", () => {
    expect(modalOpen()).toBe(false);
  });
});

describe("layerOpen", () => {
  it.each([
    [{ "data-slot": "dialog-content" }, true],
    [{ "data-slot": "alert-dialog-content" }, true],
    [{ role: "menu", "data-open": "" }, true],
    [{ role: "listbox", "data-open": "" }, true],
    [{ "data-slot": "popover-content", "data-open": "" }, true],
    [{ role: "menu" }, false],
    [{ role: "listbox" }, false],
    [{ "data-slot": "popover-content" }, false],
  ])("tells %o apart", (attributes, open) => {
    mount(attributes);
    expect(layerOpen()).toBe(open);
  });
});
