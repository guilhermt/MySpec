import { TriangleAlert } from "lucide-react";
import type { PullsFailure } from "@/lib/wails";

export interface ReadFailuresProps {
  failures: readonly PullsFailure[];
}

/**
 * ReadFailures is the repositories the last reading could not read. The pull
 * requests of the others are listed all the same.
 */
export function ReadFailures({ failures }: ReadFailuresProps) {
  if (failures.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 border-b px-4 py-2">
      {failures.map((failure) => (
        <p
          key={failure.repositoryId}
          role="alert"
          className="flex items-start gap-1.5 text-xs text-destructive"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{`${failure.repository}: ${failure.message}`}</span>
        </p>
      ))}
    </div>
  );
}
