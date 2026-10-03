import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { Placeholder } from "@/components/system/Placeholder";
import { Textarea } from "@/components/system/Textarea";
import { PLACEHOLDERS, promptMeta } from "@/features/settings/prompts";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { messageOf } from "@/lib/errors";
import type { Prompt, PromptStage } from "@/lib/wails";
import { savePrompt } from "@/store/actions";
import { useAppStore, useSettingsUi } from "@/store/app-store";

export interface PromptEditorProps {
  stage: PromptStage;
  /** prompt is the prompt as the page read it: its placeholders are the ones of the default. */
  prompt: Prompt;
  /** onSaved takes the prompt the save answered with. */
  onSaved: (prompt: Prompt) => void;
}

/** PlaceholderColumn says what each placeholder of the default prompt becomes, beside the editor. */
function PlaceholderColumn({ placeholders }: { placeholders: readonly string[] }) {
  return (
    <aside
      aria-label="Placeholders"
      className="flex flex-col gap-(--space-3) self-start @min-[821px]/main:sticky @min-[821px]/main:top-(--space-8)"
    >
      <div className="flex flex-col gap-(--space-1)">
        <h3 className="text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
          Placeholders
        </h3>
        <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          The ones the default uses. Move or remove any of them.
        </p>
      </div>
      {placeholders.length === 0 ? (
        <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          The default uses none.
        </p>
      ) : (
        <dl className="flex flex-col gap-(--space-3)">
          {placeholders.map((name) => (
            <div key={name} className="flex flex-col items-start gap-(--space-1)">
              <dt>
                <Placeholder>{name}</Placeholder>
              </dt>
              <dd className="flex flex-col text-(length:--text-meta) leading-(--leading-meta) text-ink-2">
                {PLACEHOLDERS[name]?.meaning}
                {PLACEHOLDERS[name]?.whenRemoved !== undefined && (
                  <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
                    {PLACEHOLDERS[name]?.whenRemoved}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

/**
 * PromptEditor is the edit of one prompt: the text beside the placeholders of the default, and a bar
 * at the foot with Cancel and Save. Its back button acts as Cancel, and both ask before the changes
 * are lost.
 */
export function PromptEditor({ stage, prompt, onSaved }: PromptEditorProps) {
  const { name } = promptMeta(stage);
  const { promptEdit } = useSettingsUi();
  const setPromptEditText = useAppStore((state) => state.setPromptEditText);
  const cancelPromptEdit = useAppStore((state) => state.cancelPromptEdit);
  const finishPromptEdit = useAppStore((state) => state.finishPromptEdit);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // The editor opens with the cursor at the start of the text.
  useEffect(() => {
    field.current?.focus();
    field.current?.setSelectionRange(0, 0);
  }, []);

  const edit = promptEdit !== null && promptEdit.stage === stage ? promptEdit : null;
  if (edit === null) {
    return null;
  }
  const changed = edit.text !== edit.original;

  const save = () => {
    if (!changed || saving) {
      return;
    }
    setSaving(true);
    setFailure(null);
    savePrompt(stage, edit.text)
      .then((saved) => {
        onSaved(saved);
        finishPromptEdit();
      })
      .catch((reason: unknown) => {
        setFailure(messageOf(reason));
        setSaving(false);
      });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-(--space-4)">
      <div>
        <Button variant="ghost" size="xs" icon={ICONS.back} onClick={cancelPromptEdit}>
          {name}
        </Button>
      </div>
      <SettingsPage
        title={`Editing the ${name} prompt`}
        sentence="Markdown. The placeholders are filled when a session starts."
      >
        <div className="grid grid-cols-[minmax(0,1fr)_var(--col-placeholders)] items-start gap-(--space-4) @max-[820px]/main:grid-cols-1">
          <Textarea
            ref={field}
            mono
            aria-label={`${name} prompt`}
            value={edit.text}
            onChange={(event) => setPromptEditText(event.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            rows={24}
            className="min-h-[calc(24*var(--leading-code)+var(--space-4)+2*var(--border))] resize-none field-sizing-content text-(length:--text-code) leading-(--leading-code) md:text-(length:--text-code) [font-variant-ligatures:none]"
          />
          <PlaceholderColumn placeholders={prompt.placeholders ?? []} />
        </div>
      </SettingsPage>
      <div className="sticky bottom-0 flex items-center gap-(--space-3) bg-surface-1 p-(--space-3) shadow-[inset_0_var(--border)_0_var(--line-1)]">
        {failure !== null ? (
          <p
            role="alert"
            className="text-(length:--text-meta) leading-(--leading-meta) text-state-error"
          >
            {`Couldn't save the prompt: ${failure}`}
          </p>
        ) : (
          changed && (
            <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              Unsaved changes
            </p>
          )
        )}
        <div className="ml-auto flex items-center gap-(--space-2)">
          <Button variant="ghost" size="sm" onClick={cancelPromptEdit}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            shortcut="Ctrl S"
            loading={saving}
            loadingLabel="Saving…"
            {...(changed ? {} : { disabled: true, disabledReason: "Nothing changed yet." })}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
