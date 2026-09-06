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
// only the text of the Markdown matters, so the renderer is reduced to it.
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: string }) =>
    createElement("div", { "data-testid": "markdown" }, children),
}));
vi.mock("@streamdown/code", () => ({ code: {} }));
vi.mock("@streamdown/mermaid", () => ({ createMermaidPlugin: () => ({}) }));

// Only the boundary is replaced; the pure helpers of lib/wails stay real.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...wailsMock,
}));

afterEach(() => {
  cleanup();
  wailsMock.resetWailsMock();
});
