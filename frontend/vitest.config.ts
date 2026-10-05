import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import { emulateReducedMotion } from "./src/test/browser-commands.ts";
import viteConfig from "./vite.config.ts";

/** PAINTED holds the computed-style tests, which run in Chromium with the real CSS. */
const PAINTED = "src/**/*.painted.test.{ts,tsx}";

/**
 * SWEEP is the width sweep, which MYSPEC_SKIP_SWEEP=1 leaves out of the painted suite: task test:web
 * sets it, since --changed reaches the sweep through any component, and the CI runs it in full. A
 * --exclude on the command line does not reach the projects, so the choice lives here.
 */
const SWEEP = "src/**/*.widths.painted.test.tsx";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: false,
      // A VM context of the vm pools leaks what its modules hold, so a worker is recycled past this.
      // The default, the machine memory over the workers, sits above the heap Node gives a worker on
      // a small runner, and the worker dies before it is recycled. Vitest reads it only here, at the
      // root, never from a project.
      vmMemoryLimit: "1GB",
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        reportOnFailure: true,
        include: ["src/**"],
        exclude: [
          "src/components/ui/**",
          "src/test/**",
          "src/dev/**",
          "src/main.tsx",
          "src/**/*.test.{ts,tsx}",
        ],
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
              "@streamdown/code",
              "@streamdown/mermaid",
              "@tanstack/react-virtual",
              "diff",
              "react-dom/client",
              "streamdown",
            ],
            force: true,
          },
          test: {
            name: "painted",
            include: [PAINTED],
            exclude: process.env.MYSPEC_SKIP_SWEEP === "1" ? [SWEEP] : [],
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
              commands: { emulateReducedMotion },
              instances: [{ browser: "chromium" }],
              viewport: { width: 1280, height: 800 },
            },
          },
        },
      ],
    },
  }),
);
