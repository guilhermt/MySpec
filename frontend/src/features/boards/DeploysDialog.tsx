import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Checkbox } from "@/components/system/Checkbox";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { LiveRegion } from "@/components/system/LiveRegion";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { SunkenLine } from "@/components/system/SunkenLine";
import { DeployRepositoryEditor } from "@/features/boards/DeployRepositoryEditor";
import {
  branchesOf,
  type DialogState,
  initialState,
  requestOf,
  saveBlock,
  withAdded,
  withChecked,
  withEnvironment,
  withMoved,
  withOptions,
  withReading,
  withRemoved,
} from "@/features/boards/deploys-dialog";
import { messageOf } from "@/lib/errors";
import type { Board } from "@/lib/wails";
import { readDeployRepository, readDeploySettings, saveDeploySettings } from "@/store/actions";

const READING_TEXT = "Reading the deploys of the board…";

/** FIRST_CHECKBOX finds the checkbox the focus starts on: the first control of the body. */
const FIRST_CHECKBOX = '[data-dialog-body] [role="checkbox"]:not([aria-disabled="true"])';

export interface DeploysDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** DeploysDialog sets up the deploys of a board: whether they are managed, and the environments of each repository. */
export function DeploysDialog({ board, open, onOpenChange }: DeploysDialogProps) {
  // The form lives only while the dialog is open, so every opening reads the settings again.
  if (!open) {
    return null;
  }
  return <DeploysForm board={board} onOpenChange={onOpenChange} />;
}

interface DeploysFormProps {
  board: Board;
  onOpenChange: (open: boolean) => void;
}

/** Settings is the reading of the deploys of the board, as the dialog holds it. */
type Settings =
  | { status: "reading" }
  | { status: "failed"; message: string }
  | { status: "ready"; state: DialogState };

function DeploysForm({ board, onOpenChange }: DeploysFormProps) {
  const [settings, setSettings] = useState<Settings>({ status: "reading" });
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const reads = useRef(new Map<string, number>());
  const settingsRead = useRef(0);
  const retryRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();

  /** readOptions asks GitHub about a repository; of two readings, only the last one counts. */
  const readOptions = useCallback(
    async (repositoryId: string, branches: string[], quiet: boolean) => {
      const mine = (reads.current.get(repositoryId) ?? 0) + 1;
      reads.current.set(repositoryId, mine);
      const change = (apply: (state: DialogState) => DialogState) =>
        setSettings((current) =>
          current.status === "ready" ? { status: "ready", state: apply(current.state) } : current,
        );
      if (!quiet) {
        change((state) => withReading(state, repositoryId));
      }
      try {
        const options = await readDeployRepository(repositoryId, branches);
        if (reads.current.get(repositoryId) === mine) {
          change((state) => withOptions(state, repositoryId, options));
        }
      } catch (failure) {
        if (reads.current.get(repositoryId) === mine) {
          change((state) =>
            withOptions(state, repositoryId, {
              workflows: [],
              branches: [],
              failure: messageOf(failure),
            }),
          );
        }
      }
    },
    [],
  );

  const read = useCallback(async () => {
    const mine = ++settingsRead.current;
    setSettings({ status: "reading" });
    try {
      const read = await readDeploySettings(board.id);
      if (settingsRead.current !== mine) {
        return;
      }
      const state = initialState(read);
      setSettings({ status: "ready", state });
      for (const repository of state.repositories.filter((each) => each.managed)) {
        void readOptions(repository.repositoryId, branchesOf(repository), false);
      }
    } catch (failure) {
      if (settingsRead.current === mine) {
        setSettings({ status: "failed", message: messageOf(failure) });
      }
    }
  }, [board.id, readOptions]);

  useEffect(() => {
    void read();
    return () => {
      // A reading that comes back after the dialog closed is ignored.
      settingsRead.current++;
      reads.current.clear();
    };
  }, [read]);

  // The focus starts on the first checkbox once the settings are there, and on Try again if they fail.
  const status = settings.status;
  useEffect(() => {
    if (status === "reading") {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target =
        status === "failed"
          ? retryRef.current
          : document.querySelector<HTMLElement>(FIRST_CHECKBOX);
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [status]);

  const state = settings.status === "ready" ? settings.state : null;
  const edit = (apply: (current: DialogState) => DialogState) =>
    setSettings((current) =>
      current.status === "ready" ? { status: "ready", state: apply(current.state) } : current,
    );
  const block = state === null ? "" : saveBlock(state);

  const check = (repositoryId: string, checked: boolean) => {
    edit((current) => withChecked(current, repositoryId, checked));
    const repository = state?.repositories.find((each) => each.repositoryId === repositoryId);
    if (checked && repository !== undefined) {
      void readOptions(repositoryId, branchesOf(repository), false);
    }
  };

  const save = async () => {
    if (state === null || block !== "" || saving) {
      return;
    }
    setSaving(true);
    setRefusal(null);
    try {
      await saveDeploySettings(requestOf(state));
      onOpenChange(false);
    } catch (failure) {
      setRefusal(messageOf(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && saving) {
          return;
        }
        onOpenChange(next);
      }}
      size="wide"
      title={`Deploys of ${board.title}`}
      subtitle="Promote code between the environments of the repositories of this board."
      closeDisabled={saving}
      onConfirm={() => void save()}
    >
      <DialogBody>
        <LiveRegion kind="status" className="sr-only">
          {settings.status === "reading" && READING_TEXT}
        </LiveRegion>
        {settings.status === "reading" && (
          <Skeleton label={READING_TEXT}>
            <SkeletonBar className="w-1/2" />
            <SkeletonBar className="w-full" />
            <SkeletonBar className="w-3/4" />
          </Skeleton>
        )}
        {settings.status === "failed" && (
          <p role="alert" className="text-state-error">
            {settings.message}
          </p>
        )}
        {state !== null && (
          <>
            <Checkbox
              checked={state.enabled}
              disabled={saving}
              onCheckedChange={(enabled) => edit((current) => ({ ...current, enabled }))}
            >
              <span className="font-medium">Manage the deploys of this board</span>{" "}
              <span className="text-ink-3">
                Off keeps the configuration, and the board leaves Deploys.
              </span>
            </Checkbox>
            <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-3) border-0 p-0">
              <legend className="mb-(--space-2) font-medium text-ink-1">Repositories</legend>
              {state.repositories.map((repository) => (
                <div key={repository.repositoryId} className="flex flex-col gap-(--space-2)">
                  <Checkbox
                    checked={repository.managed}
                    disabled={saving}
                    onCheckedChange={(checked) => check(repository.repositoryId, checked)}
                  >
                    <span className="font-medium">{repository.fullName}</span>
                  </Checkbox>
                  {repository.managed && repository.options.status === "failed" && (
                    <SunkenLine
                      icon="blocked"
                      action={
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            void readOptions(repository.repositoryId, branchesOf(repository), false)
                          }
                        >
                          Try again
                        </Button>
                      }
                    >
                      {`Couldn't read ${repository.fullName}: ${repository.options.message}`}
                    </SunkenLine>
                  )}
                  {repository.managed && (
                    <DeployRepositoryEditor
                      repository={repository}
                      disabled={saving}
                      onChange={(index, patch) =>
                        edit((current) =>
                          withEnvironment(current, repository.repositoryId, index, patch),
                        )
                      }
                      onMove={(index, delta) =>
                        edit((current) => withMoved(current, repository.repositoryId, index, delta))
                      }
                      onRemove={(index) =>
                        edit((current) => withRemoved(current, repository.repositoryId, index))
                      }
                      onAdd={() => edit((current) => withAdded(current, repository.repositoryId))}
                      onBranchCommit={() =>
                        void readOptions(repository.repositoryId, branchesOf(repository), true)
                      }
                    />
                  )}
                </div>
              ))}
            </fieldset>
          </>
        )}
      </DialogBody>
      <DialogFooter
        {...(refusal !== null ? { refusal } : {})}
        {...(block !== "" ? { reason: { id: reasonId, text: block, lines: 2 as const } } : {})}
      >
        <DialogCancel disabled={saving} />
        {settings.status === "failed" ? (
          <Button ref={retryRef} variant="primary" shortcut="Ctrl ↵" onClick={() => void read()}>
            Try again
          </Button>
        ) : (
          <Button
            variant="primary"
            shortcut="Ctrl ↵"
            disabled={state === null || block !== ""}
            {...(block !== "" ? { reasonId } : {})}
            loading={saving}
            loadingLabel="Saving…"
            onClick={() => void save()}
          >
            Save
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
