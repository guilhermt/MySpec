import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFits, useWidth } from "./useFits";

let notify: ResizeObserverCallback = () => {};
const observed: Element[] = [];

beforeEach(() => {
  observed.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback;
      }
      observe(element: Element) {
        observed.push(element);
      }
      unobserve(element: Element) {
        observed.splice(observed.indexOf(element), 1);
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function resize(element: Element) {
  act(() => notify([{ target: element } as ResizeObserverEntry], {} as ResizeObserver));
}

function Probe({ content }: { content: string }) {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const fits = useFits(box, measure, content);
  const width = useWidth(box);
  return (
    <div ref={box} data-testid="box">
      <span ref={measure}>{content}</span>
      <output>{`${fits ? "fits" : "overflows"} ${width}`}</output>
    </div>
  );
}

describe("useFits and useWidth", () => {
  it("fits with no layout, as in jsdom", () => {
    const { container } = render(<Probe content="Implementing · Step 3/7" />);
    expect(container.querySelector("output")).toHaveTextContent("fits 0");
  });

  it("measures again when the box resizes", () => {
    const { container, getByTestId } = render(<Probe content="Implementing · Step 3/7" />);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(120);

    resize(getByTestId("box"));

    expect(container.querySelector("output")).toHaveTextContent("overflows 120");
  });

  it("shares one observation of an element among its hooks and lets it go on unmount", () => {
    const { unmount } = render(<Probe content="Step 3/7" />);
    expect(observed).toHaveLength(1);

    unmount();

    expect(observed).toHaveLength(0);
  });
});
