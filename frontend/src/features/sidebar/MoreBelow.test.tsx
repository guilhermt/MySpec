import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoreBelow } from "@/features/sidebar/MoreBelow";

// A viewport whose bottom is at 100px, with lines at the given tops.
function Subject({ tops }: { tops: number[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewport} data-testid="viewport" data-bottom="100">
      <div>
        {tops.map((top) => (
          <div key={top} data-entry-id={`line-${top}`} data-top={top} />
        ))}
      </div>
      <MoreBelow viewport={viewport} />
    </div>
  );
}

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 0,
    width: 0,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

// The viewport reads its bottom and each line its top from their data attributes, shifted by
// how far the viewport has scrolled.
function layOut() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const viewport = this.closest<HTMLElement>("[data-testid=viewport]");
    const scrolled = viewport?.scrollTop ?? 0;
    if (this.dataset.bottom !== undefined) {
      return rect(0, Number(this.dataset.bottom));
    }
    const top = Number(this.dataset.top ?? 0) - scrolled;
    return rect(top, top + 20);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MoreBelow", () => {
  it("counts the lines below the fold", () => {
    layOut();
    render(<Subject tops={[0, 40, 80, 120, 160]} />);

    expect(screen.getByRole("button", { name: "2 more below" })).toHaveAttribute("tabindex", "-1");
  });

  it("is gone with nothing below", () => {
    layOut();
    render(<Subject tops={[0, 40, 80]} />);

    expect(screen.queryByRole("button", { name: /more below/ })).not.toBeInTheDocument();
  });

  it("counts again as the tree scrolls", () => {
    layOut();
    render(<Subject tops={[0, 40, 80, 120, 160]} />);
    const viewport = screen.getByTestId("viewport");

    act(() => {
      viewport.scrollTop = 30;
      fireEvent.scroll(viewport);
    });

    expect(screen.getByRole("button", { name: "1 more below" })).toBeInTheDocument();
  });

  it("scrolls to the end on a click", () => {
    layOut();
    render(<Subject tops={[0, 40, 80, 120, 160]} />);
    const viewport = screen.getByTestId("viewport");
    vi.spyOn(viewport, "scrollHeight", "get").mockReturnValue(180);

    fireEvent.click(screen.getByRole("button", { name: "2 more below" }));

    expect(viewport.scrollTop).toBe(180);
  });
});
