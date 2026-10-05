import { useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { SunkenLine } from "@/components/system/SunkenLine";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { RepositoryMenu } from "@/features/repositories/RepositoryMenu";
import { ReviewInstructionsBlock } from "@/features/repositories/ReviewInstructionsBlock";
import {
  type BlockLineView,
  blockLine,
  countsLine,
  pathLine,
  rowName,
} from "@/features/repositories/repositories-page";
import { SettingsRow } from "@/features/settings/SettingsList";
import { messageOf } from "@/lib/errors";
import { displayPath, displayPaths } from "@/lib/paths";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository } from "@/store/actions";
import { useAppStore, useBoard } from "@/store/app-store";

const META = "text-(length:--text-meta) leading-(--leading-meta)";

export interface RepositoryRowProps {
  repository: Repository;
  /** inNeedsAClone says the row is in the group of the repositories that need a clone, which names the board on its line. */
  inNeedsAClone?: boolean;
  /** onRemoved is called when the repository is gone, for the page to place the focus. */
  onRemoved?: () => void;
}

/** RepositoryRow is one registered repository: where its clone is, what it holds, and what can be done to it. */
export function RepositoryRow({
  repository,
  inNeedsAClone = false,
  onRemoved,
}: RepositoryRowProps) {
  const board = useBoard(repository.boardId);
  const cloneFolder = useAppStore((state) => state.app?.cloneFolder ?? "");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const block = blockLine(repository, cloneFolder);
  // A line that was there when the page opened is read with the page; one that comes after is announced.
  const firstBlock = useRef(block?.kind ?? null);

  // The refusal of an action shows on the row that asked for it.
  const attempt = async (action: () => Promise<unknown>) => {
    setRefusal(null);
    try {
      await action();
    } catch (failure) {
      setRefusal(displayPaths(messageOf(failure)));
    }
  };
  const changePath = () => void attempt(() => changeRepositoryPath(repository.id));
  const clone = () => void attempt(() => cloneRepository(repository.id));
  const closeInstructions = () => {
    setInstructionsOpen(false);
    menuTrigger.current?.focus();
  };

  const counts = countsLine(repository);
  const line = pathLine(repository, board?.title ?? null, inNeedsAClone);
  const path = repository.cloned ? displayPath(repository.path) : "";
  const at = path === "" ? -1 : line.indexOf(path);

  return (
    <>
      <SettingsRow
        icon="repository"
        name={rowName(repository)}
        lines={
          <>
            <span className="min-w-0 truncate text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-1">
              {repository.fullName}
            </span>
            <span className={`min-w-0 break-all text-ink-3 ${META}`}>
              {at === -1 ? (
                line
              ) : (
                <>
                  {line.slice(0, at)}
                  <span className="font-mono text-ink-2">{path}</span>
                  {line.slice(at + path.length)}
                </>
              )}
            </span>
            <span className={`hidden text-ink-3 tabular-nums @max-[820px]/main:block ${META}`}>
              {counts}
            </span>
          </>
        }
        trailing={
          <>
            <span
              className={`whitespace-nowrap text-ink-3 tabular-nums @max-[820px]/main:hidden ${META}`}
            >
              {counts}
            </span>
            <RepositoryMenu
              repository={repository}
              triggerRef={menuTrigger}
              onChangePath={changePath}
              onReviewInstructions={() => setInstructionsOpen(true)}
              onRemove={() => setRemoving(true)}
            />
          </>
        }
        below={
          block === null && refusal === null && !instructionsOpen ? undefined : (
            <div className="ml-[calc(var(--icon)+var(--space-3))] flex flex-col gap-(--space-2)">
              {block !== null && (
                <BlockLine
                  block={block}
                  announced={block.kind !== firstBlock.current}
                  onClone={clone}
                  onChangePath={changePath}
                />
              )}
              {refusal !== null && (
                <p role="alert" className={`text-state-error ${META}`}>
                  {refusal}
                </p>
              )}
              {instructionsOpen && (
                <ReviewInstructionsBlock repository={repository} onClose={closeInstructions} />
              )}
            </div>
          )
        }
      />
      <RemoveRepositoryDialog
        repository={repository}
        open={removing}
        onOpenChange={setRemoving}
        {...(onRemoved === undefined ? {} : { onRemoved })}
      />
    </>
  );
}

interface BlockLineProps {
  block: BlockLineView;
  /** announced makes the line an alert: it came while the page was open. */
  announced: boolean;
  onClone: () => void;
  onChangePath: () => void;
}

/** BlockLine is what a row says under it when its clone is missing, running or failed, with the action that answers it. */
function BlockLine({ block, announced, onClone, onChangePath }: BlockLineProps) {
  if (block.kind === "cloning") {
    return (
      <p className={`flex items-center gap-(--space-1-5) text-ink-3 ${META}`}>
        <Spinner />
        {block.text}
      </p>
    );
  }
  if (block.kind === "failed") {
    return (
      // Try again stands at the right, where Clone and Change path… stand on the sunken lines.
      <div
        role="alert"
        className={`flex items-center gap-(--space-2) pr-(--space-3) text-state-error ${META}`}
      >
        <span className="min-w-0 flex-1 break-words">{block.text}</span>
        <Button variant="ghost" size="xs" onClick={onClone}>
          Try again
        </Button>
      </div>
    );
  }
  const clone = block.kind === "no-clone";
  return (
    <div {...(announced ? { role: "alert" } : {})}>
      <SunkenLine
        icon="blocked"
        className="min-h-(--size-control-sm) py-(--space-1) pr-(--space-3)"
        action={
          clone ? (
            <Button variant="ghost" size="xs" icon={ICONS.clone} onClick={onClone}>
              Clone
            </Button>
          ) : (
            <Button variant="ghost" size="xs" onClick={onChangePath}>
              Change path…
            </Button>
          )
        }
      >
        {block.text}
      </SunkenLine>
    </div>
  );
}
