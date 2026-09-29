import { useEffect, useRef } from "react";
import { Field } from "@/components/system/Field";
import { Input } from "@/components/system/Input";
import { Textarea } from "@/components/system/Textarea";
import { prBaseName } from "@/lib/pull-requests";
import type { PullRequest } from "@/lib/wails";
import { useAppStore, usePrDraft } from "@/store/app-store";

export interface DraftCardProps {
  taskId: string;
  pr: PullRequest;
}

/**
 * DraftCard is the pull request the agent wrote, as the user edits it, at the end of the
 * conversation of the PR. The draft on disk is the starting point; what the user types survives
 * every update but one, and only Approve draft on the request bar sends it. It is one stop of the
 * feed, and its fields keep their keys: the arrows move in the text, not through the conversation.
 */
export function DraftCard({ taskId, pr }: DraftCardProps) {
  const edited = usePrDraft(taskId);
  const setPrDraft = useAppStore((state) => state.setPrDraft);
  const clearPrDraft = useAppStore((state) => state.clearPrDraft);

  const fileTitle = pr.draft?.title ?? "";
  const fileBody = pr.draft?.body ?? "";
  const written = useRef({ key: taskId, fileTitle, fileBody });

  // The one update the edit of the user does not survive is the agent writing
  // the draft again: that is what the user asked for, so it wins.
  useEffect(() => {
    const seen = written.current;
    written.current = { key: taskId, fileTitle, fileBody };
    if (seen.key !== taskId || (seen.fileTitle === fileTitle && seen.fileBody === fileBody)) {
      return;
    }
    clearPrDraft(taskId);
  }, [taskId, fileTitle, fileBody, clearPrDraft]);

  const title = edited?.title ?? fileTitle;
  const body = edited?.body ?? fileBody;

  const edit = (next: { title?: string; body?: string }) =>
    setPrDraft(taskId, { title, body, ...next });

  return (
    <article
      data-feed-item
      data-feed-keys="own"
      tabIndex={-1}
      aria-label="Pull request draft"
      className="flex flex-col rounded-lg bg-surface-2 shadow-xs outline-none focus-visible:focus-ring"
    >
      <div className="flex items-center gap-(--space-2) px-(--space-4) py-(--space-2) text-(length:--text-meta) leading-(--leading-meta) shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        <p className="font-medium text-ink-2">Pull request draft</p>
        <p className="ml-auto text-ink-3">{`into ${prBaseName(pr)}`}</p>
      </div>
      <div className="flex flex-col gap-(--space-3) px-(--space-4) pt-(--space-3) pb-(--space-4)">
        <Field label="Title">
          <Input value={title} onChange={(event) => edit({ title: event.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea
            mono
            value={body}
            onChange={(event) => edit({ body: event.target.value })}
            className="max-h-[calc(var(--leading-body)*18+1rem)]"
          />
        </Field>
      </div>
    </article>
  );
}
