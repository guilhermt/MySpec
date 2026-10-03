import type { IconMeaning } from "@/components/system/icons";
import type { SettingsSection } from "@/lib/locations";
import type { Repository } from "@/lib/wails";

export type SettingsPage = "defaults" | "boards" | "repositories" | "prompts";

/** SETTINGS_PAGES are the pages in the order of the navigation, with their names and icons' meanings. */
export const SETTINGS_PAGES: readonly { page: SettingsPage; label: string; icon: IconMeaning }[] = [
  { page: "defaults", label: "Defaults", icon: "defaults" },
  { page: "boards", label: "Boards", icon: "board" },
  { page: "repositories", label: "Repositories", icon: "repository" },
  { page: "prompts", label: "Prompts", icon: "prompt" },
];

/** pageOf is the page a section belongs to: a prompt is on the page Prompts. */
export function pageOf(section: SettingsSection): SettingsPage {
  switch (section) {
    case "defaults":
    case "boards":
    case "repositories":
      return section;
    default:
      return "prompts";
  }
}

/** missingClones are the repositories whose clone is missing, by owner/name. One without a clone is not missing one. */
export function missingClones(repositories: readonly Repository[]): string[] {
  return repositories.filter((repository) => repository.missing).map(({ fullName }) => fullName);
}

/** missingText is the tooltip and the description of ◇ N: "The clone of acme/infra is missing", … */
export function missingText(names: readonly string[]): string {
  const [only] = names;
  if (names.length === 1 && only !== undefined) {
    return `The clone of ${only} is missing`;
  }
  return `The clones of ${names.length} repositories are missing: ${names.join(", ")}`;
}

/** nextPage is the page an arrow key opens, null at an end (no wrap). */
export function nextPage(page: SettingsPage, key: string, inline: boolean): SettingsPage | null {
  const index = SETTINGS_PAGES.findIndex((entry) => entry.page === page);
  const last = SETTINGS_PAGES.length - 1;
  let target: number;
  switch (key) {
    case "ArrowDown":
      target = index + 1;
      break;
    case "ArrowUp":
      target = index - 1;
      break;
    case "ArrowRight":
      target = inline ? index + 1 : index;
      break;
    case "ArrowLeft":
      target = inline ? index - 1 : index;
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = last;
      break;
    default:
      return null;
  }
  if (target === index || target < 0 || target > last) {
    return null;
  }
  return SETTINGS_PAGES[target]?.page ?? null;
}
