import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

/** PAINTED holds the computed-style tests, which run in Chromium with the real CSS. */
const PAINTED = "src/**/*.painted.test.{ts,tsx}";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: false,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "json-summary", "lcov"],
        reportOnFailure: true,
        include: ["src/**"],
        exclude: ["src/components/ui/**", "src/test/**", "src/main.tsx", "src/**/*.test.{ts,tsx}"],
        thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            css: false,
            setupFiles: ["src/test/setup.ts"],
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: [PAINTED],
          },
        },
        {
          extends: true,
          // Vite scans the painted tests for the dependencies to prebundle on every run, so no
          // dependency found halfway reloads the page and loads React a second time.
          optimizeDeps: { entries: [PAINTED], force: true },
          test: {
            name: "painted",
            include: [PAINTED],
            setupFiles: ["src/test/painted-setup.ts"],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
              viewport: { width: 1280, height: 800 },
            },
          },
        },
      ],
    },
  }),
);
