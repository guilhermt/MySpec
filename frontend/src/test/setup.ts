import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { type ComponentType, createElement, type ReactNode } from "react";
import { afterEach, vi } from "vitest";
import { WINDOW_VIEWPORT } from "@/components/system/useWindowedRows";
import { installIntersectionObserver } from "./intersection";
import * as wailsMock from "./wails-mock";

// The runtime talks to a native host that does not exist under jsdom, and it
// logs a warning as soon as it loads.
vi.mock("@wailsio/runtime", () => ({
  Browser: { OpenURL: vi.fn(() => Promise.resolve()) },
  Call: { ByID: vi.fn(() => Promise.resolve()) },
  CancellablePromise: Promise,
  Events: { On: vi.fn(() => vi.fn()) },
}));

// Shiki and mermaid need a browser to load their grammars and draw; under jsdom
// only the text, the classes and the code themes of the Markdown matter, so the
// renderer is reduced to them.
vi.mock("streamdown", () => ({
  Streamdown: ({
    children,
    className,
    shikiTheme,
    lineNumbers,
    controls,
    components,
  }: {
    children: string;
    className?: string;
    shikiTheme?: readonly (string | { name?: string })[];
    lineNumbers?: boolean;
    controls?: { code?: { copy?: boolean } };
    components?: { inlineCode?: ComponentType<{ children?: ReactNode }> };
  }) =>
    createElement(
      "div",
      {
        "data-testid": "markdown",
        className,
        "data-shiki-theme": shikiTheme
          ?.map((theme) => (typeof theme === "string" ? theme : theme.name))
          .join(" "),
        "data-line-numbers": String(lineNumbers ?? true),
        "data-code-copy": String(controls?.code?.copy ?? true),
      },
      // The inline code of the text goes through the component the caller gave for it.
      components?.inlineCode === undefined
        ? children
        : children
            .split(/`([^`\n]+)`/)
            .map((piece, at) =>
              at % 2 === 1 && components.inlineCode !== undefined
                ? createElement(components.inlineCode, { key: at }, piece)
                : piece,
            ),
    ),
}));
vi.mock("@streamdown/code", () => ({ code: {} }));
vi.mock("@streamdown/mermaid", () => ({ createMermaidPlugin: () => ({}) }));

// jsdom lays nothing out and ships no ResizeObserver, which the conversation's end, the toast lift
// and the windowed lists watch.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// Base UI closes its popups only after their exit animation has finished; jsdom
// paints nothing, so the flag it reads for tests keeps that synchronous.
vi.stubGlobal("BASE_UI_ANIMATIONS_DISABLED", true);

// jsdom implements no Web Animations API, and the scroll area asks its viewport
// what is animating as soon as it is measured.
Object.defineProperty(Element.prototype, "getAnimations", {
  value: () => [],
  writable: true,
  configurable: true,
});

// jsdom implements no scrolling, and the conversation scrolls to its end
// whenever an observer reports that it changed size.
Object.defineProperty(Element.prototype, "scrollTo", {
  value: () => {},
  writable: true,
  configurable: true,
});

// The :focus-visible heuristic of jsdom keeps state from one test to the next, so the tests read the
// rule a browser applies to a focus that is not in a text field: visible after a key press, not
// after a pointer press or a programmatic focus.
let keyboardFocus = false;
document.addEventListener(
  "keydown",
  () => {
    keyboardFocus = true;
  },
  true,
);
document.addEventListener(
  "pointerdown",
  () => {
    keyboardFocus = false;
  },
  true,
);
const matches = Element.prototype.matches;
Object.defineProperty(Element.prototype, "matches", {
  value(this: Element, selector: string): boolean {
    if (selector === ":focus-visible") return this === document.activeElement && keyboardFocus;
    return matches.call(this, selector);
  },
  writable: true,
  configurable: true,
});

// Only the boundary is replaced; the pure helpers of lib/wails stay real.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...wailsMock,
}));

afterEach(() => {
  cleanup();
  keyboardFocus = false;
  wailsMock.resetWailsMock();
});

// Nor does it scroll an element into view, which the open row of the tree
// asks for.
Object.defineProperty(Element.prototype, "scrollIntoView", {
  value: () => {},
  writable: true,
  configurable: true,
});

// Nor does it observe what comes into view: the double only says what a test tells it.
installIntersectionObserver();

// jsdom lays nothing out, and a windowed list mounts what its scroll element shows: the element the
// list marks with data-window-viewport is 960 by 600 pixels and scrolls, its rows (data-index) are
// 40 pixels tall, and a test reaches a row beyond the window by the keys, as the user does. Every
// other element keeps the answer jsdom gives.
const VIEWPORT_WIDTH = 960;
const VIEWPORT_HEIGHT = 600;
const ROW_HEIGHT = 40;
const scrolled = new WeakMap<Element, number>();
const isViewport = (element: Element) => element.hasAttribute(WINDOW_VIEWPORT);

function sizeOfViewport(name: "offsetHeight" | "clientHeight" | "offsetWidth" | "clientWidth") {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
  const size = name.endsWith("Height") ? VIEWPORT_HEIGHT : VIEWPORT_WIDTH;
  Object.defineProperty(HTMLElement.prototype, name, {
    get(this: HTMLElement): number {
      return isViewport(this) ? size : ((original?.get?.call(this) as number | undefined) ?? 0);
    },
    configurable: true,
  });
}
for (const name of ["offsetHeight", "clientHeight", "offsetWidth", "clientWidth"] as const) {
  sizeOfViewport(name);
}

// The content of the scroll element is its rows and the spacers (the elements with an inline height)
// between them, which is what the end of the scroll is.
const scrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
Object.defineProperty(Element.prototype, "scrollHeight", {
  get(this: Element): number {
    if (!isViewport(this)) {
      return (scrollHeight?.get?.call(this) as number | undefined) ?? 0;
    }
    let height = 0;
    for (const element of this.querySelectorAll<HTMLElement>("[data-index],[style*='height']")) {
      height += element.hasAttribute("data-index")
        ? ROW_HEIGHT
        : Number.parseFloat(element.style.height) || 0;
    }
    return Math.max(height, VIEWPORT_HEIGHT);
  },
  configurable: true,
});

const scrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
Object.defineProperty(Element.prototype, "scrollTop", {
  get(this: Element): number {
    return isViewport(this)
      ? (scrolled.get(this) ?? 0)
      : ((scrollTop?.get?.call(this) as number) ?? 0);
  },
  set(this: Element, value: number) {
    if (isViewport(this)) {
      scrolled.set(this, value);
    } else {
      scrollTop?.set?.call(this, value);
    }
  },
  configurable: true,
});

const scrollTo = Element.prototype.scrollTo;
Object.defineProperty(Element.prototype, "scrollTo", {
  value(this: Element, ...args: unknown[]) {
    const options = args[0];
    if (!isViewport(this) || typeof options !== "object" || options === null) {
      return (scrollTo as (...a: unknown[]) => void).apply(this, args);
    }
    scrolled.set(this, (options as ScrollToOptions).top ?? 0);
    this.dispatchEvent(new Event("scroll"));
  },
  writable: true,
  configurable: true,
});

const rect = Element.prototype.getBoundingClientRect;
Object.defineProperty(Element.prototype, "getBoundingClientRect", {
  value(this: Element): DOMRect {
    if (this.hasAttribute("data-index") && this.closest(`[${WINDOW_VIEWPORT}]`) !== null) {
      return new DOMRect(0, 0, VIEWPORT_WIDTH, ROW_HEIGHT);
    }
    return rect.call(this);
  },
  writable: true,
  configurable: true,
});

// jsdom answers a pseudo-element with the style of its element and logs that it cannot: the windowed
// lists read the fade under their sticky bar, which has no height here, so the pseudo-element goes unasked.
const computedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element: Element) => computedStyle(element);
