import { useId } from "react";
import { Checkbox } from "@/components/system/Checkbox";
import { displayPath } from "@/lib/paths";
import type { RepositoryCandidate } from "@/lib/wails";

export interface ScanCloneRowProps {
  candidate: RepositoryCandidate;
  checked: boolean;
  disabled: boolean;
  /** adding draws the spinner where the box is: the clone is being registered. */
  adding: boolean;
  /** refusal is why the clone was not registered; "" without one. */
  refusal: string;
  /** linksAClone says the clone ties to a repository registered without one. */
  linksAClone: boolean;
  /** registered is a clone this dialog just registered, which stays in its place. */
  registered: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const LINKS_TEXT = "Registered without a clone: this links the clone to it.";

/** ScanCloneRow is one clone the scan found: the box, the repository, the path and what registering it does or answered. */
export function ScanCloneRow({
  candidate,
  checked,
  disabled,
  adding,
  refusal,
  linksAClone,
  registered,
  onCheckedChange,
}: ScanCloneRowProps) {
  const linkId = useId();
  const refusalId = useId();
  const describedBy = [linksAClone ? linkId : "", refusal !== "" ? refusalId : ""]
    .filter((id) => id !== "")
    .join(" ");

  return (
    <li className="flex flex-col px-3 py-1.5">
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled || registered}
        loading={adding}
        {...(describedBy !== "" ? { describedBy } : {})}
        className="h-auto py-1"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="font-medium">{candidate.fullName}</span>{" "}
            {registered && <span className="font-normal text-ink-3">Registered</span>}
          </span>{" "}
          <span className="break-all font-mono text-ink-3">{displayPath(candidate.path)}</span>
        </span>
      </Checkbox>
      {linksAClone && (
        <p
          id={linkId}
          className="pb-1 pl-[calc(var(--space-2)+var(--icon)+var(--space-2))] text-(length:--text-meta) leading-(--leading-meta) text-ink-2"
        >
          {LINKS_TEXT}
        </p>
      )}
      {refusal !== "" && (
        <p
          id={refusalId}
          role="alert"
          className="pb-1 pl-[calc(var(--space-2)+var(--icon)+var(--space-2))] text-(length:--text-meta) leading-(--leading-meta) text-state-error"
        >
          {refusal}
        </p>
      )}
    </li>
  );
}
