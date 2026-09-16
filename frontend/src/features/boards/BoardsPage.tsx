import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BoardDialog } from "@/features/boards/BoardDialog";
import { BoardRow } from "@/features/boards/BoardRow";
import { useBoards } from "@/store/app-store";

/** BoardsPage is the settings page of the GitHub project boards the tasks can come from. */
export function BoardsPage() {
  const boards = useBoards();
  const [adding, setAdding] = useState(false);

  return (
    <section className="h-full overflow-y-auto p-8">
      <div className="flex w-full max-w-[43rem] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-[1.5rem] font-semibold">Boards</h2>
            <span className="flex-1" />
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Add board
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            The GitHub projects your tasks start from, each with the repositories it manages.
          </p>
        </header>
        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No boards yet.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {boards.map((board) => (
              <BoardRow key={board.id} board={board} />
            ))}
          </ul>
        )}
      </div>
      <BoardDialog mode="add" open={adding} onOpenChange={setAdding} />
    </section>
  );
}
