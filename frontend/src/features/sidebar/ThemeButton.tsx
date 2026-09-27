import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import type { ThemePreference } from "@/lib/wails";
import { setTheme } from "@/store/actions";
import { useThemeState } from "@/store/app-store";

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
 * tooltip say the theme, and a click that moves to the next one at once.
 */
export function ThemeButton() {
  const { preference } = useThemeState();
  const label = `Theme: ${THEME_WORDS[preference]}`;

  return (
    <Tooltip content={`${label} · click to change`}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        onClick={() => void setTheme(NEXT_THEME[preference])}
        className="w-(--size-control-sm) px-0"
      >
        <Icon icon={ICONS.theme} size="sm" />
      </Button>
    </Tooltip>
  );
}
