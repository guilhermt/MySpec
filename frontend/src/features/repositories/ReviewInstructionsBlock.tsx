import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Textarea } from "@/components/system/Textarea";
import { messageOf } from "@/lib/errors";
import type { Repository } from "@/lib/wails";
import { setReviewInstructions } from "@/store/actions";

const META = "text-(length:--text-meta) leading-(--leading-meta)";

export interface ReviewInstructionsBlockProps {
  repository: Repository;
  /** onClose is called when the block is saved or cancelled, for the row to give the focus back to its menu. */
  onClose: () => void;
}

/**
 * ReviewInstructionsBlock is what every review of a pull request of the repository is told, edited
 * in a block sunk under its row. Esc cancels it, and the key is marked so Settings stays open.
 */
export function ReviewInstructionsBlock({ repository, onClose }: ReviewInstructionsBlockProps) {
  const saved = repository.reviewInstructions;
  const [text, setText] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();

  useEffect(() => {
    const element = field.current;
    if (element === null) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const save = async () => {
    if (saving || text === saved) {
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await setReviewInstructions(repository.id, text);
      onClose();
    } catch (error) {
      setFailure(messageOf(error));
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !saving) {
      event.preventDefault();
      onClose();
    }
  };

  const unchanged = text === saved;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc is read inside the block, where the focus is
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-(--space-2) rounded-md bg-surface-0 p-(--space-3)"
    >
      <label htmlFor={`instructions-${repository.id}`} className={`font-medium text-ink-1 ${META}`}>
        Review instructions
      </label>
      <Textarea
        id={`instructions-${repository.id}`}
        ref={field}
        mono
        rows={5}
        value={text}
        disabled={saving}
        onChange={(event) => setText(event.target.value)}
        className={`text-(length:--text-meta) leading-(--leading-meta)`}
      />
      <p className={`text-ink-3 ${META}`}>
        {`Added to every pull request review of ${repository.fullName}, the reviews of task pull requests included. A change applies from the next pass.`}
      </p>
      {failure !== null && (
        <p role="alert" className={`text-state-error ${META}`}>
          {failure}
        </p>
      )}
      {/* The reason stands on the left, so Cancel and Save never move while typing. */}
      <div className="flex items-center gap-(--space-2)">
        {unchanged && (
          <p id={reasonId} className={`text-ink-3 ${META}`}>
            Nothing changed yet.
          </p>
        )}
        <div className="ml-auto flex items-center gap-(--space-2)">
          <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={saving}
            loadingLabel="Saving…"
            disabled={unchanged}
            {...(unchanged ? { reasonId } : {})}
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
