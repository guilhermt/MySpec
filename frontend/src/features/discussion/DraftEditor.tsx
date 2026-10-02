import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Chip } from "@/components/system/Chip";
import { type DependencyOption, DependencyPicker } from "@/components/system/DependencyPicker";
import { Field } from "@/components/system/Field";
import { Input } from "@/components/system/Input";
import { ICONS } from "@/components/system/icons";
import { Select, type SelectOption } from "@/components/system/Select";
import { Textarea } from "@/components/system/Textarea";
import { dependencyLabel, refValue } from "@/features/discussion/discussion-status";
import { dependencyViews } from "@/features/discussion/drafts-card";
import { type DraftField, useDraftText } from "@/features/discussion/useDraftText";
import { draftTitle } from "@/lib/drafts";
import { messageOf } from "@/lib/errors";
import { asDraftKind, type DiscussionSummary, type Draft } from "@/lib/wails";
import {
  addDraftDependency,
  removeDraftDependency,
  saveDraftText,
  setDraftEpic,
  setDraftEpicInPlace,
  setDraftModule,
  setDraftRepository,
} from "@/store/actions";
import { storedDraft, useBoard } from "@/store/app-store";

export interface DraftEditorProps {
  discussion: DiscussionSummary;
  draft: Draft;
  /** onDone closes the edit and gives the focus back to the draft. */
  onDone: () => void;
}

const RUNNING = "A publication is running";
const META = "text-(length:--text-meta) leading-(--leading-meta)";

// epicChoices are the epics a card can sit under: the ones of the round and the one it has now if it
// is elsewhere, and apart, the action that opens the field of an existing issue.
function epicChoices(
  discussion: DiscussionSummary,
  draft: Draft,
  openIssue: () => void,
): { options: SelectOption[]; groups: { label: string; options: SelectOption[] }[] } {
  const options: SelectOption[] = [{ value: "", label: "No epic" }];
  for (const each of discussion.drafts ?? []) {
    if (
      asDraftKind(each.kind) === "epic" &&
      each.round === discussion.round &&
      each.id !== draft.id
    ) {
      options.push({ value: each.id, label: draftTitle(each) });
    }
  }
  const epic = draft.epic;
  if (epic !== null && !options.some((option) => option.value === refValue(epic))) {
    options.push({ value: refValue(epic), label: dependencyLabel(epic) });
  }
  return {
    options,
    groups: [
      {
        label: "On GitHub",
        // Not a choice: its value is only the key of the item, and Enter or a click opens the field.
        options: [
          {
            value: "existing-issue",
            label: "Existing issue…",
            disabled: true,
            action: { label: "Open", onAction: openIssue, closes: true },
          },
        ],
      },
    ],
  };
}

/**
 * DraftEditor is the edit of a draft in the open draft: the title and the body saved as they are
 * typed, the fields, and the dependencies of a card. During a publication it reads only. Esc closes
 * what is open inside it first, a choice, the listbox of the dependencies or the field of an
 * existing issue, and then the edit.
 */
export function DraftEditor({ discussion, draft, onDone }: DraftEditorProps) {
  const kind = asDraftKind(draft.kind);
  const isEpic = kind === "epic";
  const isUpdate = kind === "update";
  const locked = discussion.publishing;
  const lock = locked ? { disabled: true, disabledReason: RUNNING } : {};
  const board = useBoard(discussion.boardId);
  const titleInput = useRef<HTMLInputElement>(null);
  const epicField = useRef<HTMLDivElement>(null);
  const addDependency = useRef<HTMLButtonElement>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [issueRefusal, setIssueRefusal] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    titleInput.current?.focus();
  }, []);

  // The two texts travel to the Go side together, so the one that is not being edited goes as the
  // store has it now, not as this render saw it.
  const saveText = (field: DraftField, next: string) => {
    const stored = storedDraft(discussion.id, draft.id) ?? draft;
    void saveDraftText(
      discussion.id,
      draft.id,
      field === "title" ? next : stored.title,
      field === "body" ? next : stored.body,
    );
  };
  const bodyRequired = !(isEpic && draft.source === "user");
  const title = useDraftText(
    discussion.id,
    draft.id,
    "title",
    draft.title,
    draft.revision,
    (next) => saveText("title", next),
    true,
  );
  const body = useDraftText(
    discussion.id,
    draft.id,
    "body",
    draft.body,
    draft.revision,
    (next) => saveText("body", next),
    bodyRequired,
  );

  const repositories = discussion.repositories ?? [];
  const repositoryOptions: SelectOption[] = repositories.map((each) => ({
    value: each.id,
    label: each.fullName,
  }));
  if (draft.repositoryId === "" && !isUpdate) {
    repositoryOptions.unshift({
      value: "",
      label: draft.repository,
      unavailable: true,
      sub: "not on the board",
    });
  }
  const moduleOptions: SelectOption[] = [
    { value: "", label: "No module" },
    ...(discussion.moduleOptions ?? []).map((name) => ({ value: name, label: name })),
  ];
  const epics = epicChoices(discussion, draft, () => setIssue(""));
  const epicValue = draft.epic === null ? "" : refValue(draft.epic);

  const dependencies = (draft.dependencies ?? []).filter((each) => each.dropped === "");
  const views = dependencyViews(draft, discussion);
  const chosen = dependencies.map(refValue);
  const recorded = dependencies.filter((each) => each.linked).map(refValue);
  const draftOptions: DependencyOption[] = (discussion.drafts ?? [])
    .filter(
      (each) =>
        asDraftKind(each.kind) !== "epic" &&
        each.round === discussion.round &&
        each.id !== draft.id,
    )
    .map((each) => ({ value: each.id, label: draftTitle(each), sub: each.repository }));
  const cardOptions: DependencyOption[] = (board?.cards ?? []).map((card) => ({
    value: `${card.repository}#${card.number}`,
    label: `#${card.number} ${card.title}`,
    sub: "",
  }));

  const toggle = async (value: string): Promise<string | null> => {
    try {
      if (chosen.includes(value)) {
        await removeDraftDependency(discussion.id, draft.id, value);
      } else {
        await addDraftDependency(discussion.id, draft.id, value);
      }
      return null;
    } catch (failure) {
      return messageOf(failure);
    }
  };

  // What closes inside the edit gives the focus back to what opened it: the next Esc has to reach
  // the edit, and a focus left on the body would go to the composer.
  const closeIssue = () => {
    epicField.current?.querySelector<HTMLElement>("button")?.focus();
    setIssue(null);
    setIssueRefusal(null);
  };
  const closePicker = () => {
    addDependency.current?.focus();
    setPicking(false);
  };

  const saveIssue = async () => {
    const ref = (issue ?? "").trim();
    if (ref === "") {
      closeIssue();
      return;
    }
    const refusal = await setDraftEpicInPlace(discussion.id, draft.id, ref);
    if (refusal === null) {
      closeIssue();
    } else {
      setIssueRefusal(refusal);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // A menu or a listbox open in a portal reaches this handler through the React tree only.
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      !event.currentTarget.contains(event.target as Node)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // Esc closes the listbox of the dependencies, then the field of an existing issue, then the edit.
    if (picking) {
      closePicker();
    } else if (issue !== null) {
      closeIssue();
    } else {
      onDone();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys are the edit's own; the controls inside are the interactive elements
    <div className="flex flex-col gap-(--space-3)" onKeyDown={onKeyDown}>
      <Field label="Title" {...(title.value.trim() === "" ? { error: "Write a title." } : {})}>
        <Input
          ref={titleInput}
          value={title.value}
          onChange={(event) => title.onChange(event.target.value)}
          onBlur={title.onBlur}
          {...lock}
        />
      </Field>
      <Field
        label="Body"
        {...(bodyRequired && body.value.trim() === "" ? { error: "Write the body." } : {})}
      >
        <Textarea
          mono
          rows={6}
          value={body.value}
          onChange={(event) => body.onChange(event.target.value)}
          onBlur={body.onBlur}
          className="max-h-(--size-composer-max) field-sizing-content"
          {...lock}
        />
      </Field>
      <div className="grid grid-cols-3 gap-(--space-2)">
        {isUpdate ? (
          <Field label="Repository">
            <p
              className={`${META} py-1 text-ink-2`}
            >{`${draft.repository} · the card's repository`}</p>
          </Field>
        ) : (
          <Field label="Repository">
            <Select
              label="Repository"
              value={draft.repositoryId}
              options={repositoryOptions}
              onValueChange={(id) => void setDraftRepository(discussion.id, draft.id, id)}
              {...lock}
            />
          </Field>
        )}
        {discussion.moduleField !== "" && !isEpic && (
          <Field label="Module">
            <Select
              label="Module"
              value={draft.module}
              options={moduleOptions}
              onValueChange={(name) => void setDraftModule(discussion.id, draft.id, name)}
              {...lock}
            />
          </Field>
        )}
        {!isEpic && (
          <div ref={epicField} className="contents">
            <Field label="Epic">
              <Select
                label="Epic"
                value={epicValue}
                options={epics.options}
                groups={epics.groups}
                onValueChange={(value) => {
                  setIssue(null);
                  void setDraftEpic(discussion.id, draft.id, value);
                }}
                {...lock}
              />
            </Field>
          </div>
        )}
      </div>
      {issue !== null && !isEpic && (
        <Field label="Existing issue" {...(issueRefusal !== null ? { error: issueRefusal } : {})}>
          <Input
            autoFocus
            placeholder="owner/name#N"
            value={issue}
            onChange={(event) => {
              setIssue(event.target.value);
              setIssueRefusal(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveIssue();
              }
            }}
            {...lock}
          />
        </Field>
      )}
      {!isEpic && (
        <div className="flex flex-col gap-(--space-2)">
          <span className={`${META} font-medium text-ink-2`}>Depends on</span>
          <div className="flex flex-wrap items-center gap-(--space-2)">
            {dependencies.map((dependency, index) => {
              const name = views[index]?.title ?? dependency.reference;
              return (
                <Chip
                  key={refValue(dependency)}
                  kind="action"
                  size="sm"
                  disabled={locked}
                  {...(dependency.linked ? { own: true, defaultNote: "on GitHub" } : {})}
                  {...(!dependency.linked && !locked
                    ? {
                        onRemove: () =>
                          void removeDraftDependency(discussion.id, draft.id, refValue(dependency)),
                        removeLabel: `Remove the dependency on ${name}`,
                      }
                    : {})}
                >
                  {name}
                </Chip>
              );
            })}
            <Button
              ref={addDependency}
              variant="ghost"
              size="xs"
              icon={ICONS.plus}
              disabled={locked}
              {...(locked ? { disabledReason: RUNNING } : {})}
              onClick={() => setPicking(true)}
            >
              Add a dependency
            </Button>
          </div>
          {picking && !locked && (
            <DependencyPicker
              chosen={chosen}
              recorded={recorded}
              drafts={draftOptions}
              cards={cardOptions}
              onToggle={toggle}
              onClose={closePicker}
            />
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <p className={`${META} min-w-0 flex-1 text-ink-3`}>
          {draft.decision === "approved" &&
            "Changing the repository, the epic or a dependency clears the approval. "}
          Saved as you type. The agent's next revision of this draft replaces your edits.
        </p>
        <Button variant="ghost" size="xs" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
