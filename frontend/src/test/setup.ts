import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, vi } from "vitest";
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
  }: {
    children: string;
    className?: string;
    shikiTheme?: readonly (string | { name?: string })[];
  }) =>
    createElement(
      "div",
      {
        "data-testid": "markdown",
        className,
        "data-shiki-theme": shikiTheme
          ?.map((theme) => (typeof theme === "string" ? theme : theme.name))
          .join(" "),
      },
      children,
    ),
}));
vi.mock("@streamdown/code", () => ({ code: {} }));
vi.mock("@streamdown/mermaid", () => ({ createMermaidPlugin: () => ({}) }));

// jsdom lays nothing out and ships no ResizeObserver, which the resizable
// panels watch their group with.
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
