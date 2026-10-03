import { useEffect } from "react";
import type { Mode } from "@/features/theme/theme";
import { effectiveMode, paintMode, writeStoredPreference } from "@/features/theme/theme";
import { useAppStore, useThemeState } from "@/store/app-store";

/** useEffectiveMode is the mode the interface is painted in right now. */
export function useEffectiveMode(): Mode {
  const { preference, systemDark } = useThemeState();
  return effectiveMode(preference, systemDark);
}

/**
 * useApplyTheme paints the mode of the state. Before the first state it paints nothing: what
 * index.html applied stands, and the theme button of the start paints a choice itself.
 */
export function useApplyTheme(): void {
  const mode = useEffectiveMode();
  const { preference } = useThemeState();
  const started = useAppStore((state) => state.app !== null);

  useEffect(() => {
    if (!started) {
      return;
    }
    paintMode(mode);
    writeStoredPreference(preference);
  }, [started, mode, preference]);
}
