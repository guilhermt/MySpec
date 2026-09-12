import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore, useSettingsUi } from "@/store/app-store";

/** SettingsButton opens and closes the settings, at the foot of the sidebar. */
export function SettingsButton() {
  const { settingsOpen } = useSettingsUi();
  const openSettings = useAppStore((state) => state.openSettings);
  const closeSettings = useAppStore((state) => state.closeSettings);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label="Settings"
        aria-pressed={settingsOpen}
        onClick={() => (settingsOpen ? closeSettings() : openSettings())}
        className={cn(settingsOpen && "bg-accent text-accent-foreground")}
      >
        <Settings />
      </TooltipTrigger>
      <TooltipContent>
        Settings <Kbd>Ctrl ,</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
