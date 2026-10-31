import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS, type IconGlyph } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import { type Mode, paintMode } from "@/features/theme/theme";
import { usePaintedMode } from "@/features/theme/useApplyTheme";
import { setTheme } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** THEME_WORDS name each theme as the button says it. */
const THEME_WORDS: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
};

/** THEME_ICONS draw each theme: the sun for the light one, the moon for the dark one. */
const THEME_ICONS: Record<Mode, IconGlyph> = {
  light: ICONS.themeLight,
  dark: ICONS.themeDark,
};

/**
 * ThemeButton is the one place of the theme: an icon that shows the theme on the screen, with
 * its name and tooltip, and a click that moves to the opposite one at once, before the first
 * state included.
 */
export function ThemeButton() {
  const mode = usePaintedMode();
  const started = useAppStore((state) => state.app !== null);
  const chooseStartupTheme = useAppStore((state) => state.chooseStartupTheme);
  const label = `Theme: ${THEME_WORDS[mode]}`;

  return (
    <Tooltip content={`${label} · click to change`}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        onClick={() => {
          const next: Mode = mode === "dark" ? "light" : "dark";
          if (started) {
            void setTheme(next);
            return;
          }
          // The database is not open yet: the choice is painted now and sent with the first state.
          chooseStartupTheme(next);
          paintMode(next);
        }}
        className="w-(--size-control-sm) px-0"
      >
        <Icon icon={THEME_ICONS[mode]} size="sm" />
      </Button>
    </Tooltip>
  );
}
