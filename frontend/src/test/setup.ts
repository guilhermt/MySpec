import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
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

// Only the boundary is replaced; the pure helpers of lib/wails stay real.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...wailsMock,
}));

afterEach(() => {
  cleanup();
  wailsMock.resetWailsMock();
});
