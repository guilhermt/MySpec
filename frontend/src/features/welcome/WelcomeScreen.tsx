import { FolderPlus, SquareKanban } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BoardDialog } from "@/features/boards/BoardDialog";
import { AppNotices } from "@/features/notice/AppNotices";
import { AddRepositoryDialog } from "@/features/repositories/AddRepositoryDialog";

/** AppMark is the logo of the app, on the screens that stand in for the product. */
export function AppMark() {
  return (
    <svg
      viewBox="0 0 512 512"
      className="size-10"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="512" height="512" rx="112" fill="var(--primary)" />
      <path
        d="M132 380V152l124 152 124-152v228"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WelcomeScreen() {
  // A registration through the dialog swaps this screen for the product by
  // itself, through the state.
  const [adding, setAdding] = useState(false);
  const [addingBoard, setAddingBoard] = useState(false);

  return (
    <main className="flex h-dvh items-center justify-center bg-background px-6 text-foreground">
      <div className="flex w-full max-w-[43rem] flex-col gap-8">
        <AppNotices />
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <AppMark />
            <h1 className="text-[2.125rem] font-semibold leading-none">MySpec</h1>
          </div>
          <p className="text-muted-foreground">
            Register a board or a repository to start creating tasks.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => setAddingBoard(true)}>
            <SquareKanban />
            Add board
          </Button>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <FolderPlus />
            Add repository
          </Button>
        </div>
      </div>
      <BoardDialog mode="add" open={addingBoard} onOpenChange={setAddingBoard} />
      <AddRepositoryDialog open={adding} onOpenChange={setAdding} />
    </main>
  );
}
