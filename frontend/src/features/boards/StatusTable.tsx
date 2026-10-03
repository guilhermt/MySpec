import { Badge } from "@/components/system/Badge";
import { Checkbox } from "@/components/system/Checkbox";
import { Radio, RadioGroup } from "@/components/system/Radio";
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
  "px-3 py-2 text-left text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase";
const CELL = "px-3 py-1";

/**
 * StatusTable is the step of the statuses of a board: for each option of the Status field, whether it
 * ends the work on a card and whether cards a discussion publishes start in it. The radios are the
 * group Status of new cards, which is the table body.
 */
export function StatusTable({
  statuses,
  finals,
  newCardStatus,
  newIds,
  onFinal,
  onNewCard,
}: StatusTableProps) {
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
        <RadioGroup
          label="Status of new cards"
          value={newCardStatus}
          onValueChange={onNewCard}
          render={<tbody />}
        >
          {statuses.map((status) => (
            <tr key={status.id} className="shadow-[inset_0_var(--border)_0_var(--line-1)]">
              <th scope="row" className={`${CELL} text-left font-normal text-ink-1`}>
                <span className="inline-flex items-center gap-2">
                  {status.name}
                  {newIds.has(status.id) && <Badge>new</Badge>}
                </span>
              </th>
              <td className={CELL}>
                <Checkbox
                  checked={finals.has(status.id)}
                  onCheckedChange={(checked) => onFinal(status.id, checked)}
                >
                  <span className="sr-only">{`${status.name} ends the work`}</span>
                </Checkbox>
              </td>
              <td className={CELL}>
                <Radio value={status.id} label={`New cards start in ${status.name}`} />
              </td>
            </tr>
          ))}
          <tr className="shadow-[inset_0_var(--border)_0_var(--line-1)]">
            <th scope="row" className={`${CELL} text-left font-normal text-ink-3`}>
              No status
            </th>
            <td className={CELL} />
            <td className={CELL}>
              <Radio value="" label="New cards start without a status" />
            </td>
          </tr>
        </RadioGroup>
      </table>
    </div>
  );
}
