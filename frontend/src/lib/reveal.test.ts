import { afterEach, describe, expect, it, vi } from "vitest";
import { revealItem } from "@/lib/reveal";

// box is a box that scrolls, 500px high, scrolled 1000px down, with an item 300px into what it shows.
function box(itemHeight: number, scrollMargin = "") {
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  Object.defineProperty(scroller, "clientHeight", { value: 500 });
  scroller.scrollTop = 1000;
  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 800, 500));
  const item = document.createElement("div");
  item.style.scrollMarginTop = scrollMargin;
  vi.spyOn(item, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 400, 800, itemHeight));
  scroller.append(item);
  document.body.append(scroller);
  return { scroller, item };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("revealItem", () => {
  it("centres an item that fits in the box that scrolls it", () => {
    const { scroller, item } = box(200);

    revealItem(item);

    // The item starts 1300px down the content: centred, 150px of the box above it.
    expect(scroller.scrollTop).toBe(1150);
  });

  it("brings an item taller than the box in by its top, below its scroll margin", () => {
    const { scroller, item } = box(700, "24px");

    revealItem(item);

    expect(scroller.scrollTop).toBe(1276);
  });

  it("counts the scroll margin in what has to fit", () => {
    const { scroller, item } = box(490, "24px");

    revealItem(item);

    expect(scroller.scrollTop).toBe(1276);
  });

  it("centres the item through the page when nothing scrolls it", () => {
    const item = document.createElement("div");
    const scroll = vi.fn();
    item.scrollIntoView = scroll;
    document.body.append(item);

    revealItem(item);

    expect(scroll).toHaveBeenCalledWith({ block: "center" });
  });

  it("goes on until a control of the item is whole above the scroll padding", () => {
    const { scroller, item } = box(700, "24px");
    scroller.style.scrollPaddingBottom = "60px";
    const control = document.createElement("button");
    // The box ends at 600; the control ends at 580, inside the 60px kept for what floats over it.
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 550, 80, 30));
    item.append(control);

    revealItem(item, control);

    expect(scroller.scrollTop).toBe(1276 + 40);
  });
});
