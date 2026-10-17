import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { signLabel } from "@/features/about/about";
import { useAppStore, useUpdate } from "@/store/app-store";

/**
 * UpdateButton is the sign of a newer version: an icon button in the tone of the brand, never of an
 * error, that opens Settings › About with the focus on its item. Without a newer version it is nothing.
 */
export function UpdateButton() {
  const { latest } = useUpdate();
  const openSettings = useAppStore((state) => state.openSettings);

  if (latest === "") {
    return null;
  }

  return (
    <IconButton
      label={signLabel(latest)}
      icon={ICONS.update}
      size="sm"
      onClick={() => openSettings("about", "nav")}
      className="text-brand-ink hover:text-brand-ink"
    />
  );
}
