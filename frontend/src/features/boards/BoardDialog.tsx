import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { choicesOf, chosenCloneOf, withOption } from "@/features/boards/board-dialog";
import { RepositoryLinkRow } from "@/features/boards/RepositoryLinkRow";
import { messageOf } from "@/lib/errors";
import type { BoardPreview, BoardRepositoryOption } from "@/lib/wails";
import {
  addBoard,
  checkBoardRepository,
  previewBoard,
  previewEditBoard,
  updateBoard,
} from "@/store/actions";

export type BoardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ({ mode: "add" } | { mode: "edit"; boardId: string });

/** READING_TEXT is what the dialog says while it reads the board from GitHub. */
const READING_TEXT = "Reading the board…";

/** BoardDialog registers a board of GitHub Projects, or edits one: its final statuses and the repositories it manages. */
export function BoardDialog(props: BoardDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* The form lives only while the dialog is open, so every opening reads the board again. */}
      {props.open && (
        <BoardForm
          boardId={props.mode === "edit" ? props.boardId : null}
          onOpenChange={props.onOpenChange}
        />
      )}
    </Dialog>
  );
}

interface BoardFormProps {
  /** boardId is the board being edited; null while adding one. */
  boardId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** BoardForm reads the board, from the URL the user pastes or from the board being edited, then asks what to save. */
function BoardForm({ boardId, onOpenChange }: BoardFormProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<BoardPreview | null>(null);
  const [reading, setReading] = useState(boardId !== null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (boardId === null) {
      return;
    }
    let cancelled = false;
    previewEditBoard(boardId)
      .then((read) => {
        if (!cancelled) {
          setPreview(read);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setReadError(messageOf(failure));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const read = async () => {
    setReading(true);
    setReadError(null);
    try {
      setPreview(await previewBoard(url.trim()));
    } catch (failure) {
      setReadError(messageOf(failure));
    } finally {
      setReading(false);
    }
  };

  const title = boardId === null ? "Add board" : "Edit board";

  if (preview !== null) {
    return (
      <BoardChoices
        title={title}
        url={url.trim()}
        boardId={boardId}
        preview={preview}
        onOpenChange={onOpenChange}
      />
    );
  }

  const readingLine = reading && (
    <p role="status" className="text-sm text-muted-foreground">
      {READING_TEXT}
    </p>
  );
  const errorLine = readError !== null && (
    <p role="alert" className="text-sm text-destructive">
      {readError}
    </p>
  );

  if (boardId !== null) {
    return (
      <DialogContent className="sm:max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {readingLine}
        {errorLine}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-[40rem]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Paste the URL of a GitHub project.</DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void read();
        }}
      >
        <Input
          aria-label="Board URL"
          placeholder="https://github.com/orgs/owner/projects/1"
          value={url}
          disabled={reading}
          onChange={(event) => setUrl(event.target.value)}
        />
        {readingLine}
        {errorLine}
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={() => void read()} disabled={url.trim() === "" || reading}>
          Continue
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface BoardChoicesProps {
  title: string;
  /** url is the URL the board was read from; "" while editing. */
  url: string;
  boardId: string | null;
  preview: BoardPreview;
  onOpenChange: (open: boolean) => void;
}

/** BoardChoices are the steps after the board was read: its final statuses, then its repositories. */
function BoardChoices({ title, url, boardId, preview, onOpenChange }: BoardChoicesProps) {
  const [step, setStep] = useState<"statuses" | "repositories">(
    preview.hasStatus ? "statuses" : "repositories",
  );
  const [finals, setFinals] = useState<ReadonlySet<string>>(
    () =>
      new Set((preview.statuses ?? []).filter((status) => status.final).map((status) => status.id)),
  );
  const [options, setOptions] = useState<BoardRepositoryOption[]>(preview.repositories ?? []);
  const [chosenClones, setChosenClones] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const statusId = useId();

  const toggleFinal = (id: string, checked: boolean) => {
    setFinals((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const check = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const option = await checkBoardRepository(boardId ?? "", typed.trim());
      setOptions((current) => withOption(current, option));
      setTyped("");
    } catch (failure) {
      setCheckError(messageOf(failure));
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const req = {
      finalStatuses: (preview.statuses ?? [])
        .map((status) => status.id)
        .filter((id) => finals.has(id)),
      repositories: choicesOf(options, chosenClones),
    };
    try {
      if (boardId === null) {
        await addBoard(url, req);
      } else {
        await updateBoard(boardId, req);
      }
      onOpenChange(false);
    } catch (failure) {
      setSaveError(messageOf(failure));
      setSaving(false);
    }
  };

  const boardLine = `${preview.title} · ${preview.owner}`;

  if (step === "statuses") {
    return (
      <DialogContent className="sm:max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{`${boardLine} · Mark the statuses that end the work on a card.`}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[24rem] flex-col divide-y overflow-y-auto rounded-lg border">
          {(preview.statuses ?? []).map((status, index) => (
            <li key={status.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2">
                <span id={`${statusId}-${index}`} className="min-w-0 flex-1 truncate text-sm">
                  {status.name}
                </span>
                <Checkbox
                  // The label wraps the whole row; the checkbox is named by the status and what marking it means.
                  aria-labelledby={`${statusId}-${index} ${statusId}-final`}
                  checked={finals.has(status.id)}
                  onCheckedChange={(checked) => toggleFinal(status.id, checked)}
                />
                <span
                  id={index === 0 ? `${statusId}-final` : undefined}
                  className="text-xs text-muted-foreground"
                >
                  Final
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => setStep("repositories")}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-[40rem]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{`${boardLine} · Check the repositories this board manages.`}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        {options.length > 0 && (
          <ul className="flex max-h-[20rem] flex-col divide-y overflow-y-auto rounded-lg border">
            {options.map((option) => (
              <RepositoryLinkRow
                key={option.fullName}
                option={option}
                chosenClone={option.link === "clone" ? chosenCloneOf(option, chosenClones) : ""}
                disabled={saving}
                onCheckedChange={(checked) =>
                  setOptions((current) =>
                    current.map((each) =>
                      each.fullName === option.fullName ? { ...each, checked } : each,
                    ),
                  )
                }
                onCloneChange={(path) =>
                  setChosenClones((current) => ({ ...current, [option.fullName]: path }))
                }
              />
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void check();
          }}
        >
          <div className="flex gap-2">
            <Input
              aria-label="Add a repository"
              placeholder="owner/name"
              value={typed}
              disabled={checking || saving}
              onChange={(event) => setTyped(event.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={typed.trim() === "" || checking || saving}
            >
              Add
            </Button>
          </div>
          {checkError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {checkError}
            </p>
          )}
        </form>
      </div>
      <DialogFooter className="sm:flex-wrap">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {boardId === null ? "Add board" : "Save"}
        </Button>
        {saveError !== null && (
          <p role="alert" className="basis-full text-sm text-destructive">
            {saveError}
          </p>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
