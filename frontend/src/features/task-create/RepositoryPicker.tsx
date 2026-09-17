import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { messageOf } from "@/lib/errors";
import { cloneMissingText, findRepository } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { cloneRepository } from "@/store/actions";
import { useAppStore, useRepositories } from "@/store/app-store";

export interface RepositoryPickerProps {
  value: string;
  onChange: (id: string) => void;
}

// The line under a repository the dialog cannot create a task in, null for one it can.
function unusableText(repository: Repository): string | null {
  if (!repository.cloned) {
    return repository.cloning ? "Cloning…" : "Not cloned";
  }
  return repository.missing ? cloneMissingText(repository) : null;
}

/** RepositoryPicker is the repository a new task belongs to. */
export function RepositoryPicker({ value, onChange }: RepositoryPickerProps) {
  const app = useAppStore((state) => state.app);
  const repositories = useRepositories();
  const label = findRepository(app, value)?.fullName ?? "Choose a repository";

  // A clone that cannot start shows under the picker: the dialog covers the banner.
  const [error, setError] = useState<string | null>(null);

  const clone = async (id: string) => {
    setError(null);
    try {
      await cloneRepository(id);
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="w-full justify-between" />}
          aria-label={`Repository: ${label}`}
        >
          <span className="min-w-0 truncate text-left">{label}</span>
          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuRadioGroup value={value} onValueChange={(id) => onChange(id)}>
            {repositories.map((repository) => {
              const unusable = unusableText(repository);
              return (
                <div key={repository.id} className="flex items-center gap-1">
                  <DropdownMenuRadioItem
                    value={repository.id}
                    disabled={unusable !== null}
                    className="min-w-0 flex-1"
                  >
                    <span className="flex flex-col">
                      <span>{repository.fullName}</span>
                      {unusable !== null && (
                        <span className="text-xs text-muted-foreground">{unusable}</span>
                      )}
                      {!repository.cloning && repository.cloneError !== "" && (
                        <span className="break-all text-xs text-destructive">
                          {repository.cloneError}
                        </span>
                      )}
                    </span>
                  </DropdownMenuRadioItem>
                  {/* A disabled item takes no clicks, so the clone is an item of its own beside it. */}
                  {!repository.cloned && (
                    <DropdownMenuItem
                      aria-label={`Clone ${repository.fullName}`}
                      disabled={repository.cloning}
                      className="border text-xs"
                      onClick={() => void clone(repository.id)}
                    >
                      Clone
                    </DropdownMenuItem>
                  )}
                </div>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
