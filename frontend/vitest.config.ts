import { resolve } from "node:path";
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
            // vmForks builds jsdom once per worker and gives each file a fresh VM context over it,
            // where forks builds jsdom again for each of the 200-odd files, a third of the run.
            pool: "vmForks",
            css: false,
            setupFiles: ["src/test/setup.ts"],
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: [PAINTED],
          },
        },
        {
          extends: true,
          // A dependency Vite finds halfway through the run reloads the page, which loads React a
          // second time and breaks the suite that was loading. The scan of the entries does not
          // reach the painted tests in browser mode, so the dependencies they pull in through the
          // feature components are prebundled by name.
          optimizeDeps: {
            entries: [PAINTED],
            include: [
              "@base-ui/react/toggle-group",
              "@streamdown/code",
              "@streamdown/mermaid",
              "diff",
              "react-dom/client",
              "react-resizable-panels",
              "streamdown",
            ],
            force: true,
          },
          test: {
            name: "painted",
            include: [PAINTED],
            // capture saves the screenshots of the pull request here, only when asked to.
            provide: {
              captureDir:
                process.env.MYSPEC_CAPTURES === "1" ? resolve(import.meta.dirname, "captures") : "",
            },
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
