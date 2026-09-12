import { Pencil, RotateCcw } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/features/chat/Markdown";
import { ErrorNotice } from "@/features/notice/Notice";
import { PLACEHOLDERS, promptMeta } from "@/features/settings/prompts";
import type { Prompt, PromptStage } from "@/lib/wails";
import { getPrompt, restorePrompt, savePrompt } from "@/store/actions";
import { useAppStore, useSettingsUi } from "@/store/app-store";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** PromptState is one prompt as the pane holds it. */
type PromptState =
  | { status: "loading" }
  | { status: "ready"; prompt: Prompt }
  | { status: "error"; message: string };

/**
 * usePrompt reads the text of one prompt. A late answer to a read the pane no
 * longer waits for is dropped.
 */
function usePrompt(stage: PromptStage): [PromptState, (prompt: Prompt) => void] {
  const [state, setState] = useState<PromptState>({ status: "loading" });

  useEffect(() => {
    let stale = false;
    setState({ status: "loading" });
    getPrompt(stage)
      .then((prompt) => {
        if (!stale) {
          setState({ status: "ready", prompt });
        }
      })
      .catch((reason: unknown) => {
        if (!stale) {
          setState({ status: "error", message: messageOf(reason) });
        }
      });
    return () => {
      stale = true;
    };
  }, [stage]);

  const setPrompt = useCallback((prompt: Prompt) => setState({ status: "ready", prompt }), []);
  return [state, setPrompt];
}

/** PlaceholderReference says what the placeholders of a prompt become, next to the editor. */
function PlaceholderReference({ placeholders }: { placeholders: readonly string[] }) {
  return (
    <aside aria-label="Placeholders" className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">Placeholders</h3>
        <p className="text-xs text-muted-foreground">
          The ones the default of this prompt uses. Move or remove any of them.
        </p>
      </div>
      {placeholders.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">The default uses none.</p>
      ) : (
        <dl className="flex flex-col gap-3">
          {placeholders.map((name) => (
            <div key={name} className="flex flex-col gap-0.5">
              <dt>
                <code className="font-mono text-xs">{name}</code>
              </dt>
              <dd className="text-xs text-muted-foreground">
                {PLACEHOLDERS[name]?.meaning}
                {PLACEHOLDERS[name]?.whenRemoved !== undefined && (
                  <span className="block">{PLACEHOLDERS[name]?.whenRemoved}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

/** PromptPane shows one prompt rendered, and edits its source. */
export function PromptPane({ stage }: { stage: PromptStage }) {
  const { name, description } = promptMeta(stage);
  const { promptEdit } = useSettingsUi();
  const startPromptEdit = useAppStore((state) => state.startPromptEdit);
  const setPromptEditText = useAppStore((state) => state.setPromptEditText);
  const cancelPromptEdit = useAppStore((state) => state.cancelPromptEdit);
  const finishPromptEdit = useAppStore((state) => state.finishPromptEdit);
  const [state, setPrompt] = usePrompt(stage);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadDismissed, setLoadDismissed] = useState(false);

  const prompt = state.status === "ready" ? state.prompt : null;
  const edit = promptEdit !== null && promptEdit.stage === stage ? promptEdit : null;

  const save = () => {
    if (edit === null || saving) {
      return;
    }
    setSaving(true);
    setActionError(null);
    void savePrompt(stage, edit.text)
      .then((saved) => {
        setPrompt(saved);
        finishPromptEdit();
      })
      .catch((reason: unknown) => setActionError(messageOf(reason)))
      .finally(() => setSaving(false));
  };

  const restore = () => {
    setRestoring(false);
    setActionError(null);
    void restorePrompt(stage)
      .then(setPrompt)
      .catch((reason: unknown) => setActionError(messageOf(reason)));
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex shrink-0 flex-col gap-1 border-b px-8 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[1.5rem] font-semibold">{name}</h2>
          {prompt?.modified === true && <Badge variant="secondary">Modified</Badge>}
          <div className="flex-1" />
          {edit === null ? (
            <>
              {prompt?.modified === true && (
                <Button variant="ghost" size="sm" onClick={() => setRestoring(true)}>
                  <RotateCcw />
                  Restore default
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={prompt === null}
                onClick={() => prompt !== null && startPromptEdit(stage, prompt.text)}
              >
                <Pencil />
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={cancelPromptEdit}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      {actionError !== null && (
        <div className="px-8 pt-4">
          <ErrorNotice message={actionError} onDismiss={() => setActionError(null)} />
        </div>
      )}

      {state.status === "loading" && (
        <div className="flex flex-col gap-3 px-8 py-6">
          {LOADING_WIDTHS.map((width) => (
            <Skeleton key={width} className={`h-4 ${width}`} />
          ))}
        </div>
      )}

      {state.status === "error" && !loadDismissed && (
        <div className="px-8 py-6">
          <ErrorNotice message={state.message} onDismiss={() => setLoadDismissed(true)} />
        </div>
      )}

      {prompt !== null &&
        (edit === null ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-[58.5rem] select-text">
              <Markdown>{prompt.text}</Markdown>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-6 px-8 py-6">
            <Textarea
              aria-label={`${name} prompt`}
              value={edit.text}
              onChange={(event) => setPromptEditText(event.target.value)}
              onKeyDown={onEditorKeyDown}
              spellCheck={false}
              autoFocus
              // field-sizing-fixed undoes the growth of the component, so the
              // field takes the area instead of the length of the text.
              className="h-full min-h-0 flex-1 resize-none field-sizing-fixed font-mono text-[0.8125rem] leading-relaxed"
            />
            <PlaceholderReference placeholders={prompt.placeholders ?? []} />
          </div>
        ))}

      <AlertDialog
        open={restoring}
        onOpenChange={(open) => {
          if (!open) {
            setRestoring(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Restore the default ${name} prompt?`}</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits are replaced by the default of this version of the app, and the prompt
              follows the default of new versions again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={restore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
