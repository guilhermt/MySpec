import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { asThemePreference, type ThemePreference } from "@/lib/wails";
import { setTheme } from "@/store/actions";
import { useThemeState } from "@/store/app-store";

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
}

const OPTIONS: readonly ThemeOption[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle() {
  const { preference } = useThemeState();

  return (
    <ToggleGroup
      aria-label="Theme"
      size="sm"
      value={[preference]}
      // Base UI allows unpressing the active item, which would leave no theme
      // selected; the interface keeps the current one instead.
      onValueChange={(next: string[]) => {
        const [value] = next;
        if (value !== undefined) {
          void setTheme(asThemePreference(value));
        }
      }}
      className="w-full"
    >
      {/* The foot of the sidebar also carries the history, so the options go by
          their icons and say their name to the screen reader. */}
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} className="flex-1">
          <Icon aria-hidden="true" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
