import { FolderGit2, SlidersHorizontal, SquareKanban } from "lucide-react";
import { type ReactNode, useId } from "react";
import { BoardsPage } from "@/features/boards/BoardsPage";
import { RepositoriesPage } from "@/features/repositories/RepositoriesPage";
import { Defaults } from "@/features/settings/Defaults";
import { DiscardChangesDialog } from "@/features/settings/DiscardChangesDialog";
import { PromptPane } from "@/features/settings/PromptPane";
import { PROMPTS } from "@/features/settings/prompts";
import { cn } from "@/lib/utils";
import { type SettingsSection, useAppStore, useSettingsUi } from "@/store/app-store";

const NAV_ITEM =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** NavItem is one section of the settings in the navigation, selected or not. */
function NavItem({ section, children }: { section: SettingsSection; children: ReactNode }) {
  const { settingsSection } = useSettingsUi();
  const selectSettingsSection = useAppStore((state) => state.selectSettingsSection);
  const selected = settingsSection === section;

  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      onClick={() => selectSettingsSection(section)}
      className={cn(NAV_ITEM, selected && "bg-accent font-medium")}
    >
      {children}
    </button>
  );
}

/** SettingsView is the settings of the app: the defaults of a new task, the boards, the repositories and the prompts. */
export function SettingsView() {
  const { settingsSection } = useSettingsUi();
  const promptsId = useId();

  return (
    <section className="flex min-h-0 min-w-0 flex-1 bg-background text-foreground">
      <nav aria-label="Settings" className="flex w-56 shrink-0 flex-col gap-0.5 border-r p-2">
        <h1 className="flex h-9 items-center px-2 text-sm font-semibold">Settings</h1>
        <NavItem section="defaults">
          <SlidersHorizontal aria-hidden="true" />
          Defaults
        </NavItem>
        <NavItem section="boards">
          <SquareKanban aria-hidden="true" />
          Boards
        </NavItem>
        <NavItem section="repositories">
          <FolderGit2 aria-hidden="true" />
          Repositories
        </NavItem>
        <h2 id={promptsId} className="mt-3 px-2 pb-1 text-xs font-medium text-muted-foreground">
          Prompts
        </h2>
        <ul aria-labelledby={promptsId} className="flex flex-col gap-0.5">
          {PROMPTS.map((prompt) => (
            <li key={prompt.stage}>
              <NavItem section={prompt.stage}>{prompt.name}</NavItem>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        {settingsSection === "defaults" ? (
          <Defaults />
        ) : settingsSection === "boards" ? (
          <BoardsPage />
        ) : settingsSection === "repositories" ? (
          <RepositoriesPage />
        ) : (
          <PromptPane key={settingsSection} stage={settingsSection} />
        )}
      </div>
      <DiscardChangesDialog />
    </section>
  );
}
