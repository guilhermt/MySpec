import { asThemePreference, type ThemePreference } from "@/lib/wails";

// The same key the inline script in index.html reads before the first paint.
export const THEME_STORAGE_KEY = "myspec.theme";

// THEME_PREFERENCE_KEY holds the preference of the last state, so the theme button of the start
// shows and changes it before the app database is open.
export const THEME_PREFERENCE_KEY = "myspec.theme.preference";

export type Mode = "light" | "dark";

export function effectiveMode(preference: ThemePreference, systemDark: boolean): Mode {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
}

/** readStoredPreference is the preference the last state had, null when none was stored. */
export function readStoredPreference(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    return stored === null ? null : asThemePreference(stored);
  } catch {
    return null;
  }
}

/** writeStoredPreference remembers the preference for the next start. */
export function writeStoredPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Storage can be unavailable; the preference lives in the app database.
  }
}

/** paintMode paints the interface in the mode and remembers it for the next start. */
export function paintMode(mode: Mode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  try {
    // Remembered only so the next launch paints the right colours before React
    // runs; the preference itself lives in the app database.
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable; the applied mode is what matters.
  }
}
