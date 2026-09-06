import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoScroll } from "@/features/chat/useAutoScroll";

const HEIGHT = 1000;
const VIEWPORT = 100;
const END = HEIGHT - VIEWPORT;

interface Scroller {
  element: HTMLDivElement;
  scrollTo: ReturnType<typeof vi.fn>;
  scrollTop: (top: number) => void;
}

// jsdom lays nothing out, so the element is given the geometry of a
// conversation taller than the space it is read in.
function makeScroller(): Scroller {
  const element = document.createElement("div");
  const scrollTo = vi.fn<(options: ScrollToOptions) => void>();
  let top = END;
  Object.defineProperty(element, "scrollHeight", { value: HEIGHT, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: VIEWPORT, configurable: true });
  Object.defineProperty(element, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      top = value;
    },
    configurable: true,
  });
  Object.defineProperty(element, "scrollTo", { value: scrollTo, configurable: true });
  return {
    element,
    scrollTo,
    scrollTop: (value) => {
      element.scrollTop = value;
      act(() => {
        element.dispatchEvent(new Event("scroll"));
      });
    },
  };
}

function mount(element: HTMLElement) {
  const ref = { current: element };
  return renderHook(({ deps }: { deps: readonly unknown[] }) => useAutoScroll(ref, deps), {
    initialProps: { deps: [0] as readonly unknown[] },
  });
}

describe("useAutoScroll", () => {
  it("follows what arrives while the user is at the end", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    rerender({ deps: [1] });

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: HEIGHT });
    expect(result.current.hasNew).toBe(false);
  });

  it("scrolls nothing while the deps stay the same", () => {
    const scroller = makeScroller();
    const { rerender } = mount(scroller.element);

    rerender({ deps: [0] });

    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });

  it("leaves the scroll alone for a user reading further up", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.scrollTop(0);
    rerender({ deps: [1] });

    expect(scroller.scrollTo).not.toHaveBeenCalled();
    expect(result.current.hasNew).toBe(true);
  });

  it("takes the reader back to the end when asked", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.scrollTop(0);
    rerender({ deps: [1] });
    act(() => {
      result.current.scrollToBottom();
    });

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: HEIGHT });
    expect(result.current.hasNew).toBe(false);
  });

  it("forgets the news once the reader scrolls back to the end", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.scrollTop(0);
    rerender({ deps: [1] });
    scroller.scrollTop(END);

    expect(result.current.hasNew).toBe(false);
  });

  it("does nothing without an element to scroll", () => {
    const ref = { current: null };
    const { result, rerender } = renderHook(
      ({ deps }: { deps: readonly unknown[] }) => useAutoScroll(ref, deps),
      { initialProps: { deps: [0] as readonly unknown[] } },
    );

    rerender({ deps: [1] });
    act(() => {
      result.current.scrollToBottom();
    });

    expect(result.current.hasNew).toBe(false);
  });
});
