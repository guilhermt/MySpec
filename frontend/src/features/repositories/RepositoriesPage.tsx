import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { EmptyState } from "@/components/system/EmptyState";
import { ICONS } from "@/components/system/icons";
import { AddRepositoryDialog } from "@/features/repositories/AddRepositoryDialog";
import { CloneFolderSection } from "@/features/repositories/CloneFolderSection";
import { RepositoryRow } from "@/features/repositories/RepositoryRow";
import { NEEDS_A_CLONE_ID, repositoryGroups } from "@/features/repositories/repositories-page";
import { SettingsGroup, SettingsList } from "@/features/settings/SettingsList";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { useAppStore, useBoards, useRepositories } from "@/store/app-store";

/** RepositoriesPage is the settings page of the repositories the tasks belong to. */
export function RepositoriesPage() {
  const repositories = useRepositories();
  const boards = useBoards();
  const openSettings = useAppStore((state) => state.openSettings);
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const groups = useMemo(() => repositoryGroups(repositories, boards), [repositories, boards]);

  const add = (
    <Button variant="secondary" size="sm" icon={ICONS.plus} onClick={() => setAdding(true)}>
      Add repository
    </Button>
  );

  return (
    <SettingsPage
      title="Repositories"
      sentence="The repositories your tasks belong to, each tied to its local clone."
      titleRef={titleRef}
      action={add}
    >
      {groups.length === 0 ? (
        <EmptyState
          title="No repositories yet"
          action={
            <div className="flex items-center gap-(--space-2)">
              {add}
              <Button variant="ghost" size="sm" onClick={() => openSettings("boards")}>
                Go to Boards
              </Button>
            </div>
          }
        >
          Add a clone from this machine, or add a board: the repositories of its issues come with
          it.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-(--space-6)">
          {groups.map((group) => (
            <SettingsGroup
              key={group.id}
              title={group.title}
              count={group.repositories.length}
              {...(group.note === "" ? {} : { note: group.note })}
            >
              <SettingsList>
                {group.repositories.map((repository) => (
                  <RepositoryRow
                    key={repository.id}
                    repository={repository}
                    inNeedsAClone={group.id === NEEDS_A_CLONE_ID}
                    onRemoved={() => titleRef.current?.focus()}
                  />
                ))}
              </SettingsList>
            </SettingsGroup>
          ))}
        </div>
      )}
      <CloneFolderSection />
      <AddRepositoryDialog open={adding} onOpenChange={setAdding} />
    </SettingsPage>
  );
}
