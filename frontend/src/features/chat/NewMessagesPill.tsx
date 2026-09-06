import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NewMessagesPillProps {
  onClick: () => void;
}

/** NewMessagesPill takes the reader back to the end, when they want to go. */
export function NewMessagesPill({ onClick }: NewMessagesPillProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
      onClick={onClick}
    >
      <ArrowDown />
      New messages
    </Button>
  );
}
