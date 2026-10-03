import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/system/Collapsible";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { ICONS } from "@/components/system/icons";
import { SearchInput } from "@/components/system/SearchInput";
import { Spinner } from "@/components/system/Spinner";
import { Tooltip } from "@/components/system/Tooltip";
import {
  addLabel,
  filterCandidates,
  linksAClone,
  NO_CANDIDATES_TEXT,
  partition,
  SCAN_DEPTH,
  SCANNING_TEXT,
} from "@/features/repositories/add-repository";
import { ScanCloneRow } from "@/features/repositories/ScanCloneRow";
import { messageOf } from "@/lib/errors";
import { displayPaths } from "@/lib/paths";
import type { RepositoryCandidate } from "@/lib/wails";
import { addRepository, browseRepository, scanRepositories } from "@/store/actions";
import { useRepositories } from "@/store/app-store";

export interface AddRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUBTITLE = `Pick the clones to register. The scan looks through your home folder, up to ${SCAN_DEPTH} folders deep.`;
const WAIT_TEXT = "Wait for the scan to end.";
const CHECK_TEXT = "Check the clones to add.";
const LIST_STYLE = "divide-y divide-line-1 rounded-md border border-line-1";

/** AddRepositoryDialog registers clones the scan of the home folder found, or one the user browses to. */
export function AddRepositoryDialog({ open, onOpenChange }: AddRepositoryDialogProps) {
  // The form lives only while the dialog is open, so every opening scans again.
  if (!open) {
    return null;
  }
  return <AddRepositoryForm onOpenChange={onOpenChange} />;
}

type Scan =
  | { status: "scanning" }
  | { status: "failed"; message: string }
  | { status: "done"; candidates: RepositoryCandidate[] };

function AddRepositoryForm({ onOpenChange }: Pick<AddRepositoryDialogProps, "onOpenChange">) {
  const repositories = useRepositories();
  const [scan, setScan] = useState<Scan>({ status: "scanning" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refusals, setRefusals] = useState<Record<string, string>>({});
  const [browseRefusal, setBrowseRefusal] = useState<string | null>(null);
  const filter = useRef<HTMLInputElement>(null);
  const reasonId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt only restarts the scan.
  useEffect(() => {
    let cancelled = false;
    setScan({ status: "scanning" });
    scanRepositories()
      .then((candidates) => {
        if (!cancelled) {
          setScan({ status: "done", candidates });
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setScan({ status: "failed", message: displayPaths(messageOf(failure)) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const done = scan.status === "done";
  // The filter takes the focus when the scan ends, with something to filter.
  const hasCandidates = done && scan.candidates.length > 0;
  useEffect(() => {
    if (hasCandidates) {
      filter.current?.focus();
    }
  }, [hasCandidates]);

  const candidates = done ? scan.candidates : [];
  const { available, registered } = partition(filterCandidates(candidates, query));

  const toggle = (path: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });

  const add = async () => {
    if (saving || selected.size === 0) {
      return;
    }
    setSaving(true);
    setRefusals({});
    const refused: Record<string, string> = {};
    const paths = partition(candidates)
      .available.map((candidate) => candidate.path)
      .filter((path) => selected.has(path));
    for (const path of paths) {
      setAdding(path);
      try {
        await addRepository(path);
        toggle(path, false);
        setAdded((current) => new Set(current).add(path));
      } catch (failure) {
        refused[path] = displayPaths(messageOf(failure));
      }
    }
    setAdding(null);
    setRefusals(refused);
    setSaving(false);
    if (Object.keys(refused).length === 0) {
      onOpenChange(false);
    }
  };

  const browse = async () => {
    setBrowseRefusal(null);
    try {
      // A cancelled chooser registers nothing: the dialog stays.
      if (await browseRepository()) {
        onOpenChange(false);
      }
    } catch (failure) {
      setBrowseRefusal(displayPaths(messageOf(failure)));
    }
  };

  const footerReason = scan.status === "scanning" ? WAIT_TEXT : CHECK_TEXT;
  const blocked = scan.status === "scanning" || selected.size === 0;

  const row = (candidate: RepositoryCandidate, inRegistered: boolean) => (
    <ScanCloneRow
      key={candidate.path}
      candidate={candidate}
      checked={selected.has(candidate.path)}
      disabled={inRegistered || saving}
      adding={adding === candidate.path}
      refusal={refusals[candidate.path] ?? ""}
      linksAClone={
        !inRegistered && !added.has(candidate.path) && linksAClone(candidate, repositories)
      }
      registered={added.has(candidate.path)}
      onCheckedChange={(checked) => toggle(candidate.path, checked)}
    />
  );

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // While the clones are registered, the dialog stays: a refusal that comes back has its row.
        if (!next && saving) {
          return;
        }
        onOpenChange(next);
      }}
      size="wide"
      title="Add repository"
      subtitle={SUBTITLE}
      closeDisabled={saving}
      onConfirm={() => {
        if (!blocked) {
          void add();
        }
      }}
    >
      <DialogBody className="overflow-hidden">
        {scan.status === "scanning" ? (
          <p role="status" className="flex items-center gap-2">
            <Spinner tone="current" />
            {SCANNING_TEXT}
          </p>
        ) : scan.status === "failed" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="min-w-0 text-state-error">
              {`Couldn't scan your home folder: ${scan.message}`}
            </p>
            <Button variant="ghost" size="xs" onClick={() => setAttempt((current) => current + 1)}>
              Try again
            </Button>
          </div>
        ) : scan.candidates.length === 0 ? (
          <p>{NO_CANDIDATES_TEXT}</p>
        ) : (
          <>
            <SearchInput
              label="Filter by name or path"
              placeholder="Filter by name or path"
              value={query}
              onValueChange={setQuery}
              inputRef={filter}
              landmark={false}
              className="shrink-0"
            />
            {available.length === 0 && registered.length === 0 ? (
              <p>No repositories match.</p>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                {available.length > 0 && (
                  <ul className={LIST_STYLE}>
                    {available.map((candidate) => row(candidate, false))}
                  </ul>
                )}
                {registered.length > 0 && (
                  <Collapsible className="flex flex-col gap-2">
                    <CollapsibleTrigger
                      chevronSize="xs"
                      className="flex h-(--size-control) items-center gap-2 text-left text-(length:--text-body) leading-(--leading-body) outline-none focus-visible:focus-ring"
                    >
                      <span className="font-medium text-ink-1">Already registered</span>{" "}
                      <span className="text-(length:--text-micro) text-ink-4">
                        {registered.length}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className={LIST_STYLE}>
                        {registered.map((candidate) => row(candidate, true))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter
        {...(browseRefusal !== null ? { refusal: browseRefusal } : {})}
        back={
          <Tooltip content="Pick a folder the scan didn't reach">
            <Button
              variant="ghost"
              icon={ICONS.folder}
              disabled={saving}
              onClick={() => void browse()}
            >
              Browse…
            </Button>
          </Tooltip>
        }
        {...(blocked ? { reason: { id: reasonId, text: footerReason } } : {})}
      >
        <DialogCancel disabled={saving} />
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          disabled={blocked}
          {...(blocked ? { reasonId } : {})}
          loading={saving}
          loadingLabel="Adding…"
          onClick={() => void add()}
        >
          {addLabel(selected.size)}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
