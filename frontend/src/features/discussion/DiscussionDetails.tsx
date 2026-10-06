import { FACTS, Fact } from "@/components/Facts";
import { AuxPanel } from "@/components/system/AuxPanel";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { PanelRow } from "@/components/system/PanelRow";
import { PanelSection } from "@/components/system/PanelSection";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { discussionDetails } from "@/features/discussion/discussion-header";
import { UnclonedRepository } from "@/features/discussion/UnclonedRepository";
import type { DiscussionSummary } from "@/lib/wails";
import { fullTime } from "@/lib/when";
import { openExternal } from "@/store/actions";
import { useAppStore, useBoard, useRepositories } from "@/store/app-store";

/** MINUTE is how often the times of the panel are read again. */
const MINUTE = 60_000;

export interface DiscussionDetailsProps {
  discussion: DiscussionSummary;
}

/**
 * DiscussionDetails is what the discussion was given and what became of it: its board, its cards, the
 * repositories it read, its rounds and its documents, which open in Documents.
 */
export function DiscussionDetails({ discussion }: DiscussionDetailsProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const openPanelAt = useAppStore((state) => state.openPanelAt);
  const openBoardCard = useAppStore((state) => state.openBoardCard);
  const go = useAppStore((state) => state.go);
  const board = useBoard(discussion.boardId);
  const repositories = useRepositories();
  const now = useNow(MINUTE, true);
  const model = discussionDetails(discussion, board, now);
  const facts = model.discussion;

  const openCard = (index: number) => {
    const card = facts.cards[index];
    const key = discussion.cards?.[index]?.key;
    if (card === undefined) {
      return;
    }
    if (card.inReading && key !== undefined) {
      openBoardCard(discussion.boardId, key);
    } else {
      void openExternal(card.url);
    }
  };

  return (
    <AuxPanel id="details" title="Details" onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        <PanelSection legend="Discussion">
          <dl className={FACTS}>
            {facts.board !== null && (
              <Fact label="Board">
                {facts.board.open ? (
                  <Link
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      go({ kind: "board", id: discussion.boardId });
                    }}
                  >
                    {facts.board.title}
                  </Link>
                ) : (
                  facts.board.title
                )}
                {facts.board.detail !== "" && ` · ${facts.board.detail}`}
              </Fact>
            )}
            {facts.cards.length > 0 && (
              <Fact label="Cards">
                <ul className="flex flex-col gap-(--space-1)">
                  {facts.cards.map((card, index) => (
                    <li key={card.url}>
                      <Link
                        href={card.url}
                        external={!card.inReading}
                        onClick={(event) => {
                          event.preventDefault();
                          openCard(index);
                        }}
                      >
                        {`#${card.number}`}
                      </Link>
                      {` ${card.title}`}
                    </li>
                  ))}
                </ul>
              </Fact>
            )}
            {facts.read !== "" && <Fact label="Read">{facts.read}</Fact>}
            {facts.notCloned.length > 0 && (
              <Fact label="Not cloned">
                <ul className="flex flex-col gap-(--space-2)">
                  {facts.notCloned.map((repository) => {
                    const found = repositories.find((one) => one.id === repository.id);
                    return (
                      <li key={repository.id}>
                        {found === undefined ? (
                          repository.fullName
                        ) : (
                          <UnclonedRepository repository={found} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Fact>
            )}
            {facts.model !== "" && <Fact label="Model">{facts.model}</Fact>}
            <Fact label="Started">
              <Tooltip content={fullTime(discussion.createdAt)}>
                <span>{facts.started}</span>
              </Tooltip>
            </Fact>
          </dl>
        </PanelSection>

        <PanelSection legend="Rounds">
          <ul className="flex flex-col">
            {model.rounds.map((round) => (
              <li key={round.text}>
                <PanelRow
                  {...(round.time === "" ? {} : { meta: round.time })}
                  {...(round.time === "" && round.text === "No drafts yet"
                    ? { className: "text-ink-3" }
                    : {})}
                >
                  {round.text}
                </PanelRow>
              </li>
            ))}
          </ul>
        </PanelSection>

        <PanelSection legend="Documents">
          <ul className="flex flex-col">
            {model.documents.map((document) => (
              <li key={document.name} {...(document.enabled ? {} : { "aria-disabled": true })}>
                <PanelRow
                  glyph={<Icon icon={ICONS.file} size="sm" />}
                  {...(document.enabled
                    ? { onClick: () => openPanelAt("documents", document.name) }
                    : { className: "text-ink-4" })}
                >
                  {document.label}
                </PanelRow>
              </li>
            ))}
          </ul>
        </PanelSection>
      </div>
    </AuxPanel>
  );
}
