import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Spinner } from "@/components/system/Spinner";
import { messageOf } from "@/lib/errors";
import { cloneMissingText } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository } from "@/store/actions";

export interface UnclonedRepositoryProps {
  repository: Repository;
}

/** UnclonedRepository offers the clone, or the path, a repository of the board is missing. */
export function UnclonedRepository({ repository }: UnclonedRepositoryProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = (run: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    run()
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setBusy(false));
  };
  const failure = error ?? (repository.cloneError === "" ? null : repository.cloneError);

  return (
    <div className="flex flex-col gap-(--space-1-5)">
      <div className="flex items-center justify-between gap-(--space-2)">
        <span className="min-w-0 truncate text-ink-1">{repository.fullName}</span>
        {repository.cloning ? (
          <p role="status" className="flex items-center gap-(--space-1-5) text-ink-3">
            <Spinner />
            Cloning…
          </p>
        ) : repository.missing ? (
          <Button
            size="xs"
            disabled={busy}
            onClick={() => act(() => changeRepositoryPath(repository.id))}
          >
            Change path…
          </Button>
        ) : (
          <Button
            size="xs"
            disabled={busy}
            onClick={() => act(() => cloneRepository(repository.id))}
          >
            Clone
          </Button>
        )}
      </div>
      {repository.missing && (
        <p className="break-all text-(length:--text-micro) text-ink-3">
          {cloneMissingText(repository)}
        </p>
      )}
      {failure !== null && (
        <p role="alert" className="break-all text-(length:--text-micro) text-state-error">
          {failure}
        </p>
      )}
    </div>
  );
}
