import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import { effectiveMode, paintMode } from "@/features/theme/theme";
import type { ThemePreference } from "@/lib/wails";
import { setTheme } from "@/store/actions";
import { useAppStore, useThemeState } from "@/store/app-store";

/** THEME_WORDS name each theme as the button says it. */
const THEME_WORDS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** NEXT_THEME is the cycle a click walks: System, Light, Dark, and System again. */
const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/**
 * ThemeButton is the one place of the theme: a fixed icon whose name and
 * tooltip say the theme, and a click that moves to the next one at once, before the first state
 * included.
 */
export function ThemeButton() {
  const { preference, systemDark } = useThemeState();
  const started = useAppStore((state) => state.app !== null);
  const chooseStartupTheme = useAppStore((state) => state.chooseStartupTheme);
  const label = `Theme: ${THEME_WORDS[preference]}`;

  return (
    <Tooltip content={`${label} · click to change`}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        onClick={() => {
          const next = NEXT_THEME[preference];
          if (started) {
            void setTheme(next);
            return;
          }
          // The database is not open yet: the choice is painted now and sent with the first state.
          chooseStartupTheme(next);
          paintMode(effectiveMode(next, systemDark));
        }}
        className="w-(--size-control-sm) px-0"
      >
        <Icon icon={ICONS.theme} size="sm" />
      </Button>
    </Tooltip>
  );
}
