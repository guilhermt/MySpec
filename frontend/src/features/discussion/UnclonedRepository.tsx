import { useState } from "react";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Spinner } from "@/components/system/Spinner";
import { READS_CLONES } from "@/features/discussion/new-discussion";
import { messageOf } from "@/lib/errors";
import { cloneMissingText } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository } from "@/store/actions";

export interface UnclonedRepositoryProps {
  repository: Repository;
  /** layout is a line of a list, or a notice strip under a line, saying what the conversation reads. */
  layout?: "line" | "strip";
}

/** UnclonedRepository offers the clone, or the path, a repository of the board is missing. */
export function UnclonedRepository({ repository, layout = "line" }: UnclonedRepositoryProps) {
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

  if (layout === "strip") {
    if (repository.cloning) {
      return (
        <p
          role="status"
          className="flex items-center gap-2 py-1.5 pl-4 text-(length:--text-meta) leading-(--leading-meta) text-ink-2"
        >
          <Spinner />
          {`Cloning ${repository.fullName}…`}
        </p>
      );
    }
    const missing = repository.missing;
    return (
      <NoticeStrip
        title={
          missing
            ? `The clone of ${repository.fullName} at ${repository.path} is missing.`
            : `${repository.fullName} isn't cloned.`
        }
        reason={READS_CLONES}
        action={
          <Button
            size="xs"
            variant="ghost"
            {...(missing ? {} : { icon: ICONS.clone })}
            disabled={busy}
            onClick={() =>
              act(() =>
                missing ? changeRepositoryPath(repository.id) : cloneRepository(repository.id),
              )
            }
          >
            {missing ? "Change path…" : failure === null ? "Clone" : "Try the clone again"}
          </Button>
        }
        {...(failure !== null ? { error: failure } : {})}
      />
    );
  }

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
