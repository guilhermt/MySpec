import type { ReactNode } from "react";
import { Button } from "@/components/system/Button";
import type { RequestButton } from "@/components/system/RequestBar";
import { Tooltip } from "@/components/system/Tooltip";

export interface RequestButtonsProps<A extends string> {
  /** buttons are the actions of the bar, in their order. */
  buttons: readonly RequestButton<A>[];
  /** running is the action on its way, which shows its loading label; null when none is. */
  running: A | null;
  onPress: (button: RequestButton<A>) => void;
}

/**
 * RequestButtons are the buttons of a request bar, each keyed by its action, with its key written on
 * it and what it does in a tooltip when its label doesn't say it. It is called, not rendered: the bar
 * takes the list as its actions.
 */
export function RequestButtons<A extends string>({
  buttons,
  running,
  onPress,
}: RequestButtonsProps<A>): ReactNode[] {
  return buttons.map((button) => {
    const control = (
      <Button
        key={button.action}
        size="sm"
        variant={button.variant}
        {...(button.disabledReason !== undefined
          ? { disabled: true, disabledReason: button.disabledReason }
          : {})}
        {...(button.loadingLabel !== ""
          ? { loading: running === button.action, loadingLabel: button.loadingLabel }
          : {})}
        {...(button.shortcut !== undefined ? { shortcut: button.shortcut } : {})}
        onClick={() => onPress(button)}
      >
        {button.label}
      </Button>
    );
    // What the action does, when its label doesn't say, is in its tooltip.
    if (button.tooltip === undefined) {
      return control;
    }
    return (
      <Tooltip key={button.action} content={button.tooltip}>
        {control}
      </Tooltip>
    );
  });
}
