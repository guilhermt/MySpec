import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      css: false,
      setupFiles: ["src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "json-summary", "lcov"],
        reportOnFailure: true,
        include: ["src/**"],
        exclude: ["src/components/ui/**", "src/test/**", "src/main.tsx", "src/**/*.test.{ts,tsx}"],
        thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
    },
  }),
);
