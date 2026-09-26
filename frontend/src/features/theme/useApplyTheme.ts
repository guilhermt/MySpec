import { useEffect } from "react";
import type { Mode } from "@/features/theme/theme";
import { effectiveMode, THEME_STORAGE_KEY } from "@/features/theme/theme";
import { useThemeState } from "@/store/app-store";

/** useEffectiveMode is the mode the interface is painted in right now. */
export function useEffectiveMode(): Mode {
  const { preference, systemDark } = useThemeState();
  return effectiveMode(preference, systemDark);
}

export function useApplyTheme(): void {
  const mode = useEffectiveMode();

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    try {
      // Remembered only so the next launch paints the right colours before React
      // runs; the preference itself lives in the app database.
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable; the applied mode is what matters.
    }
  }, [mode]);
}
