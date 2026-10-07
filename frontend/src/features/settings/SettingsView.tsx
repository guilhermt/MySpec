import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Tooltip } from "@/components/system/Tooltip";
import { BoardsPage } from "@/features/boards/BoardsPage";
import { MachinePage } from "@/features/machine/MachinePage";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { RepositoriesPage } from "@/features/repositories/RepositoriesPage";
import { Defaults } from "@/features/settings/Defaults";
import { DiscardChangesDialog } from "@/features/settings/DiscardChangesDialog";
import { PromptEditor } from "@/features/settings/PromptEditor";
import { PromptPage } from "@/features/settings/PromptPage";
import { PromptsPage } from "@/features/settings/PromptsPage";
import { SettingsNav } from "@/features/settings/SettingsNav";
import { pageOf } from "@/features/settings/settings-nav";
import { usePrompt } from "@/features/settings/usePrompt";
import { locationTitle } from "@/lib/locations";
import type { PromptStage } from "@/lib/wails";
import { useAppStore, useBackTarget, useSettingsUi } from "@/store/app-store";

/**
 * PromptOfStage is the area of one prompt: its page, or its editor while it is edited. It reads the
 * prompt once for both, and a page that comes back from the editor puts the focus on Edit.
 */
function PromptOfStage({ stage }: { stage: PromptStage }) {
  const { promptEdit } = useSettingsUi();
  const { state, setPrompt, retry } = usePrompt(stage);
  const editing = promptEdit?.stage === stage;
  const [wasEditing, setWasEditing] = useState(editing);
  const [focus, setFocus] = useState<"title" | "edit">("title");
  if (editing !== wasEditing) {
    setWasEditing(editing);
    setFocus(editing ? "title" : "edit");
  }

  if (editing && state.status === "ready") {
    return <PromptEditor stage={stage} prompt={state.prompt} onSaved={setPrompt} />;
  }
  return (
    <PromptPage stage={stage} state={state} onRetry={retry} onReset={setPrompt} focus={focus} />
  );
}

/** SettingsView is the settings of the app: the defaults of a new task, the boards, the repositories, the prompts and the machine, one page at a time beside their navigation. */
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
          ) : settingsSection === "machine" ? (
            <MachinePage />
          ) : settingsSection === "prompts" ? (
            <PromptsPage />
          ) : (
            <PromptOfStage key={settingsSection} stage={settingsSection} />
          )}
        </div>
      </div>
      <DiscardChangesDialog />
    </section>
  );
}
