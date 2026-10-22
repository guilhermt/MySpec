import { BackgroundWorkList } from "@/components/BackgroundWorkList";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { Icon } from "@/components/system/Icon";
import { ITEM_ICONS } from "@/components/system/item-parts";
import { asTaskMode, type QuitSession, type SessionTasks } from "@/lib/wails";
import { cancelQuit, quitAnyway } from "@/store/actions";
import { useDiscussion, useQuitRequest, useReview, useTask } from "@/store/app-store";

interface QuitItemProps {
  itemId: string;
  sessions: readonly SessionTasks[];
}

// QuitItem is one item that has something running: its type glyph, its name as the tree calls it,
// and what runs in each of its conversations.
function QuitItem({ itemId, sessions }: QuitItemProps) {
  const task = useTask(itemId);
  const review = useReview(itemId);
  const discussion = useDiscussion(itemId);
  const kind =
    task !== null
      ? asTaskMode(task.mode) === "one_shot"
        ? "one-shot"
        : "task"
      : review !== null
        ? "review"
        : "discussion";
  const name = task?.name ?? review?.title ?? discussion?.title ?? "An item";
  return (
    <li className="flex flex-col gap-(--space-1-5)">
      <span className="flex items-center gap-(--space-2) font-medium text-ink-1">
        <Icon icon={ITEM_ICONS[kind]} size="sm" className="text-ink-3" />
        <span className="min-w-0 truncate">{name}</span>
      </span>
      <BackgroundWorkList itemId={itemId} sessions={sessions} />
    </li>
  );
}

// groupByItem gathers the conversations of the request by item, in the order they come.
function groupByItem(sessions: readonly QuitSession[]): [string, QuitSession[]][] {
  const groups = new Map<string, QuitSession[]>();
  for (const session of sessions) {
    groups.set(session.itemId, [...(groups.get(session.itemId) ?? []), session]);
  }
  return [...groups];
}

/**
 * QuitDialog is the confirmation of closing the app while subagents run: it lists what runs, by item
 * and by conversation, and warns that quitting loses its work. It is open while the state carries
 * the request, and Esc and the × keep the app open.
 */
export function QuitDialog() {
  const quit = useQuitRequest();
  const groups = groupByItem(quit?.sessions ?? []);
  return (
    <Dialog
      open={quit !== null}
      onOpenChange={(next) => {
        if (!next) {
          void cancelQuit();
        }
      }}
      title="Quit MySpec?"
      alert
    >
      <DialogBody>
        <p>
          Subagents are still running. Quitting stops everything that runs in the background, and
          its work is lost.
        </p>
        <ul className="m-0 flex list-none flex-col gap-(--space-3) p-0">
          {groups.map(([itemId, sessions]) => (
            <QuitItem key={itemId} itemId={itemId} sessions={sessions} />
          ))}
        </ul>
      </DialogBody>
      <DialogFooter>
        <DialogCancel />
        <Button variant="danger" onClick={() => void quitAnyway()}>
          Quit anyway
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
