import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWidth } from "./useFits";

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

function Probe() {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  return (
    <div ref={box} data-testid="box">
      <output>{width}</output>
    </div>
  );
}

describe("useWidth", () => {
  it("is 0 with no layout, as in jsdom", () => {
    const { container } = render(<Probe />);
    expect(container.querySelector("output")).toHaveTextContent("0");
  });

  it("measures again when the element resizes", () => {
    const { container, getByTestId } = render(<Probe />);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(120);

    resize(getByTestId("box"));

    expect(container.querySelector("output")).toHaveTextContent("120");
  });

  it("lets the observation of its element go on unmount", () => {
    const { unmount } = render(<Probe />);
    expect(observed).toHaveLength(1);

    unmount();

    expect(observed).toHaveLength(0);
  });
});
