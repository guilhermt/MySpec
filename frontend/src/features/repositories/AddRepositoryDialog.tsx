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
import {
  addLabel,
  filterCandidates,
  NO_CANDIDATES_TEXT,
  SCAN_DEPTH,
  SCANNING_TEXT,
} from "@/features/repositories/add-repository";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { RepositoryCandidate } from "@/lib/wails";
import { addRepository, browseRepository, scanRepositories } from "@/store/actions";

export interface AddRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** AddRepositoryDialog registers clones the scan of the home folder found, or one the user browses to. */
export function AddRepositoryDialog({ open, onOpenChange }: AddRepositoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form lives only while the dialog is open, so every opening scans again. */}
      {open && <AddRepositoryForm onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function AddRepositoryForm({ onOpenChange }: Pick<AddRepositoryDialogProps, "onOpenChange">) {
  const [candidates, setCandidates] = useState<RepositoryCandidate[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [browseError, setBrowseError] = useState<string | null>(null);
  const nameId = useId();

  useEffect(() => {
    let cancelled = false;
    scanRepositories()
      .then((found) => {
        if (!cancelled) {
          setCandidates(found);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setScanError(messageOf(failure));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (path: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  const add = async () => {
    setAdding(true);
    setRowErrors({});
    const errors: Record<string, string> = {};
    const paths = (candidates ?? [])
      .map((candidate) => candidate.path)
      .filter((path) => selected.has(path));
    for (const path of paths) {
      try {
        await addRepository(path);
        toggle(path, false);
        setCandidates(
          (current) =>
            current?.map((candidate) =>
              candidate.path === path ? { ...candidate, registered: true } : candidate,
            ) ?? null,
        );
      } catch (failure) {
        errors[path] = messageOf(failure);
      }
    }
    setRowErrors(errors);
    setAdding(false);
    if (Object.keys(errors).length === 0) {
      onOpenChange(false);
    }
  };

  const browse = async () => {
    setBrowseError(null);
    try {
      // A cancelled chooser registers nothing: the dialog stays.
      if (await browseRepository()) {
        onOpenChange(false);
      }
    } catch (failure) {
      setBrowseError(messageOf(failure));
    }
  };

  const visible = candidates === null ? [] : filterCandidates(candidates, query);

  return (
    <DialogContent className="sm:max-w-[40rem]">
      <DialogHeader>
        <DialogTitle>Add repository</DialogTitle>
        <DialogDescription>
          {`Pick the clones to register. The scan looks through your home folder, up to ${SCAN_DEPTH} folders deep.`}
        </DialogDescription>
      </DialogHeader>

      {scanError !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {scanError}
        </p>
      ) : candidates === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {SCANNING_TEXT}
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{NO_CANDIDATES_TEXT}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            aria-label="Filter repositories"
            placeholder="Filter by name or path"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repositories match.</p>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto">
              <ul className="flex flex-col divide-y rounded-lg border">
                {visible.map((candidate, index) => (
                  <li key={candidate.path}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 px-4 py-3",
                        candidate.registered && "cursor-default opacity-70",
                      )}
                    >
                      <Checkbox
                        // The label wraps the whole row; the checkbox is named by the repository alone.
                        aria-labelledby={`${nameId}-${index}`}
                        checked={selected.has(candidate.path)}
                        disabled={candidate.registered || adding}
                        onCheckedChange={(checked) => toggle(candidate.path, checked)}
                        className="mt-0.5"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span id={`${nameId}-${index}`} className="font-medium">
                            {candidate.fullName}
                          </span>
                          {candidate.registered && (
                            <span className="text-xs text-muted-foreground">Registered</span>
                          )}
                        </span>
                        <span className="break-all font-mono text-xs text-muted-foreground">
                          {candidate.path}
                        </span>
                        {rowErrors[candidate.path] !== undefined && (
                          <span role="alert" className="text-xs text-destructive">
                            {rowErrors[candidate.path]}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <DialogFooter className="sm:flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void browse()}
          disabled={adding}
          className="mr-auto"
        >
          Browse…
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={() => void add()} disabled={selected.size === 0 || adding}>
          {addLabel(selected.size)}
        </Button>
        {browseError !== null && (
          <p role="alert" className="basis-full text-sm text-destructive">
            {browseError}
          </p>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
