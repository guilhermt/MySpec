import { prBlockHint, prBlockTitle } from "@/features/task/pr-status";
import { asPRBlockReason, type PullRequest } from "@/lib/wails";

export interface PRBlockedProps {
  pr: PullRequest;
}

/**
 * PRBlocked is why the PR stage of a task could not go on; the way out is on the request bar. What
 * gh or git said is shown as they said it, never translated.
 */
export function PRBlocked({ pr }: PRBlockedProps) {
  const reason = asPRBlockReason(pr.block?.reason ?? "");
  const detail = pr.block?.detail ?? "";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[58.5rem] flex-col gap-4">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <p className="font-medium">{prBlockTitle(reason)}</p>
          <p className="text-sm">{prBlockHint(reason)}</p>
          {detail !== "" && (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap select-text">
              {detail}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
