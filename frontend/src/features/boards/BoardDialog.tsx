import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Field } from "@/components/system/Field";
import { Input } from "@/components/system/Input";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { SunkenLine } from "@/components/system/SunkenLine";
import { BoardRepositoryRow } from "@/features/boards/BoardRepositoryRow";
import {
  changedNote,
  choicesOf,
  chosenCloneOf,
  consequence,
  footerSum,
  premarkHelp,
  stepsOf,
  subtitle,
  withOption,
} from "@/features/boards/board-dialog";
import { StatusTable } from "@/features/boards/StatusTable";
import { messageOf } from "@/lib/errors";
import type { BoardPreview, BoardRepositoryOption } from "@/lib/wails";
import {
  addBoard,
  checkBoardRepository,
  previewBoard,
  previewEditBoard,
  updateBoard,
} from "@/store/actions";
import { useBoard, useRepositories } from "@/store/app-store";

export type BoardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ({ mode: "add" } | { mode: "edit"; boardId: string });

const READING_TEXT = "Reading the board…";
const EMPTY_URL_TEXT = "Paste the URL of a GitHub project.";
const URL_HELP =
  "github.com/orgs/<org>/projects/<n> or github.com/users/<user>/projects/<n>. Views and filters in the URL are fine.";
const NO_STATUS_TEXT =
  "This board has no Status field, so there are no statuses to mark: its cards end when their issues close.";

/** FIRST_FIELD finds the first control of the body the focus can start on in a step: not the hidden input a checkbox carries. */
const FIRST_FIELD =
  '[data-dialog-body] :is(input:not([type=hidden]), [role=checkbox]):not(:disabled):not([aria-disabled="true"]):not([aria-hidden="true"])';

/** BoardDialog registers a board of GitHub Projects, or edits one, in steps: the project, its statuses and its repositories. */
export function BoardDialog(props: BoardDialogProps) {
  // The form lives only while the dialog is open, so every opening reads the board again.
  if (!props.open) {
    return null;
  }
  return (
    <BoardForm
      boardId={props.mode === "edit" ? props.boardId : null}
      onOpenChange={props.onOpenChange}
    />
  );
}

interface BoardFormProps {
  /** boardId is the board being edited; null while adding one. */
  boardId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** BoardForm holds what the user chose across the steps, so Back never loses it. */
function BoardForm({ boardId, onOpenChange }: BoardFormProps) {
  const mode = boardId === null ? "add" : "edit";
  const repositories = useRepositories();
  const registered = useBoard(boardId ?? "");
  const [step, setStep] = useState<"project" | "statuses" | "repositories">(
    mode === "add" ? "project" : "statuses",
  );
  const [url, setUrl] = useState("");
  const [readUrl, setReadUrl] = useState("");
  const [preview, setPreview] = useState<BoardPreview | null>(null);
  const [reading, setReading] = useState(mode === "edit");
  const [readError, setReadError] = useState<string | null>(null);
  const [finals, setFinals] = useState<ReadonlySet<string>>(new Set());
  const [newCardStatus, setNewCardStatus] = useState("");
  const [options, setOptions] = useState<BoardRepositoryOption[]>([]);
  const [initiallyChecked, setInitiallyChecked] = useState<ReadonlySet<string>>(new Set());
  const [chosenClones, setChosenClones] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const readCount = useRef(0);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();

  /** read asks for the board and, once it arrives, starts the choices from what it says. */
  const read = useCallback(async (request: () => Promise<BoardPreview>, from: string) => {
    const mine = ++readCount.current;
    setReading(true);
    setReadError(null);
    try {
      const board = await request();
      if (readCount.current !== mine) {
        return;
      }
      const own = board.repositories ?? [];
      setPreview(board);
      setReadUrl(from);
      setFinals(
        new Set((board.statuses ?? []).filter((status) => status.final).map((status) => status.id)),
      );
      setNewCardStatus(board.newCardStatus);
      setOptions(own);
      setInitiallyChecked(new Set(own.filter((option) => option.checked).map((o) => o.fullName)));
      setChosenClones({});
      setTyped("");
      setCheckError(null);
      setStep(board.hasStatus ? "statuses" : "repositories");
    } catch (failure) {
      if (readCount.current === mine) {
        setReadError(messageOf(failure));
      }
    } finally {
      if (readCount.current === mine) {
        setReading(false);
      }
    }
  }, []);

  const readEdit = useCallback(() => {
    if (boardId !== null) {
      void read(() => previewEditBoard(boardId), "");
    }
  }, [boardId, read]);

  useEffect(() => {
    readEdit();
    return () => {
      // A reading that comes back after the dialog closed is ignored.
      readCount.current++;
    };
  }, [readEdit]);

  const steps = stepsOf(mode, preview?.hasStatus ?? null);
  const at = steps.indexOf(step);
  const waiting = mode === "edit" && preview === null;

  // The focus starts on the first field of each step, and on Try again when the reading fails. A
  // checkbox of the system takes its tab stop after the render, so the focus waits a frame.
  const failedEdit = waiting && readError !== null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a step, or a board that arrives, is a new body to start on
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = failedEdit
        ? retryRef.current
        : document.querySelector<HTMLElement>(FIRST_FIELD);
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [step, waiting, failedEdit, reading]);

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

  const continueFromProject = () => {
    const wanted = url.trim();
    if (wanted === "" || reading) {
      return;
    }
    const next = steps[at + 1];
    if (preview !== null && wanted === readUrl && next !== undefined) {
      setStep(next);
      return;
    }
    void read(() => previewBoard(wanted), wanted);
  };

  const check = async () => {
    if (typed.trim() === "" || checking || saving) {
      return;
    }
    setChecking(true);
    setCheckError(null);
    try {
      const option = await checkBoardRepository(boardId ?? "", typed.trim());
      const entered = { ...option, checked: option.link !== "other_board" };
      setOptions((current) =>
        withOption(current, entered).sort((a, b) =>
          a.fullName.toLowerCase().localeCompare(b.fullName.toLowerCase()),
        ),
      );
      setTyped("");
    } catch (failure) {
      setCheckError(messageOf(failure));
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (preview === null || saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    const req = {
      finalStatuses: (preview.statuses ?? [])
        .map((status) => status.id)
        .filter((id) => finals.has(id)),
      newCardStatus: preview.hasStatus ? newCardStatus : "",
      repositories: choicesOf(options, chosenClones),
    };
    try {
      if (boardId === null) {
        await addBoard(readUrl, req);
      } else {
        await updateBoard(boardId, req);
      }
      onOpenChange(false);
    } catch (failure) {
      setSaveError(messageOf(failure));
      setSaving(false);
    }
  };

  const sum = useMemo(
    () => (mode === "edit" ? footerSum(options, initiallyChecked) : ""),
    [mode, options, initiallyChecked],
  );

  // An edit names its board while it is read, as the board is registered.
  const heading = waiting
    ? registered === null
      ? ""
      : `${registered.title} · ${registered.owner}`
    : subtitle(mode, preview, step, steps);
  const last = step === "repositories";
  const urlEmpty = url.trim() === "";

  /** primary is what Ctrl Enter and the main button do in the step the dialog is in. */
  const primary = () => {
    if (failedEdit) {
      readEdit();
    } else if (step === "project") {
      continueFromProject();
    } else if (last) {
      void save();
    } else {
      const next = steps[at + 1];
      if (next !== undefined) {
        setStep(next);
      }
    }
  };

  const back = () => {
    const previous = steps[at - 1];
    if (previous !== undefined) {
      setStep(previous);
    }
  };

  const onUrlKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      continueFromProject();
    }
  };

  const onTypedKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      void check();
    }
  };

  // The footer's line: what holds the primary back, or what saving does.
  const footerReason =
    step === "project"
      ? reading
        ? READING_TEXT
        : urlEmpty
          ? EMPTY_URL_TEXT
          : ""
      : last
        ? sum
        : "";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // While the board is saved, the dialog stays: a refusal that comes back has its footer.
        if (!next && saving) {
          return;
        }
        onOpenChange(next);
      }}
      size="wide"
      title={mode === "add" ? "Add board" : "Edit board"}
      {...(heading !== "" ? { subtitle: heading } : {})}
      closeDisabled={saving}
      {...(waiting && !failedEdit ? {} : { onConfirm: primary })}
      {...(waiting ? { initialFocus: cancelRef } : {})}
    >
      <DialogBody>
        {waiting ? (
          failedEdit ? (
            <p role="alert" className="text-state-error">
              {readError}
            </p>
          ) : (
            <p role="status" className="flex items-center gap-2">
              <Spinner tone="current" />
              {READING_TEXT}
            </p>
          )
        ) : step === "project" ? (
          <Field
            label="URL of the GitHub project"
            help={URL_HELP}
            {...(readError !== null ? { error: readError } : {})}
          >
            <Input
              mono
              value={url}
              disabled={reading}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={onUrlKeyDown}
            />
          </Field>
        ) : step === "statuses" && preview !== null ? (
          <StatusesStep
            mode={mode}
            preview={preview}
            finals={finals}
            newCardStatus={newCardStatus}
            onFinal={toggleFinal}
            onNewCard={setNewCardStatus}
          />
        ) : (
          preview !== null && (
            <>
              <p>
                Check the repositories this board manages. They come from the issues on the board.
              </p>
              {!preview.hasStatus && <SunkenLine icon="blocked">{NO_STATUS_TEXT}</SunkenLine>}
              {options.length > 0 && (
                <ul className="divide-y divide-line-1 rounded-md border border-line-1">
                  {options.map((option) => {
                    const own =
                      repositories.find((repository) => repository.id === option.repositoryId) ??
                      null;
                    return (
                      <BoardRepositoryRow
                        key={option.fullName}
                        option={option}
                        repository={own}
                        chosenClone={
                          option.link === "clone" ? chosenCloneOf(option, chosenClones) : ""
                        }
                        disabled={saving}
                        consequence={mode === "edit" ? consequence(option, own) : ""}
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
                    );
                  })}
                </ul>
              )}
              <Field
                label="Add a repository"
                {...(checkError !== null ? { error: checkError } : {})}
              >
                <div className="flex gap-2">
                  <Input
                    mono
                    placeholder="owner/name"
                    value={typed}
                    disabled={checking || saving}
                    onChange={(event) => setTyped(event.target.value)}
                    onKeyDown={onTypedKeyDown}
                  />
                  <Button
                    size="sm"
                    disabled={typed.trim() === "" || saving}
                    loading={checking}
                    loadingLabel="Checking…"
                    onClick={() => void check()}
                  >
                    Add
                  </Button>
                </div>
              </Field>
            </>
          )
        )}
      </DialogBody>
      <DialogFooter
        {...(saveError !== null ? { refusal: saveError } : {})}
        {...(at > 0 && !waiting
          ? {
              back: (
                <Button variant="ghost" icon={ICONS.back} disabled={saving} onClick={back}>
                  Back
                </Button>
              ),
            }
          : {})}
        {...(footerReason !== ""
          ? { reason: { id: reasonId, text: footerReason, lines: 2 as const } }
          : {})}
      >
        <DialogCancel ref={cancelRef} disabled={saving} />
        {waiting ? (
          failedEdit && (
            <Button ref={retryRef} variant="primary" shortcut="Ctrl ↵" onClick={readEdit}>
              Try again
            </Button>
          )
        ) : (
          <Button
            variant="primary"
            shortcut="Ctrl ↵"
            disabled={step === "project" && urlEmpty && !reading}
            {...(footerReason !== "" ? { reasonId } : {})}
            {...(step === "project"
              ? { loading: reading, loadingLabel: "Reading…" }
              : last
                ? { loading: saving, loadingLabel: mode === "add" ? "Adding…" : "Saving…" }
                : {})}
            onClick={primary}
          >
            {step === "project" || !last ? "Continue" : mode === "add" ? "Add board" : "Save"}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

interface StatusesStepProps {
  mode: "add" | "edit";
  preview: BoardPreview;
  finals: ReadonlySet<string>;
  newCardStatus: string;
  onFinal: (id: string, final: boolean) => void;
  onNewCard: (id: string) => void;
}

/** StatusesStep asks which statuses end the work and which one new cards start in. */
function StatusesStep({
  mode,
  preview,
  finals,
  newCardStatus,
  onFinal,
  onNewCard,
}: StatusesStepProps) {
  const note = mode === "edit" ? changedNote(preview) : "";
  const help = mode === "add" ? premarkHelp(preview) : "";
  const newIds = useMemo(() => new Set(preview.newStatusIds ?? []), [preview.newStatusIds]);
  return (
    <>
      <p>
        Mark the statuses that end the work on a card, and the status a card published by a
        discussion starts in.
      </p>
      {note !== "" && <SunkenLine icon="blocked">{note}</SunkenLine>}
      <StatusTable
        statuses={preview.statuses ?? []}
        finals={finals}
        newCardStatus={newCardStatus}
        newIds={newIds}
        onFinal={onFinal}
        onNewCard={onNewCard}
      />
      {help !== "" && (
        <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">{help}</p>
      )}
    </>
  );
}
