import { ChevronsUpDown, FolderGit2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_REPOSITORIES, filterLabel } from "@/lib/repositories";
import { setRepositoryFilter } from "@/store/actions";
import { useAppStore, useRepositories, useRepositoryFilter } from "@/store/app-store";

export interface RepositoryFilterProps {
  className?: string;
}

/** RepositoryFilter picks the repository the history shows, as a bordered control next to its search. */
export function RepositoryFilter({ className }: RepositoryFilterProps) {
  const app = useAppStore((state) => state.app);
  const repositories = useRepositories();
  const filter = useRepositoryFilter();
  const label = filterLabel(app, filter);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`Repository filter: ${label}`}
        className={className}
      >
        <FolderGit2 aria-hidden="true" className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={filter} onValueChange={(id) => void setRepositoryFilter(id)}>
          <DropdownMenuRadioItem value={ALL_REPOSITORIES}>All repositories</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {repositories.map((repository) => (
            <DropdownMenuRadioItem key={repository.id} value={repository.id}>
              <span className="min-w-0 truncate">{repository.fullName}</span>
              {repository.missing && (
                <>
                  <TriangleAlert
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-[var(--status-attention)]"
                  />
                  <span className="sr-only">, clone missing</span>
                </>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
