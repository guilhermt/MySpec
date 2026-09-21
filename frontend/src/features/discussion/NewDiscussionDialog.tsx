import { LoaderCircle, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DiscussionContextPreview } from "@/features/discussion/DiscussionContextPreview";
import {
  canStart,
  NOTHING_TO_DISCUSS,
  READS_CLONES,
  suggestedTitle,
  TITLE_MAX,
  titleProblem,
  unclonedRepositories,
} from "@/features/discussion/new-discussion";
import { ModelPicker } from "@/features/models/ModelPicker";
import { issueLabel } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import { choiceOf, type ModelChoice } from "@/lib/models";
import { cloneMissingText } from "@/lib/repositories";
import type { Board, BoardCard, Repository, StageModel } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository, startDiscussion } from "@/store/actions";
import { useAppStore, useBoard, useNewDiscussion, useRepositories } from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

/** COUNTER_FROM is the length after which the title says how much room is left. */
const COUNTER_FROM = 100;

/** TITLE_TOO_LONG says what to do with a title that does not fit, as a suggested one may not. */
const TITLE_TOO_LONG = `Use at most ${TITLE_MAX} characters.`;

/** NewDiscussionDialog starts a discussion of a board, over the cards picked on it. */
export function NewDiscussionDialog() {
  const ref = useNewDiscussion();
  const closeNewDiscussion = useAppStore((state) => state.closeNewDiscussion);
  const board = useBoard(ref?.boardId ?? "");

  if (ref === null) {
    return null;
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeNewDiscussion();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New discussion</DialogTitle>
        </DialogHeader>
        {board === null ? (
          <>
            <p className="text-sm text-muted-foreground">This board is no longer in the app.</p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeNewDiscussion}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Keyed by what the dialog opened for: another board, or another
          // pick of cards, starts afresh, without what was typed for the last.
          <NewDiscussionFields
            key={`${ref.boardId}|${ref.cardKeys.join(",")}`}
            board={board}
            cardKeys={ref.cardKeys}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NewDiscussionFieldsProps {
  board: Board;
  cardKeys: readonly string[];
}

function NewDiscussionFields({ board, cardKeys }: NewDiscussionFieldsProps) {
  const closeNewDiscussion = useAppStore((state) => state.closeNewDiscussion);
  const openDiscussion = useAppStore((state) => state.openDiscussion);
  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const repositories = useRepositories();

  // A card that is no longer in the last reading of the board is left out
  // without a word: the discussion is about the ones that are.
  const [cards, setCards] = useState<readonly BoardCard[]>(() =>
    cardKeys
      .map((key) => (board.cards ?? []).find((card) => card.key === key))
      .filter((card): card is BoardCard => card !== undefined),
  );
  const [title, setTitle] = useState(() => suggestedTitle(cards));
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<ModelChoice>(() => choiceOf(defaults, "discussion"));
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const problem = titleProblem(title);
  const ready = canStart(title, text, cards);
  const uncloned = unclonedRepositories(board, repositories);
  const nothingToDiscuss = text.trim() === "" && cards.length === 0;

  const start = () => {
    if (!ready || starting) {
      return;
    }
    setStarting(true);
    setError(null);
    startDiscussion({
      boardId: board.id,
      title: title.trim(),
      text,
      cards: cards.map((card) => card.key),
      model: choice.model,
      effort: choice.effort,
    })
      .then((id) => {
        closeNewDiscussion();
        openDiscussion(id);
      })
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setStarting(false);
      });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    start();
  };

  const onTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      start();
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
        <p className="text-sm font-medium">{board.title}</p>
        <p className="text-xs text-muted-foreground">{`${board.owner} · #${board.number}`}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="discussion-title">Title</Label>
        <Input
          id="discussion-title"
          value={title}
          autoFocus
          maxLength={TITLE_MAX}
          autoComplete="off"
          aria-invalid={problem === "too_long"}
          onChange={(event) => setTitle(event.target.value)}
        />
        {problem === "too_long" ? (
          <p className="text-xs text-destructive">{TITLE_TOO_LONG}</p>
        ) : (
          title.length > COUNTER_FROM && (
            <p className="text-xs text-muted-foreground tabular-nums">{`${title.length}/${TITLE_MAX}`}</p>
          )
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="discussion-text">What to discuss</Label>
        <Textarea
          id="discussion-text"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onTextKeyDown}
          className="max-h-[40dvh] field-sizing-content"
        />
      </div>

      {cards.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Cards</Label>
          <ul className="flex flex-col divide-y rounded-lg border">
            {cards.map((card) => (
              <li key={card.key} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {`${issueLabel(card)} ${card.title} · ${card.repository}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${issueLabel(card)}`}
                  onClick={() =>
                    setCards((current) => current.filter((item) => item.key !== card.key))
                  }
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DiscussionContextPreview boardId={board.id} text={text} cards={cards} />

      <div className="flex items-center justify-between gap-4">
        <Label>Model</Label>
        <ModelPicker label="Discussion" value={choice} onChange={setChoice} />
      </div>

      {uncloned.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Repositories without a clone</Label>
          <ul className="flex flex-col divide-y rounded-lg border">
            {uncloned.map((repository) => (
              <li key={repository.id}>
                <UnclonedRepository repository={repository} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{READS_CLONES}</p>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="break-all text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className="flex-col items-end gap-1.5 sm:flex-col sm:items-end">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={closeNewDiscussion}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready || starting}>
            {starting ? "Starting…" : "Start discussion"}
          </Button>
        </div>
        {nothingToDiscuss && <p className="text-xs text-muted-foreground">{NOTHING_TO_DISCUSS}</p>}
      </DialogFooter>
    </form>
  );
}

/** UnclonedRepository offers the clone, or the path, a repository of the board is missing. */
function UnclonedRepository({ repository }: { repository: Repository }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = (run: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    run()
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm">{repository.fullName}</span>
        {repository.cloning ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Cloning…
          </p>
        ) : repository.missing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => act(() => changeRepositoryPath(repository.id))}
          >
            Change path
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => act(() => cloneRepository(repository.id))}
          >
            Clone
          </Button>
        )}
      </div>
      {repository.missing && (
        <p className="break-all text-xs text-muted-foreground">{cloneMissingText(repository)}</p>
      )}
      {(error ?? (repository.cloneError === "" ? null : repository.cloneError)) !== null && (
        <p role="alert" className="break-all text-xs text-destructive">
          {error ?? repository.cloneError}
        </p>
      )}
    </div>
  );
}
