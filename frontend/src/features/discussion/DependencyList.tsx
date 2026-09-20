import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { dependencyLabel, refKey, refValue } from "@/features/discussion/discussion-status";
import { messageOf } from "@/lib/errors";
import type { Draft, DraftDependency } from "@/lib/wails";
import { asDependencyDrop } from "@/lib/wails";
import { addDraftDependency, removeDraftDependency } from "@/store/actions";

export interface DependencyListProps {
  discussionId: string;
  draft: Draft;
  /** readOnly is a draft the publication already started on: nothing about it changes any more. */
  readOnly: boolean;
}

// What became of a dependency on GitHub, null while nothing has.
function stateOf(dependency: DraftDependency): string | null {
  switch (asDependencyDrop(dependency.dropped)) {
    case "discarded":
      return "Dropped: discarded";
    case "unavailable":
      return `Couldn't record: ${dependency.detail}`;
    case "":
      return dependency.linked ? "Linked" : null;
  }
}

/**
 * DependencyList is what a draft can only start after: the dependencies it
 * carries, the ones the card already has on GitHub, and the field that adds
 * one.
 */
export function DependencyList({ discussionId, draft, readOnly }: DependencyListProps) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const dependencies = draft.dependencies ?? [];
  // The dependencies the card has on GitHub and the draft does not: they stay
  // there, and the draft says nothing about them.
  const taken = new Set(dependencies.map(refKey));
  const onGitHub = (draft.current?.dependencies ?? []).filter((each) => !taken.has(refKey(each)));

  const add = async () => {
    const value = reference.trim();
    if (value === "") {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await addDraftDependency(discussionId, draft.id, value);
      setReference("");
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-col gap-1">
        {dependencies.map((dependency) => {
          const state = stateOf(dependency);
          const removable = !readOnly && !dependency.linked;
          return (
            <li key={refKey(dependency)} className="flex items-center gap-2 text-xs">
              {dependency.url === "" ? (
                <span className="min-w-0 truncate">{dependencyLabel(dependency)}</span>
              ) : (
                <ExternalLink
                  href={dependency.url}
                  className="min-w-0 truncate underline-offset-4 hover:underline"
                >
                  {dependencyLabel(dependency)}
                </ExternalLink>
              )}
              {state !== null && <span className="text-muted-foreground">{state}</span>}
              <span className="flex-1" />
              {removable && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove dependency ${refValue(dependency)}`}
                  onClick={() =>
                    void removeDraftDependency(discussionId, draft.id, refValue(dependency))
                  }
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </li>
          );
        })}
        {onGitHub.map((dependency) => (
          <li
            key={refKey(dependency)}
            className="flex items-center gap-2 text-xs text-muted-foreground opacity-60"
          >
            <span className="min-w-0 truncate">{dependencyLabel(dependency)}</span>
            <span>On GitHub</span>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Input
            aria-label="Add a dependency"
            placeholder="Draft id or owner/name#N"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="h-7 text-xs"
          />
          <Button type="submit" variant="outline" size="xs" disabled={adding}>
            Add
          </Button>
          {error !== null && (
            <span role="alert" className="min-w-0 truncate text-xs text-destructive" title={error}>
              {error}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
