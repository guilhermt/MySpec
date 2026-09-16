import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { messageOf } from "@/lib/errors";
import { ALL_REPOSITORIES, cloneMissingText } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath } from "@/store/actions";
import { useRepositories, useRepositoryFilter } from "@/store/app-store";

/** MissingClone warns about one repository whose clone is gone, and offers the way out. */
function MissingClone({ repository }: { repository: Repository }) {
  const [error, setError] = useState<string | null>(null);

  const change = async () => {
    setError(null);
    try {
      await changeRepositoryPath(repository.id);
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <div role="status" className="flex flex-col gap-1 border-b px-3 py-2 text-xs">
      <p className="flex items-start gap-1.5">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-3.5 shrink-0 text-[var(--status-attention)]"
        />
        <span className="break-all">{cloneMissingText(repository)}</span>
      </p>
      <Button
        variant="link"
        size="xs"
        className="h-auto self-start p-0"
        onClick={() => void change()}
      >
        Change path
      </Button>
      {error !== null && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** MissingClones warns about every repository the filter shows whose clone is gone. */
export function MissingClones() {
  const repositories = useRepositories();
  const filter = useRepositoryFilter();
  const missing = repositories.filter(
    (repository) => repository.missing && (filter === ALL_REPOSITORIES || repository.id === filter),
  );

  if (missing.length === 0) {
    return null;
  }

  return (
    <>
      {missing.map((repository) => (
        <MissingClone key={repository.id} repository={repository} />
      ))}
    </>
  );
}
