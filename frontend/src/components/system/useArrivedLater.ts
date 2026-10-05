import { useState } from "react";

/**
 * useArrivedLater tells whether something became present after the first render: false for what was
 * there when the screen opened, which a reader already reads as part of the screen, true for what
 * arrived while the screen was open, which is what an alert announces.
 */
export function useArrivedLater(present: boolean): boolean {
  const [absentSeen, setAbsentSeen] = useState(!present);
  if (!present && !absentSeen) {
    setAbsentSeen(true);
  }
  return present && absentSeen;
}
