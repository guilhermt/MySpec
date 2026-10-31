import { useEffect, useSyncExternalStore } from "react";
import type { Mode } from "@/features/theme/theme";
import {
  effectiveMode,
  paintedMode,
  paintMode,
  subscribePaint,
  writeStoredPreference,
} from "@/features/theme/theme";
import { useAppStore, useThemeState } from "@/store/app-store";

/** useEffectiveMode is the mode the state asks for, which useApplyTheme takes to the screen. */
export function useEffectiveMode(): Mode {
  const { preference, systemDark } = useThemeState();
  return effectiveMode(preference, systemDark);
}

/** usePaintedMode is the mode on the screen, which before the first state may not be the mode of the state. */
export function usePaintedMode(): Mode {
  return useSyncExternalStore(subscribePaint, paintedMode);
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
