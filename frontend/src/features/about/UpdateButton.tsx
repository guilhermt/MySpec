import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { signLabel, signOf } from "@/features/about/about";
import { useAppStore, useUpdate } from "@/store/app-store";

/**
 * UpdateButton is the sign of a newer version: an icon button in the tone of the brand, never of an
 * error, that opens Settings › About with the focus on its item. It shows the update icon when a
 * version is available, a spinner while it installs, and the restart icon once it is installed;
 * the click works in all three. Without a newer version it is nothing.
 */
export function UpdateButton() {
  const update = useUpdate();
  const openSettings = useAppStore((state) => state.openSettings);
  const sign = signOf(update);

  if (sign === null) {
    return null;
  }

  return (
    <IconButton
      label={signLabel(sign)}
      icon={sign.kind === "installed" ? ICONS.refresh : ICONS.update}
      busy={sign.kind === "updating"}
      size="sm"
      onClick={() => openSettings("about", "nav")}
      className="text-brand-ink hover:text-brand-ink"
    />
  );
}
