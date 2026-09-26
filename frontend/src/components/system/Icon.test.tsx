import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Icon } from "./Icon";
import { ICONS } from "./icons";

describe("Icon", () => {
  it("is hidden from assistive technology", () => {
    const { container } = renderWithStore(<Icon icon={ICONS.done} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["md", "size-(--icon)"],
    ["sm", "size-(--icon-sm)"],
    ["xs", "size-(--icon-xs)"],
  ] as const)("applies the %s size", (size, cls) => {
    const { container } = renderWithStore(<Icon icon={ICONS.done} size={size} />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it.each([
    ["muted", "text-ink-3"],
    ["active", "text-brand-ink"],
  ] as const)("applies the %s tone", (tone, cls) => {
    const { container } = renderWithStore(<Icon icon={ICONS.done} tone={tone} />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it("maps each meaning to a different icon", () => {
    expect(new Set(Object.values(ICONS)).size).toBe(Object.keys(ICONS).length);
  });

  it("is the one source of a mapped icon in the system components", () => {
    const mapped = new Set<unknown>(Object.values(ICONS));
    const icons = lucide as unknown as Record<string, unknown>;
    const files = readdirSync(import.meta.dirname).filter(
      (file) => /\.tsx?$/.test(file) && !/\.test\./.test(file) && file !== "icons.ts",
    );
    const bypassing = files.flatMap((file) => {
      const text = readFileSync(join(import.meta.dirname, file), "utf8");
      const names = /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(text)?.[1] ?? "";
      return names
        .split(",")
        .map((name) => name.replace(/^\s*type\s+/, "").trim())
        .filter((name) => name !== "" && mapped.has(icons[name]))
        .map((name) => `${file}: ${name}`);
    });

    expect(files.length).toBeGreaterThan(0);
    expect(bypassing).toEqual([]);
  });
});
