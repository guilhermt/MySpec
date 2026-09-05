import { useEffect } from "react";
import { effectiveMode, THEME_STORAGE_KEY } from "@/features/theme/theme";
import { useThemeState } from "@/store/app-store";

export function useApplyTheme(): void {
  const { preference, systemDark } = useThemeState();
  const mode = effectiveMode(preference, systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
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
