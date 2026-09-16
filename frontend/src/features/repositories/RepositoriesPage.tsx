import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RepositoryRow } from "@/features/repositories/RepositoryRow";
import { messageOf } from "@/lib/errors";
import { addRepository } from "@/store/actions";
import { useRepositories } from "@/store/app-store";

/** RepositoriesPage is the settings page of the repositories the tasks belong to. */
export function RepositoriesPage() {
  const repositories = useRepositories();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      await addRepository();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="h-full overflow-y-auto p-8">
      <div className="flex w-full max-w-[43rem] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-[1.5rem] font-semibold">Repositories</h2>
            <span className="flex-1" />
            <Button size="sm" onClick={() => void add()} disabled={adding}>
              <Plus />
              Add repository
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            The repositories your tasks belong to, each tied to its local clone.
          </p>
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </header>
        <ul className="flex flex-col divide-y rounded-lg border">
          {repositories.map((repository) => (
            <RepositoryRow key={repository.id} repository={repository} />
          ))}
        </ul>
      </div>
    </section>
  );
}
