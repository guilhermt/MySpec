import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWindowedRows, type WindowedRows } from "./useWindowedRows";

const ROWS = 1000;
const OVERSCAN = 5;
const GAP = 4;
// The jsdom stub of test/setup.ts: a scroll element of 600 pixels and rows of 40.
const SHOWN = 600 / 40;

let latest: WindowedRows;

function List({
  pinned = [],
  show = true,
  estimate = 40,
}: {
  pinned?: number[];
  show?: boolean;
  estimate?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useWindowedRows({
    count: ROWS,
    keyOf: (index) => `row:${index}`,
    estimate: () => estimate,
    pinned,
    scrollRef,
    listRef,
    overscan: OVERSCAN,
  });
  latest = rows;
  return (
    <div ref={scrollRef}>
      {show && (
        <div ref={listRef} style={{ display: "flex", flexDirection: "column", rowGap: GAP }}>
          {rows.parts.map((part) =>
            part.kind === "spacer" ? (
              <div key={part.key} data-spacer="" style={{ height: part.height }} />
            ) : (
              <div key={part.key} ref={rows.measureRef} data-index={part.index} data-row="">
                {part.key}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

const rowsIn = (container: HTMLElement) => container.querySelectorAll("[data-row]");
const spacersIn = (container: HTMLElement) => container.querySelectorAll("[data-spacer]");
const scrollOf = (container: HTMLElement) => container.firstElementChild as HTMLElement;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWindowedRows", () => {
  it("mounts only what shows, plus the overscan", () => {
    const { container } = render(<List />);
    const mounted = rowsIn(container).length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThanOrEqual(Math.ceil(SHOWN) + 2 * OVERSCAN + 1);
  });

  it("keeps a pinned row far from the window between two spacers", () => {
    const { container } = render(<List pinned={[500]} />);
    const far = container.querySelector('[data-index="500"]');
    expect(far).not.toBeNull();
    expect(far?.previousElementSibling).toHaveAttribute("data-spacer");
    expect(far?.nextElementSibling).toHaveAttribute("data-spacer");
    expect(latest.mounted(500)).toBe(true);
    expect(latest.mounted(250)).toBe(false);
  });

  it("draws spacers of whole pixels, never negative", () => {
    const { container } = render(<List pinned={[500]} />);
    const heights = Array.from(spacersIn(container)).map((spacer) =>
      Number.parseFloat((spacer as HTMLElement).style.height),
    );
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) {
      expect(Number.isInteger(height)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(0);
    }
  });

  it("draws the spacer above the window in whole pixels when the estimates are not", () => {
    const { container } = render(<List estimate={40.37} />);
    act(() => scrollOf(container).scrollTo({ top: 20_000 }));

    const top = container.querySelector("[data-row]")?.parentElement?.firstElementChild;
    expect(top).toHaveAttribute("data-spacer");
    const height = Number.parseFloat((top as HTMLElement).style.height);
    expect(height).toBeGreaterThan(0);
    expect(Number.isInteger(height)).toBe(true);
  });

  it("scrolls to a row on a whole pixel when the rows measure a fraction", () => {
    const rect = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      return this.hasAttribute("data-row") ? new DOMRect(0, 0, 960, 40.3) : rect.call(this);
    });
    const { container } = render(<List />);

    act(() => latest.scrollToIndex(500));

    expect(scrollOf(container).scrollTop).toBeGreaterThan(0);
    expect(Number.isInteger(scrollOf(container).scrollTop)).toBe(true);
  });

  it("holds the list at the height of all its rows, so a commit never shortens it", () => {
    const { container } = render(<List />);
    const list = container.querySelector("[data-row]")?.parentElement as HTMLElement;

    const held = Number.parseFloat(list.style.minHeight);
    expect(held).toBeGreaterThanOrEqual(ROWS * 40 + GAP * (ROWS - 1));
    expect(Number.isInteger(held)).toBe(true);
  });

  it("brings the last row in by scrollToIndex", () => {
    const { container } = render(<List />);
    expect(latest.mounted(ROWS - 1)).toBe(false);
    act(() => latest.scrollToIndex(ROWS - 1));
    expect(container.querySelector(`[data-index="${ROWS - 1}"]`)).not.toBeNull();
  });

  it("adds up to the total height: the rows and the spacers with the gaps", () => {
    const { container } = render(<List pinned={[500]} />);
    const children = Array.from(
      container.querySelector("[data-row]")?.parentElement?.children ?? [],
    );
    const heights = children.map((child) =>
      child.hasAttribute("data-spacer")
        ? Number.parseFloat((child as HTMLElement).style.height)
        : 40,
    );
    const total = heights.reduce((sum, height) => sum + height, 0) + GAP * (children.length - 1);
    expect(total).toBe(ROWS * 40 + GAP * (ROWS - 1));
  });

  it("measures the gap of a list that mounts after the hook", () => {
    const { container, rerender } = render(<List pinned={[500]} show={false} />);
    expect(rowsIn(container)).toHaveLength(0);
    rerender(<List pinned={[500]} show />);
    const children = Array.from(
      container.querySelector("[data-row]")?.parentElement?.children ?? [],
    );
    const heights = children.map((child) =>
      child.hasAttribute("data-spacer")
        ? Number.parseFloat((child as HTMLElement).style.height)
        : 40,
    );
    const total = heights.reduce((sum, height) => sum + height, 0) + GAP * (children.length - 1);
    expect(total).toBe(ROWS * 40 + GAP * (ROWS - 1));
  });
});
