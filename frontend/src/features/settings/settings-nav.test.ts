import { describe, expect, it } from "vitest";
import { makeRepository } from "@/test/wails-mock";
import {
  missingClones,
  missingText,
  nextPage,
  pageOf,
  SETTINGS_PAGES,
  type SettingsPage,
} from "./settings-nav";

describe("SETTINGS_PAGES", () => {
  it("lists the four pages in the order of the navigation", () => {
    expect(SETTINGS_PAGES.map(({ label }) => label)).toEqual([
      "Defaults",
      "Boards",
      "Repositories",
      "Prompts",
    ]);
  });
});

describe("pageOf", () => {
  it.each([
    ["defaults", "defaults"],
    ["boards", "boards"],
    ["repositories", "repositories"],
    ["prompts", "prompts"],
    ["prd", "prompts"],
    ["commit", "prompts"],
    ["discussion", "prompts"],
  ] as const)("puts the section %s on the page %s", (section, page) => {
    expect(pageOf(section)).toBe(page);
  });
});

describe("missingClones", () => {
  it("names only the repositories whose clone is missing", () => {
    const repositories = [
      makeRepository({ id: "a", fullName: "acme/api" }),
      makeRepository({ id: "b", fullName: "acme/infra", missing: true }),
      makeRepository({ id: "c", fullName: "acme/web", cloned: false, path: "" }),
      makeRepository({ id: "d", fullName: "acme/tools", missing: true }),
    ];

    expect(missingClones(repositories)).toEqual(["acme/infra", "acme/tools"]);
  });

  it("names none when every clone is there or was never made", () => {
    expect(missingClones([makeRepository({ cloned: false, path: "" })])).toEqual([]);
  });
});

describe("missingText", () => {
  it.each([
    [["acme/infra"], "The clone of acme/infra is missing"],
    [
      ["acme/infra", "acme/tools"],
      "The clones of 2 repositories are missing: acme/infra, acme/tools",
    ],
  ])("says %j", (names, text) => {
    expect(missingText(names)).toBe(text);
  });
});

describe("nextPage", () => {
  it.each<[SettingsPage, string, boolean, SettingsPage | null]>([
    ["defaults", "ArrowDown", false, "boards"],
    ["boards", "ArrowDown", false, "repositories"],
    ["prompts", "ArrowDown", false, null],
    ["boards", "ArrowUp", false, "defaults"],
    ["defaults", "ArrowUp", false, null],
    ["repositories", "Home", false, "defaults"],
    ["defaults", "Home", false, null],
    ["boards", "End", false, "prompts"],
    ["prompts", "End", false, null],
    ["boards", "ArrowRight", false, null],
    ["boards", "ArrowLeft", false, null],
    ["boards", "ArrowRight", true, "repositories"],
    ["boards", "ArrowLeft", true, "defaults"],
    ["prompts", "ArrowRight", true, null],
    ["defaults", "ArrowLeft", true, null],
    ["boards", "Enter", true, null],
  ])("from %s with %s (inline %s) opens %s", (page, key, inline, expected) => {
    expect(nextPage(page, key, inline)).toBe(expected);
  });
});
