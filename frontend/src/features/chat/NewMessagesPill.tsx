import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NewMessagesPillProps {
  onClick: () => void;
}

/** NewMessagesPill takes the reader back to the end, when they want to go. */
export function NewMessagesPill({ onClick }: NewMessagesPillProps) {
  // Rounded centring: a percentage translate that lands on half a pixel, when
  // the width is odd, blurs the text in WebKitGTK.
  return (
    <Button
      variant="secondary"
      size="sm"
      className="absolute bottom-3 left-[round(50%,1px)] translate-x-[round(-50%,1px)] shadow-md"
      onClick={onClick}
    >
      <ArrowDown />
      New messages
    </Button>
  );
}
