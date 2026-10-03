import { History, Settings } from "lucide-react";
import { Button } from "@/components/system/Button";
import { IconButton } from "@/components/system/IconButton";
import { Tooltip } from "@/components/system/Tooltip";
import { ThemeButton } from "@/features/sidebar/ThemeButton";
import { cn } from "@/lib/utils";
import {
  useAppStore,
  useDiscussionHistory,
  useHistory,
  useHistoryUi,
  useReviewHistory,
  useSettingsUi,
} from "@/store/app-store";

export interface SidebarFooterProps {
  /** rail stacks the three as icon buttons, for the collapsed strip. */
  rail?: boolean;
}

/** SETTINGS_SHORTCUT is the key that opens and closes the settings. */
const SETTINGS_SHORTCUT = "Ctrl+,";

/** CURRENT marks the button of the place on screen, besides the tint of aria-pressed. */
const CURRENT = "shadow-[inset_0_0_0_var(--border)_var(--brand-marker-ring)]";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** archivedText is what History says of the archive: `44 archived: 22 tasks, 12 reviews, 10 discussions`. */
function archivedText(tasks: number, reviews: number, discussions: number): string {
  const total = tasks + reviews + discussions;
  return `${total} archived: ${plural(tasks, "task")}, ${plural(reviews, "review")}, ${plural(discussions, "discussion")}`;
}

/**
 * SidebarFooter is the way into History, with the count of what is archived,
 * the theme, and Settings. History and Settings stay pressed while their place
 * is on screen, History also with an archived item.
 */
export function SidebarFooter({ rail = false }: SidebarFooterProps) {
  const tasks = useHistory().length;
  const reviews = useReviewHistory().length;
  const discussions = useDiscussionHistory().length;
  const { historyOpen } = useHistoryUi();
  const { settingsOpen } = useSettingsUi();
  const openHistory = useAppStore((state) => state.openHistory);
  const openSettings = useAppStore((state) => state.openSettings);
  const closeSettings = useAppStore((state) => state.closeSettings);

  const total = tasks + reviews + discussions;
  const archived = total > 0 ? archivedText(tasks, reviews, discussions) : null;
  const current = (open: boolean) =>
    open ? { pressed: true, "aria-current": "page" as const } : { pressed: false };
  const toggleSettings = () => (settingsOpen ? closeSettings() : openSettings(undefined, null));

  if (rail) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-(--space-1) py-(--space-2) shadow-[inset_0_var(--border)_0_var(--sidebar-line)]">
        <IconButton
          label={archived === null ? "History" : `History · ${archived}`}
          icon={History}
          size="sm"
          {...current(historyOpen)}
          onClick={() => openHistory()}
          className={cn(historyOpen && CURRENT)}
        />
        <ThemeButton />
        <IconButton
          label="Settings"
          icon={Settings}
          size="sm"
          shortcut={SETTINGS_SHORTCUT}
          {...current(settingsOpen)}
          onClick={toggleSettings}
          className={cn(settingsOpen && CURRENT)}
        />
      </div>
    );
  }

  const history = (
    <Button
      variant="ghost"
      size="sm"
      icon={History}
      {...current(historyOpen)}
      onClick={() => openHistory()}
      className={cn("group/history", historyOpen && CURRENT)}
    >
      History
      {archived !== null && " "}
      {archived !== null && (
        // The count steps up to the third ink on the pressed button, whose veil the fourth does
        // not reach 4.5:1 over.
        <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-4 tabular-nums group-active/history:text-ink-3">
          {total}
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex h-(--size-head) shrink-0 items-center gap-(--space-1) px-(--space-2) shadow-[inset_0_var(--border)_0_var(--sidebar-line)]">
      {archived === null ? history : <Tooltip content={archived}>{history}</Tooltip>}
      <span className="flex-1" />
      <ThemeButton />
      <Tooltip content="Settings" shortcut={SETTINGS_SHORTCUT}>
        <Button
          variant="ghost"
          size="sm"
          icon={Settings}
          {...current(settingsOpen)}
          onClick={toggleSettings}
          className={cn(settingsOpen && CURRENT)}
        >
          Settings
        </Button>
      </Tooltip>
    </div>
  );
}
