import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ScrollToBottomButtonProps {
  /** hasNew is true when something arrived while the reader was further up. */
  hasNew: boolean;
  onClick: () => void;
}

/** ScrollToBottomButton takes the reader back to the end, and says so when something new arrived. */
export function ScrollToBottomButton({ hasNew, onClick }: ScrollToBottomButtonProps) {
  // Rounded centring: a percentage translate that lands on half a pixel, when
  // the width is odd, blurs the text in WebKitGTK.
  const className =
    "absolute bottom-3 left-[round(50%,1px)] translate-x-[round(-50%,1px)] shadow-md";
  if (hasNew) {
    return (
      <Button variant="secondary" size="sm" className={className} onClick={onClick}>
        <ArrowDown />
        New messages
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      aria-label="Scroll to bottom"
      className={className}
      onClick={onClick}
    >
      <ArrowDown />
    </Button>
  );
}
