import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { BrandMark } from "@/components/system/BrandMark";
import { ICONS } from "@/components/system/icons";
import { MachineChecks } from "@/components/system/MachineChecks";
import { StartRow } from "@/components/system/StartRow";
import { BoardDialog } from "@/features/boards/BoardDialog";
import { CheckAgainButton } from "@/features/machine/CheckAgainButton";
import { missingViews } from "@/features/machine/machine";
import { AddRepositoryDialog } from "@/features/repositories/AddRepositoryDialog";
import type { Machine } from "@/lib/wails";
import { checkMachine } from "@/store/actions";
import { useAppStore, useMachine } from "@/store/app-store";

const TITLE =
  "m-0 text-(length:--text-display) leading-(--leading-display) font-semibold text-ink-1 outline-none";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-(--space-2)">
      <h2
        id={titleId}
        className="m-0 text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Welcome is the Home while nothing is registered and nothing is active: what MySpec does, what the
 * machine lacks to do it and the two ways to register where the work lives.
 */
export function Welcome() {
  const pendingFocus = useAppStore((state) => state.pendingFocus);
  const clearPendingFocus = useAppStore((state) => state.clearPendingFocus);
  const machine = useMachine();
  const [addingBoard, setAddingBoard] = useState(false);
  const [addingRepository, setAddingRepository] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const start = useRef<HTMLDivElement>(null);

  // The machine is checked when the welcome shows and whenever the window comes back, since the
  // user fixes what is missing in a terminal; the result arrives with the state.
  useEffect(() => {
    const check = () => void checkMachine();
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  // Add board takes the focus when the welcome appears, unless a navigation asked for another place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the welcome opens
  useEffect(() => {
    if (pendingFocus === null) {
      start.current?.querySelector("button")?.focus();
    }
  }, []);

  // The title takes the focus on the way back from Settings.
  useEffect(() => {
    if (pendingFocus === "title") {
      title.current?.focus();
      clearPendingFocus();
    }
  }, [pendingFocus, clearPendingFocus]);

  const items = missingViews(machine);

  // When Check again clears the last lack, the block leaves, and the focus goes to Add board.
  const afterCheck = (found: Machine | null) => {
    if (found !== null && missingViews(found).length === 0) {
      start.current?.querySelector("button")?.focus();
    }
  };

  return (
    <section className="relative min-h-0 flex-1 overflow-y-auto bg-surface-1 text-ink-1">
      <div className="start-column flex flex-col gap-(--space-8)">
        <header className="flex flex-col gap-(--space-3)">
          <BrandMark size="lg" />
          <h1 ref={title} tabIndex={-1} className={TITLE}>
            Welcome to MySpec
          </h1>
          <p className="m-0 text-(length:--text-body) leading-(--leading-body) text-ink-2">
            MySpec runs Claude Code through a task, from the card on your GitHub board to the merged
            pull request. Register where your work lives to start.
          </p>
        </header>
        {items.length > 0 && (
          <Section title="This machine">
            <MachineChecks items={items} />
            <div className="flex">
              <CheckAgainButton onChecked={afterCheck} />
            </div>
          </Section>
        )}
        <Section title="Start">
          <div ref={start} className="flex flex-col">
            <StartRow
              icon={ICONS.board}
              label="Add board"
              sub="A GitHub project. Its cards start tasks, and the repositories of its issues come with it."
              onClick={() => setAddingBoard(true)}
            />
            <StartRow
              icon={ICONS.repository}
              label="Add repository"
              sub="A clone on this machine, for tasks without a board."
              onClick={() => setAddingRepository(true)}
            />
          </div>
        </Section>
      </div>
      <BoardDialog mode="add" open={addingBoard} onOpenChange={setAddingBoard} />
      <AddRepositoryDialog open={addingRepository} onOpenChange={setAddingRepository} />
    </section>
  );
}
