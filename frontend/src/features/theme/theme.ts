import type { ThemePreference } from "@/lib/wails";

// The same key the inline script in index.html reads before the first paint.
export const THEME_STORAGE_KEY = "myspec.theme";

export type Mode = "light" | "dark";

export function effectiveMode(preference: ThemePreference, systemDark: boolean): Mode {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
}
