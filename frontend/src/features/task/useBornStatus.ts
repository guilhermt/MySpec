import { useRef } from "react";

/**
 * useBornStatus is what the status of the bar announces: nothing for the situation already there
 * when the screen mounted, and for one born after, the status it was born with, frozen the first
 * time its id is seen so a later change to its form isn't announced again.
 */
export function useBornStatus(situationId: string | null, status: string): string {
  const mounted = useRef<{ situationId: string | null } | null>(null);
  const born = useRef<{ situationId: string; status: string } | null>(null);
  mounted.current ??= { situationId };
  if (situationId === null || situationId === mounted.current.situationId) {
    return "";
  }
  if (born.current?.situationId !== situationId) {
    born.current = { situationId, status };
  }
  return born.current.status;
}
