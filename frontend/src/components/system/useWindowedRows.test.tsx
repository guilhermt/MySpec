import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useWindowedRows, type WindowedRows } from "./useWindowedRows";

const ROWS = 1000;
const OVERSCAN = 5;
const GAP = 4;
// The jsdom stub of test/setup.ts: a scroll element of 600 pixels and rows of 40.
const SHOWN = 600 / 40;

let latest: WindowedRows;

function List({ pinned = [], show = true }: { pinned?: number[]; show?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useWindowedRows({
    count: ROWS,
    keyOf: (index) => `row:${index}`,
    estimate: () => 40,
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
