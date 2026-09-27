import { Select, type SelectOption } from "@/components/system/Select";
import { ALL_REPOSITORIES } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { setRepositoryFilter } from "@/store/actions";
import { useRepositories, useRepositoryFilter } from "@/store/app-store";

/** ALL is the choice that shows every repository. */
const ALL: SelectOption = { value: ALL_REPOSITORIES, label: "All repositories" };

/** repositoryOption is a repository as the filter offers it, with what keeps it from being worked on. */
function repositoryOption(repository: Repository): SelectOption {
  const option: SelectOption = { value: repository.id, label: repository.fullName };
  if (repository.missing) {
    return { ...option, sub: "· clone missing" };
  }
  if (!repository.cloned) {
    return { ...option, sub: "· not cloned" };
  }
  return option;
}

/** SidebarFilter picks the repository whose tasks the tree shows: every one, or one of them. */
export function SidebarFilter() {
  const repositories = useRepositories();
  const filter = useRepositoryFilter();
  const options = [
    ALL,
    ...[...repositories].sort((a, b) => a.fullName.localeCompare(b.fullName)).map(repositoryOption),
  ];

  return (
    <div className="shrink-0 px-(--space-2) pb-(--space-4)">
      <Select
        variant="sidebar"
        label="Repository filter"
        value={filter}
        options={options}
        placeholder={ALL.label}
        onValueChange={(id) => void setRepositoryFilter(id)}
      />
    </div>
  );
}
