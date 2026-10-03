import { useEffect, useRef } from "react";
import { Button } from "@/components/system/Button";
import { Tooltip } from "@/components/system/Tooltip";
import { BoardsPage } from "@/features/boards/BoardsPage";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { RepositoriesPage } from "@/features/repositories/RepositoriesPage";
import { Defaults } from "@/features/settings/Defaults";
import { DiscardChangesDialog } from "@/features/settings/DiscardChangesDialog";
import { PromptPane } from "@/features/settings/PromptPane";
import { PromptsPage } from "@/features/settings/PromptsPage";
import { SettingsNav } from "@/features/settings/SettingsNav";
import { pageOf } from "@/features/settings/settings-nav";
import { locationTitle } from "@/lib/locations";
import { useAppStore, useBackTarget, useSettingsUi } from "@/store/app-store";

/** SettingsView is the settings of the app: the defaults of a new task, the boards, the repositories and the prompts, one page at a time beside their navigation. */
export function SettingsView() {
  const { settingsSection } = useSettingsUi();
  const app = useAppStore((state) => state.app);
  const closeSettings = useAppStore((state) => state.closeSettings);
  const backTarget = useBackTarget();
  const body = useRef<HTMLDivElement>(null);
  const page = pageOf(settingsSection);

  // A page opens at its top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page is the trigger.
  useEffect(() => {
    if (body.current !== null) {
      body.current.scrollTop = 0;
    }
  }, [page]);

  const closeTip =
    backTarget === null
      ? "Close Settings · Esc"
      : `Close Settings and go back to ${locationTitle(app, backTarget)} · Esc`;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1 text-ink-1">
      <LocationHeader>
        <Tooltip content={closeTip}>
          <Button variant="ghost" size="sm" shortcut="Esc" onClick={() => closeSettings()}>
            Close
          </Button>
        </Tooltip>
      </LocationHeader>
      <div ref={body} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="settings-body">
          <SettingsNav />
          {settingsSection === "defaults" ? (
            <Defaults />
          ) : settingsSection === "boards" ? (
            <BoardsPage />
          ) : settingsSection === "repositories" ? (
            <RepositoriesPage />
          ) : settingsSection === "prompts" ? (
            <PromptsPage />
          ) : (
            <PromptPane key={settingsSection} stage={settingsSection} />
          )}
        </div>
      </div>
      <DiscardChangesDialog />
    </section>
  );
}
