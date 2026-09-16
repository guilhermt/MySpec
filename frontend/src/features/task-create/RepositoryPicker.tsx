import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cloneMissingText, findRepository } from "@/lib/repositories";
import { useAppStore, useRepositories } from "@/store/app-store";

export interface RepositoryPickerProps {
  value: string;
  onChange: (id: string) => void;
}

/** RepositoryPicker is the repository a new task belongs to. */
export function RepositoryPicker({ value, onChange }: RepositoryPickerProps) {
  const app = useAppStore((state) => state.app);
  const repositories = useRepositories();
  const label = findRepository(app, value)?.fullName ?? "Choose a repository";

  return (
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
          {repositories.map((repository) => (
            <DropdownMenuRadioItem
              key={repository.id}
              value={repository.id}
              disabled={repository.missing}
            >
              <span className="flex flex-col">
                <span>{repository.fullName}</span>
                {repository.missing && (
                  <span className="text-xs text-muted-foreground">
                    {cloneMissingText(repository)}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
