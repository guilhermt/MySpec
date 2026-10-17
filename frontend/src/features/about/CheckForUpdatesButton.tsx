import { useState } from "react";
import { Button } from "@/components/system/Button";
import { checkForUpdates } from "@/store/actions";
import { useUpdate } from "@/store/app-store";

/** CheckForUpdatesButton checks for a newer version and announces what it found; while a check runs, an automatic one too, it shows Checking… and does nothing. */
export function CheckForUpdatesButton() {
  const { running, latest } = useUpdate();
  // pending covers the gap between the click and the arrival of running with the state.
  const [pending, setPending] = useState(false);
  const busy = running || pending;

  const check = async () => {
    if (busy) {
      return;
    }
    setPending(true);
    try {
      await checkForUpdates(latest);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      loadingLabel="Checking…"
      onClick={() => void check()}
    >
      Check for updates
    </Button>
  );
}
