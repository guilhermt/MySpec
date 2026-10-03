import { useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { EmptyState } from "@/components/system/EmptyState";
import { ICONS } from "@/components/system/icons";
import { BoardDialog } from "@/features/boards/BoardDialog";
import { BoardRow } from "@/features/boards/BoardRow";
import { SettingsList } from "@/features/settings/SettingsList";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { useBoards } from "@/store/app-store";

/** BoardsPage is the settings page of the GitHub project boards the tasks can come from. */
export function BoardsPage() {
  const boards = useBoards();
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const add = (
    <Button variant="secondary" size="sm" icon={ICONS.plus} onClick={() => setAdding(true)}>
      Add board
    </Button>
  );

  return (
    <SettingsPage
      title="Boards"
      sentence="The GitHub projects your tasks start from, each with the repositories it manages."
      titleRef={titleRef}
      action={add}
    >
      {boards.length === 0 ? (
        <EmptyState title="No boards yet" action={add}>
          Add a board to start tasks from the cards of a GitHub project.
        </EmptyState>
      ) : (
        <SettingsList label="Boards">
          {boards.map((board) => (
            <BoardRow key={board.id} board={board} onRemoved={() => titleRef.current?.focus()} />
          ))}
        </SettingsList>
      )}
      <BoardDialog mode="add" open={adding} onOpenChange={setAdding} />
    </SettingsPage>
  );
}
