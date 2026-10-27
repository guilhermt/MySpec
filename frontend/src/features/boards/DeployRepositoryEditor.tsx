import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { IconButton } from "@/components/system/IconButton";
import { Input } from "@/components/system/Input";
import { ICONS } from "@/components/system/icons";
import { Select, type SelectOption } from "@/components/system/Select";
import { StateGlyph } from "@/components/system/StateGlyph";
import {
  MIN_ENVIRONMENTS,
  missingBranch,
  type RepositoryState,
} from "@/features/boards/deploys-dialog";
import type { DeployEnvironmentSettings } from "@/lib/wails";

const GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-(--space-2)";
const META = "text-(length:--text-meta) leading-(--leading-meta)";
const NO_WORKFLOWS = "The workflows couldn't be read.";
const FIRST_ENVIRONMENT =
  "Receives the pull requests of the tasks. Its deploy runs show; it has no promotion.";

export interface DeployRepositoryEditorProps {
  repository: RepositoryState;
  disabled: boolean;
  onChange: (index: number, patch: Partial<DeployEnvironmentSettings>) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  /** onBranchCommit is called when a Branch field is left with another value, for GitHub to be asked again. */
  onBranchCommit: () => void;
}

/** DeployRepositoryEditor is the grid of environments of a repository: name, branch and workflow of each, in the order the code moves. */
export function DeployRepositoryEditor({
  repository,
  disabled,
  onChange,
  onMove,
  onRemove,
  onAdd,
  onBranchCommit,
}: DeployRepositoryEditorProps) {
  const { fullName, environments, options } = repository;
  const root = useRef<HTMLDivElement>(null);
  const branchAtFocus = useRef("");
  // The button that moved an environment follows it, so the keyboard can move it again.
  const [following, setFollowing] = useState<string | null>(null);
  useEffect(() => {
    if (following === null) {
      return;
    }
    root.current?.querySelector<HTMLElement>(`[aria-label="${following}"]`)?.focus();
    setFollowing(null);
  }, [following]);

  const nameOf = (index: number, field: string) =>
    `${field} of environment ${index + 1} of ${fullName}`;
  const actionOn = (index: number, action: string) =>
    `${action} environment ${index + 1} of ${fullName}`;

  return (
    <div ref={root} className="flex flex-col gap-(--space-2)">
      <div aria-hidden="true" className={`${GRID} ${META} font-medium text-ink-2`}>
        <span>Name</span>
        <span>Branch</span>
        <span>Workflow</span>
        <span className="w-[calc(3*var(--size-control)+2*var(--space-1))]" />
      </div>
      {environments.map((environment, index) => {
        const missing = missingBranch(repository, environment.branch);
        const up = actionOn(index, "Move up");
        const down = actionOn(index, "Move down");
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: an environment is its position, and the fields are controlled by the state
          <div key={index} className="flex flex-col gap-(--space-1)">
            <div className={`${GRID} items-start`}>
              <Input
                aria-label={nameOf(index, "Name")}
                placeholder="Staging"
                value={environment.name}
                disabled={disabled}
                onChange={(event) => onChange(index, { name: event.target.value })}
              />
              <div className="flex min-w-0 flex-col gap-(--space-1)">
                <Input
                  mono
                  aria-label={nameOf(index, "Branch")}
                  placeholder="staging"
                  value={environment.branch}
                  disabled={disabled}
                  onChange={(event) => onChange(index, { branch: event.target.value })}
                  onFocus={() => {
                    branchAtFocus.current = environment.branch;
                  }}
                  onBlur={() => {
                    if (environment.branch.trim() !== branchAtFocus.current.trim()) {
                      onBranchCommit();
                    }
                  }}
                />
                {missing && (
                  <span className={`flex items-center gap-(--space-1-5) ${META} text-ink-2`}>
                    <StateGlyph state="blocked" />
                    {`No branch ${environment.branch.trim()} on GitHub.`}
                  </span>
                )}
              </div>
              <Select
                label={nameOf(index, "Workflow")}
                placeholder="Choose a workflow"
                value={environment.workflowId === 0 ? "" : String(environment.workflowId)}
                options={workflowOptions(repository, environment)}
                loading={options.status === "reading"}
                disabled={disabled || options.status === "failed"}
                {...(options.status === "failed" ? { disabledReason: NO_WORKFLOWS } : {})}
                onValueChange={(value) => {
                  const workflow =
                    options.status === "ready"
                      ? options.workflows.find((each) => String(each.id) === value)
                      : undefined;
                  if (workflow !== undefined) {
                    onChange(index, {
                      workflowId: workflow.id,
                      workflowName: workflow.name,
                      workflowPath: workflow.path,
                    });
                  }
                }}
              />
              <div className="flex items-center gap-(--space-1)">
                <IconButton
                  label={up}
                  tooltip="Move up"
                  icon={ICONS.moveUp}
                  disabled={disabled || index === 0}
                  onClick={() => {
                    onMove(index, -1);
                    setFollowing(actionOn(index - 1, "Move up"));
                  }}
                />
                <IconButton
                  label={down}
                  tooltip="Move down"
                  icon={ICONS.moveDown}
                  disabled={disabled || index === environments.length - 1}
                  onClick={() => {
                    onMove(index, 1);
                    setFollowing(actionOn(index + 1, "Move down"));
                  }}
                />
                <IconButton
                  label={actionOn(index, "Remove")}
                  tooltip="Remove"
                  icon={ICONS.trash}
                  disabled={disabled || environments.length <= MIN_ENVIRONMENTS}
                  {...(environments.length <= MIN_ENVIRONMENTS
                    ? {
                        disabledReason: `A repository needs at least two environments.`,
                      }
                    : {})}
                  onClick={() => onRemove(index)}
                />
              </div>
            </div>
            {index === 0 && <p className={`${META} text-ink-3`}>{FIRST_ENVIRONMENT}</p>}
          </div>
        );
      })}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={ICONS.plus}
          disabled={disabled}
          aria-label={`Add environment to ${fullName}`}
          onClick={onAdd}
        >
          Add environment
        </Button>
      </div>
    </div>
  );
}

/** workflowOptions are the workflows of the repository, and the one already chosen when GitHub didn't list it. */
function workflowOptions(
  repository: RepositoryState,
  environment: DeployEnvironmentSettings,
): SelectOption[] {
  const listed =
    repository.options.status === "ready"
      ? repository.options.workflows.map((workflow) => ({
          value: String(workflow.id),
          label: workflow.name,
          sub: workflow.path,
        }))
      : [];
  const chosen = String(environment.workflowId);
  if (environment.workflowId === 0 || listed.some((option) => option.value === chosen)) {
    return listed;
  }
  return [
    ...listed,
    { value: chosen, label: environment.workflowName, sub: environment.workflowPath },
  ];
}
