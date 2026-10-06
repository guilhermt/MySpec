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

interface LiveScroller {
  element: HTMLDivElement;
  top: () => number;
  grow: (height: number) => void;
  scrollTop: (top: number) => void;
}

// makeLiveScroller is a scroller whose conversation grows and whose scrollTo moves the scroll,
// clamped to the end as an engine does.
function makeLiveScroller(): LiveScroller {
  const element = document.createElement("div");
  let height = HEIGHT;
  let top = END;
  const clamp = (value: number) => Math.max(0, Math.min(value, height - VIEWPORT));
  Object.defineProperty(element, "scrollHeight", { get: () => height, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: VIEWPORT, configurable: true });
  Object.defineProperty(element, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      top = clamp(value);
    },
    configurable: true,
  });
  Object.defineProperty(element, "scrollTo", {
    value: (options: ScrollToOptions) => {
      top = clamp(options.top ?? top);
    },
    configurable: true,
  });
  return {
    element,
    top: () => top,
    grow: (value) => {
      height = value;
    },
    scrollTop: (value) => {
      element.scrollTop = value;
      act(() => {
        element.dispatchEvent(new Event("scroll"));
      });
    },
  };
}

function mount(
  element: HTMLElement,
  content: HTMLElement = document.createElement("div"),
  follow = true,
) {
  const ref = { current: element };
  const contentRef = { current: content };
  return renderHook(
    ({ deps, keys = ["a"] }: Props) => useAutoScroll(ref, contentRef, deps, keys, follow),
    { initialProps: { deps: [0] as readonly unknown[] } as Props },
  );
}

interface Props {
  deps: readonly unknown[];
  keys?: readonly string[];
}

/**
 * observedResizes records what the hook watches, which the global stub never
 * reports on, and lets the test say when those elements changed size.
 */
function observedResizes() {
  const callbacks: ResizeObserverCallback[] = [];
  const targets: Element[] = [];
  const original = globalThis.ResizeObserver;
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe(target: Element): void {
        targets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  const resize = () => {
    for (const callback of callbacks) {
      callback([], {} as ResizeObserver);
    }
  };
  const restore = () => {
    vi.stubGlobal("ResizeObserver", original);
  };
  return { targets, resize, restore };
}

describe("useAutoScroll", () => {
  it("follows what arrives while the user is at the end", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    rerender({ deps: [1], keys: ["a", "b"] });

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: HEIGHT });
    expect(result.current.newCount).toBe(0);
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
    rerender({ deps: [1], keys: ["a", "b"] });

    expect(scroller.scrollTo).not.toHaveBeenCalled();
    expect(result.current.newCount).toBe(1);
  });

  it("counts the rows born since the reader left the end, a row that grows once", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.scrollTop(0);
    rerender({ deps: [1], keys: ["a", "b"] });
    rerender({ deps: [2], keys: ["a", "b"] });
    rerender({ deps: [3], keys: ["a", "b", "c"] });

    expect(result.current.newCount).toBe(2);
  });

  it("takes the reader back to the end when asked", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.scrollTop(0);
    rerender({ deps: [1], keys: ["a", "b"] });
    act(() => {
      result.current.scrollToBottom();
    });

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: HEIGHT });
    expect(result.current.newCount).toBe(0);
  });

  it("forgets the news once the reader scrolls back to the end", () => {
    const scroller = makeScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.scrollTop(0);
    rerender({ deps: [1], keys: ["a", "b"] });
    scroller.scrollTop(END);

    expect(result.current.newCount).toBe(0);
  });

  it("knows whether the reader is at the end", () => {
    const scroller = makeScroller();
    const { result } = mount(scroller.element);
    expect(result.current.atBottom).toBe(true);

    scroller.scrollTop(0);
    expect(result.current.atBottom).toBe(false);

    scroller.scrollTop(END);
    expect(result.current.atBottom).toBe(true);

    scroller.scrollTop(0);
    act(() => {
      result.current.scrollToBottom();
    });
    expect(result.current.atBottom).toBe(true);
  });

  it("reports nothing new when the reader scrolls up and nothing arrives", () => {
    const scroller = makeScroller();
    const { result } = mount(scroller.element);

    scroller.scrollTop(0);

    expect(result.current.newCount).toBe(0);
    expect(result.current.atBottom).toBe(false);
  });

  it("watches the size of the scroller and of the conversation", () => {
    const { targets, restore } = observedResizes();
    try {
      const scroller = makeScroller();
      const content = document.createElement("div");
      mount(scroller.element, content);

      expect(targets).toEqual([scroller.element, content]);
    } finally {
      restore();
    }
  });

  it("keeps the reader at the end when the conversation changes size", () => {
    const { resize, restore } = observedResizes();
    try {
      const scroller = makeScroller();
      mount(scroller.element);

      act(resize);

      expect(scroller.scrollTo).toHaveBeenCalledWith({ top: HEIGHT });
    } finally {
      restore();
    }
  });

  it("leaves the scroll alone when the conversation changes size above the reader", () => {
    const { resize, restore } = observedResizes();
    try {
      const scroller = makeScroller();
      mount(scroller.element);

      scroller.scrollTop(0);
      act(resize);

      expect(scroller.scrollTo).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("keeps following when the engine reports its own scroll to the end a little above where it went", () => {
    const scroller = makeLiveScroller();
    const { result, rerender } = mount(scroller.element);

    scroller.grow(2000);
    rerender({ deps: [1], keys: ["a", "b"] });
    expect(scroller.top()).toBe(1900);
    // WebKitGTK lands 14px above the end it was asked for, of a list a commit measured shorter for
    // a moment, and the list grows again before the scroll event arrives.
    scroller.grow(2100);
    scroller.scrollTop(1886);

    expect(scroller.top()).toBe(2000);
    expect(result.current.atBottom).toBe(true);
  });

  it("stops following at the first turn of the wheel up from an end the reader scrolled back to", () => {
    const scroller = makeLiveScroller();
    const { result, rerender } = mount(scroller.element);

    rerender({ deps: [1], keys: ["a", "b"] });
    scroller.scrollTop(0);
    scroller.grow(3000);
    rerender({ deps: [2], keys: ["a", "b", "c"] });
    // The bar dragged to the end of the conversation that grew while the reader was away.
    scroller.scrollTop(2900);
    expect(result.current.atBottom).toBe(true);
    scroller.scrollTop(2811);
    scroller.grow(3200);
    rerender({ deps: [3], keys: ["a", "b", "c", "d"] });

    expect(scroller.top()).toBe(2811);
    expect(result.current.atBottom).toBe(false);
    expect(result.current.newCount).toBe(1);
  });

  it("does nothing without an element to scroll", () => {
    const ref = { current: null };
    const contentRef = { current: null };
    const { result, rerender } = renderHook(
      ({ deps }: { deps: readonly unknown[] }) => useAutoScroll(ref, contentRef, deps, []),
      { initialProps: { deps: [0] as readonly unknown[] } },
    );

    rerender({ deps: [1] });
    act(() => {
      result.current.scrollToBottom();
    });

    expect(result.current.newCount).toBe(0);
  });

  it("never scrolls a conversation it does not follow, and never offers the end", () => {
    const { resize, restore } = observedResizes();
    try {
      const scroller = makeScroller();
      const { result, rerender } = mount(scroller.element, document.createElement("div"), false);

      scroller.scrollTop(0);
      rerender({ deps: [1], keys: ["a", "b"] });
      act(resize);

      expect(scroller.scrollTo).not.toHaveBeenCalled();
      expect(result.current).toMatchObject({ atBottom: true, newCount: 0 });
    } finally {
      restore();
    }
  });
});
