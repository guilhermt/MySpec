import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { ExternalLink } from "@/features/chat/ExternalLink";

export interface ImageMarkerProps {
  src?: string | undefined;
  alt?: string | undefined;
}

/** ImageMarker stands for an image the text doesn't draw: its alt text, and its link when it has one. */
export function ImageMarker({ src, alt }: ImageMarkerProps) {
  return (
    <span className="inline-flex items-center gap-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
      <Icon icon={ICONS.image} size="xs" />
      {alt !== undefined && alt !== "" ? alt : "Image"}
      {src !== undefined && src !== "" && <ExternalLink href={src}>link</ExternalLink>}
    </span>
  );
}
