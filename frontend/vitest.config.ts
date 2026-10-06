import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: false,
      environment: "jsdom",
      // vmForks builds jsdom once per worker and gives each file a fresh VM context over it, where
      // forks builds jsdom again for each of the 200-odd files, a third of the run.
      pool: "vmForks",
      // A VM context of the vm pools leaks what its modules hold, so a worker is recycled past this.
      // The default, the machine memory over the workers, sits above the heap Node gives a worker on
      // a small runner, and the worker dies before it is recycled.
      vmMemoryLimit: "1GB",
      css: false,
      setupFiles: ["src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
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
    },
  }),
);
