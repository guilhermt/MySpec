import { useState } from "react";
import { Button } from "@/components/system/Button";
import type { Machine } from "@/lib/wails";
import { checkMachineAgain } from "@/store/actions";
import { useMachine } from "@/store/app-store";

/** CheckAgainButton checks the machine again and announces what it found; while a check runs it shows Checking… and does nothing. */
export function CheckAgainButton({ onChecked }: { onChecked?: (machine: Machine | null) => void }) {
  const { running } = useMachine();
  // pending covers the gap between the click and the arrival of running with the state.
  const [pending, setPending] = useState(false);
  const busy = running || pending;

  const check = async () => {
    if (busy) {
      return;
    }
    setPending(true);
    try {
      const machine = await checkMachineAgain();
      onChecked?.(machine);
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
      Check again
    </Button>
  );
}
