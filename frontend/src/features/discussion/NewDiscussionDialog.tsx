import { useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { CutText } from "@/components/system/CutText";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Field } from "@/components/system/Field";
import { IconButton } from "@/components/system/IconButton";
import { Input } from "@/components/system/Input";
import { ICONS } from "@/components/system/icons";
import { Select } from "@/components/system/Select";
import { Shimmer } from "@/components/system/Shimmer";
import { StateGlyph } from "@/components/system/StateGlyph";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Textarea } from "@/components/system/Textarea";
import { useNow } from "@/features/attention/useNow";
import { Markdown } from "@/features/chat/Markdown";
import {
  BOARD_FIELD_HELP,
  boardLine,
  boardOptions,
  contextLine,
  startReason,
  suggestedTitle,
  titleError,
  titleHelp,
  unclonedRepositories,
  whatHint,
} from "@/features/discussion/new-discussion";
import { UnclonedRepository } from "@/features/discussion/UnclonedRepository";
import { useDiscussionContext } from "@/features/discussion/useDiscussionContext";
import { ModelChip } from "@/features/models/ModelChip";
import { issueLabel } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import { choiceOf, type ModelChoice } from "@/lib/models";
import { sharedNames, shortName } from "@/lib/repositories";
import type { Board, BoardCard, StageModel } from "@/lib/wails";
import { startDiscussion } from "@/store/actions";
import {
  type NewDiscussionRef,
  useAppStore,
  useBoard,
  useNewDiscussion,
  useRepositories,
} from "@/store/app-store";

const NO_MODELS: readonly StageModel[] = [];

const NO_SHARED: ReadonlySet<string> = new Set();
const GONE = "This board is no longer in the app.";

/** SECTION_LABEL is the type of the label of a part that is not a field: Cards, Model. */
const SECTION_LABEL = "text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2";

/** NewDiscussionDialog starts a discussion of a board, over the cards picked on it. */
export function NewDiscussionDialog() {
  const ref = useNewDiscussion();

  if (ref === null) {
    return null;
  }
  // Keyed by what the dialog opened for: another pick of cards starts afresh, without what was
  // typed for the last. Choosing another board in the Board field keeps the key, and the text.
  return (
    <NewDiscussionFields
      key={ref.askBoard ? "ask" : `${ref.boardId}|${ref.cardKeys.join(",")}`}
      reference={ref}
    />
  );
}

// NewDiscussionFields holds the board the discussion is about, and the form once the app has it.
function NewDiscussionFields({ reference }: { reference: NewDiscussionRef }) {
  const [boardId, setBoardId] = useState(reference.boardId);
  const board = useBoard(boardId);

  if (board === null) {
    return <GoneBoard />;
  }
  return (
    <NewDiscussionForm
      board={board}
      cardKeys={reference.cardKeys}
      askBoard={reference.askBoard}
      onBoardChange={setBoardId}
    />
  );
}

// GoneBoard is the dialog over a board that left the app: the way on is Cancel.
function GoneBoard() {
  const reasonId = useId();
  const closeNewDiscussion = useAppStore((state) => state.closeNewDiscussion);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && closeNewDiscussion()}
      title="New discussion"
      size="wide"
    >
      <DialogBody>
        <p>{GONE}</p>
      </DialogBody>
      <DialogFooter reason={{ id: reasonId, text: GONE }}>
        <DialogCancel />
        <Button variant="primary" shortcut="Ctrl ↵" disabled reasonId={reasonId}>
          Start discussion
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

interface NewDiscussionFormProps {
  board: Board;
  cardKeys: readonly string[];
  askBoard: boolean;
  onBoardChange: (boardId: string) => void;
}

function NewDiscussionForm({ board, cardKeys, askBoard, onBoardChange }: NewDiscussionFormProps) {
  const reasonId = useId();
  const contextId = useId();
  const closeNewDiscussion = useAppStore((state) => state.closeNewDiscussion);
  const go = useAppStore((state) => state.go);
  const defaults = useAppStore((state) => state.app?.modelDefaults ?? NO_MODELS);
  const app = useAppStore((state) => state.app);
  const shared = app === null ? NO_SHARED : sharedNames(app);
  const repositories = useRepositories();
  const now = useNow(60_000, askBoard);
  const boardTrigger = useRef<HTMLElement | null>(null);

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
  const [refusal, setRefusal] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const context = useDiscussionContext(board.id, text, cards);

  const reason = startReason({ board: board.id, title, text, cards: cards.length });
  const uncloned = unclonedRepositories(board, repositories);
  const byDefault = (() => {
    const standard = choiceOf(defaults, "discussion");
    return standard.model === choice.model && standard.effort === choice.effort;
  })();

  const start = () => {
    if (reason !== null || starting) {
      return;
    }
    setStarting(true);
    setRefusal(null);
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
        go({ kind: "discussion", id }, { focus: "title" });
      })
      .catch((failure: unknown) => {
        setRefusal(messageOf(failure));
        setStarting(false);
      });
  };

  const footerText = starting ? "Starting the conversation…" : reason;
  const help = titleHelp(title);
  const problem = titleError(title);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !starting) {
          closeNewDiscussion();
        }
      }}
      title="New discussion"
      size="wide"
      closeDisabled={starting}
      onConfirm={start}
      {...(askBoard ? { initialFocus: boardTrigger } : {})}
    >
      <DialogBody className="gap-(--space-4)">
        {askBoard && app !== null ? (
          // Asking the board, the focus starts on its field; otherwise on the Title.
          <div
            ref={(field) => {
              boardTrigger.current = field?.querySelector("button") ?? null;
            }}
          >
            <Field label="Board" help={BOARD_FIELD_HELP}>
              <Select
                label="Board"
                value={board.id}
                options={boardOptions(app, now)}
                disabled={starting}
                onValueChange={onBoardChange}
              />
            </Field>
          </div>
        ) : (
          <SunkenLine icon={ICONS.board}>
            <span className="flex min-w-0 gap-(--space-2)">
              <span className="shrink-0 font-medium text-ink-1">{board.title}</span>
              <CutText text={boardLine(board, repositories)} className="text-ink-3" />
            </span>
          </SunkenLine>
        )}

        <Field
          label="Title"
          {...(problem !== null ? { error: problem } : help !== "" ? { help } : {})}
        >
          <Input
            value={title}
            autoComplete="off"
            disabled={starting}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="What to discuss" complement={whatHint(cards.length)}>
          <Textarea
            rows={3}
            value={text}
            disabled={starting}
            onChange={(event) => setText(event.target.value)}
            // field-sizing-content ignores rows: the field holds three lines at least, nine at most.
            className="min-h-[calc(var(--leading-body)*3+var(--space-2)*2+var(--border)*2)] max-h-[calc(9*var(--leading-body)+var(--space-4))] field-sizing-content"
          />
        </Field>

        {cards.length > 0 && (
          <div className="flex flex-col gap-(--space-1)">
            <span className={SECTION_LABEL}>
              Cards <span className="font-normal text-ink-3">{cards.length}</span>
            </span>
            <ul className="flex flex-col divide-y divide-line-1 rounded-sm border border-line-1">
              {cards.map((card) => (
                // The line under a row is outside its height, so the × stays centred on a whole pixel.
                <li
                  key={card.key}
                  className="box-content flex min-h-(--size-control) items-center gap-(--space-2) pr-(--space-1) pl-(--space-3) text-(length:--text-ui) leading-(--leading-ui)"
                >
                  <span className="shrink-0 font-mono text-(length:--text-meta) text-ink-3">
                    {issueLabel(card)}
                  </span>
                  <CutText text={card.title} className="flex-1 text-ink-1" />
                  <span className="shrink-0 text-ink-3">
                    {shared.has(shortName(card.repository).toLowerCase())
                      ? card.repository
                      : shortName(card.repository)}
                  </span>
                  <IconButton
                    size="xs"
                    icon={ICONS.close}
                    label={`Remove ${issueLabel(card)} from the discussion`}
                    disabled={starting}
                    onClick={() =>
                      setCards((current) => current.filter((item) => item.key !== card.key))
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-(--space-2)">
          {context.refreshing ? (
            <SunkenLine
              action={
                <Button
                  size="xs"
                  variant="ghost"
                  disabled
                  disabledReason="The cards are being read again."
                >
                  Show
                </Button>
              }
            >
              <span role="status">
                <Shimmer>Refreshing the cards…</Shimmer>
              </span>
            </SunkenLine>
          ) : (
            <>
              {context.failure !== null && (
                <SunkenLine>
                  <span role="alert">
                    <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
                    {`Couldn't refresh the cards: ${context.failure}. The discussion will use the last reading.`}
                  </span>
                </SunkenLine>
              )}
              <SunkenLine
                action={
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-expanded={showContext}
                    aria-controls={contextId}
                    onClick={() => setShowContext((current) => !current)}
                  >
                    {showContext ? "Hide" : "Show"}
                  </Button>
                }
              >
                {contextLine(cards, context.text)}
              </SunkenLine>
            </>
          )}
          {showContext && (
            <section
              id={contextId}
              aria-label="The context of the discussion"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a box that scrolls is read with the keyboard
              tabIndex={0}
              className="max-h-[calc(9*var(--leading-body))] overflow-y-auto rounded-sm border border-line-1 px-(--space-3) py-(--space-2) text-(length:--text-body) leading-(--leading-body) text-ink-2 select-text focus-visible:focus-ring"
            >
              <Markdown>{context.text ?? ""}</Markdown>
            </section>
          )}
        </div>

        {uncloned.map((repository) => (
          <UnclonedRepository key={repository.id} repository={repository} layout="strip" />
        ))}

        <div className="flex items-center gap-(--space-3)">
          <span className={SECTION_LABEL}>Model</span>
          <span inert={starting}>
            <ModelChip
              label="Discussion"
              value={choice}
              own={!byDefault}
              followNote=""
              onChange={setChoice}
            />
          </span>
          {byDefault && (
            <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              From Defaults
            </span>
          )}
        </div>
      </DialogBody>
      <DialogFooter
        {...(footerText !== null ? { reason: { id: reasonId, text: footerText } } : {})}
        {...(refusal !== null ? { refusal } : {})}
      >
        <DialogCancel disabled={starting} />
        <Button
          variant="primary"
          shortcut="Ctrl ↵"
          {...(reason !== null ? { disabled: true, reasonId } : {})}
          loading={starting}
          loadingLabel="Starting…"
          onClick={start}
        >
          Start discussion
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
