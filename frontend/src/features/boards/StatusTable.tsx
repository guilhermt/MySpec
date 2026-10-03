import { useId } from "react";
import { Badge } from "@/components/system/Badge";
import { Checkbox } from "@/components/system/Checkbox";
import { RadioInput } from "@/components/system/Radio";
import type { BoardStatus } from "@/lib/wails";

export interface StatusTableProps {
  statuses: BoardStatus[];
  /** finals are the ids of the statuses that end the work on a card. */
  finals: ReadonlySet<string>;
  /** newCardStatus is the id of the status a card published by a discussion starts in; "" for none. */
  newCardStatus: string;
  /** newIds are the statuses that appeared since the board was saved. */
  newIds: ReadonlySet<string>;
  onFinal: (id: string, final: boolean) => void;
  onNewCard: (id: string) => void;
}

const HEAD =
  "px-(--space-3) py-(--space-2) text-left text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase";
const CELL = "px-(--space-3) py-(--space-1)";
/** CONTROL is a cell of a box or a radio, whose own inset puts the sign under the column's head. */
const CONTROL = "px-(--space-1) py-(--space-1)";

/**
 * StatusTable is the step of the statuses of a board: for each option of the Status field, whether it
 * ends the work on a card and whether cards a discussion publishes start in it. The radios are one
 * group by their name, under the head New cards: the body stays the table's, and the arrows on a box
 * never move the status of new cards.
 */
export function StatusTable({
  statuses,
  finals,
  newCardStatus,
  newIds,
  onFinal,
  onNewCard,
}: StatusTableProps) {
  const group = useId();
  return (
    <div className="overflow-auto rounded-md border border-line-1">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={HEAD}>
              Status
            </th>
            <th scope="col" className={HEAD}>
              Ends the work
            </th>
            <th scope="col" className={HEAD}>
              New cards
            </th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((status) => (
            <tr key={status.id} className="shadow-[inset_0_var(--border)_0_var(--line-1)]">
              <th scope="row" className={`${CELL} text-left font-normal text-ink-1`}>
                <span className="inline-flex items-center gap-(--space-2)">
                  {status.name}
                  {newIds.has(status.id) && <Badge>new</Badge>}
                </span>
              </th>
              <td className={CONTROL}>
                <Checkbox
                  checked={finals.has(status.id)}
                  onCheckedChange={(checked) => onFinal(status.id, checked)}
                >
                  <span className="sr-only">{`${status.name} ends the work`}</span>
                </Checkbox>
              </td>
              <td className={CONTROL}>
                <RadioInput
                  name={group}
                  value={status.id}
                  checked={newCardStatus === status.id}
                  onChoose={onNewCard}
                  label={`New cards start in ${status.name}`}
                />
              </td>
            </tr>
          ))}
          <tr className="shadow-[inset_0_var(--border)_0_var(--line-1)]">
            <th scope="row" className={`${CELL} text-left font-normal text-ink-3`}>
              No status
            </th>
            <td className={CONTROL} />
            <td className={CONTROL}>
              <RadioInput
                name={group}
                value=""
                checked={newCardStatus === ""}
                onChoose={onNewCard}
                label="New cards start without a status"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
