import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { openExternal } from "@/store/actions";

export interface CardLinkProps {
  card: { number: number; url: string; status: string };
}

// cardLinkLabel names the card link: its number and, when the board has one, its status.
function cardLinkLabel(card: { number: number; status: string }): string {
  const label = `Open card #${card.number} on GitHub`;
  return card.status === "" ? label : `${label} · ${card.status}`;
}

/** CardLink opens on GitHub the card an item came from or is linked to, from the header of the place. */
export function CardLink({ card }: CardLinkProps) {
  return (
    <IconButton
      label={cardLinkLabel(card)}
      icon={ICONS.external}
      size="sm"
      onClick={() => void openExternal(card.url)}
    />
  );
}
