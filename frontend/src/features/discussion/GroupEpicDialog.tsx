import { useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Checkbox } from "@/components/system/Checkbox";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Field } from "@/components/system/Field";
import { Input } from "@/components/system/Input";
import { Select } from "@/components/system/Select";
import { Tooltip } from "@/components/system/Tooltip";
import { epicRepositoryOf } from "@/features/discussion/discussion-status";
import {
  draftTitle,
  EPIC_TITLE_MAX,
  groupable,
  groupReason,
} from "@/features/discussion/drafts-card";
import type { DiscussionSummary } from "@/lib/wails";
import { groupIntoEpicInPlace } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

export interface GroupEpicDialogProps {
  discussion: DiscussionSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * GroupEpicDialog groups loose drafts of the current round into a new epic: its title, the drafts
 * and the repository, which follows the drafts picked until the user chooses one. A refusal of the
 * Go side stays in the footer. Grouped, the card opens the epic.
 */
export function GroupEpicDialog({ discussion, open, onOpenChange }: GroupEpicDialogProps) {
  const reasonId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const requestDraft = useAppStore((state) => state.requestDraft);
  const options = groupable(discussion);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [chosenRepository, setChosenRepository] = useState<string | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  // Each opening starts with an empty title and the first two drafts picked.
  if (open !== opened) {
    setOpened(open);
    if (open) {
      setTitle("");
      setPicked(new Set(options.slice(0, 2).map((draft) => draft.id)));
      setChosenRepository(null);
      setRefusal(null);
    }
  }

  // A draft that stopped being groupable meanwhile leaves the picked ones with it.
  const marked = options.filter((draft) => picked.has(draft.id));
  const repository = chosenRepository ?? epicRepositoryOf(marked);
  const reason = groupReason(title, marked.length);
  const length = [...title.trim()].length;

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(picked);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setPicked(next);
  };

  const group = async () => {
    if (grouping || reason !== null) {
      return;
    }
    setGrouping(true);
    setRefusal(null);
    const result = await groupIntoEpicInPlace(
      discussion.id,
      marked.map((draft) => draft.id),
      title.trim(),
      repository,
    );
    setGrouping(false);
    if ("error" in result) {
      setRefusal(result.error);
      return;
    }
    requestDraft(discussion.id, result.epicId);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Group drafts into an epic"
      initialFocus={titleRef}
      onConfirm={() => void group()}
    >
      <DialogBody>
        <Field
          label="Title of the epic"
          count={{ length, max: EPIC_TITLE_MAX }}
          {...(length > EPIC_TITLE_MAX
            ? { error: `Use at most ${EPIC_TITLE_MAX} characters in the title of the epic.` }
            : {})}
        >
          <Input
            ref={titleRef}
            placeholder="What the cards deliver together"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the list does not want */}
        <div role="group" aria-labelledby={`${reasonId}-drafts`} className="flex flex-col gap-1">
          <span
            id={`${reasonId}-drafts`}
            className="text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2"
          >
            Drafts{" "}
            <span className="font-normal text-ink-3">two or more, loose and not published</span>
          </span>
          {options.map((draft) => (
            <Checkbox
              key={draft.id}
              checked={picked.has(draft.id)}
              onCheckedChange={(checked) => toggle(draft.id, checked)}
            >
              <Tooltip content={draftTitle(draft)}>
                <span className="min-w-0 truncate">{draftTitle(draft)}</span>
              </Tooltip>
              <span className="shrink-0 text-ink-3">{draft.repository}</span>
            </Checkbox>
          ))}
        </div>
        <Field label="Repository of the epic">
          <Select
            label="Repository of the epic"
            value={repository}
            placeholder="Choose a repository"
            options={(discussion.repositories ?? []).map((each) => ({
              value: each.id,
              label: each.fullName,
            }))}
            onValueChange={setChosenRepository}
          />
        </Field>
      </DialogBody>
      <DialogFooter
        {...(reason !== null ? { reason: { id: reasonId, text: reason } } : {})}
        {...(refusal !== null ? { refusal } : {})}
      >
        <DialogCancel disabled={grouping} />
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          {...(reason !== null ? { disabled: true, reasonId } : {})}
          loading={grouping}
          loadingLabel="Grouping…"
          onClick={() => void group()}
        >
          {`Group ${marked.length} drafts`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
