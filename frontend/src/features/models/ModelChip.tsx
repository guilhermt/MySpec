import { type Ref, useId } from "react";
import { Chip } from "@/components/system/Chip";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuMessage,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuText,
  MenuTrigger,
} from "@/components/system/Menu";
import { Tooltip } from "@/components/system/Tooltip";
import {
  catalogFailureMessage,
  catalogModel,
  catalogModels,
  choiceLabel,
  choiceUnavailable,
  type ModelChoice,
  modelLabel,
  takesEffort,
} from "@/lib/models";
import { asCatalogFailure } from "@/lib/wails";
import { useModelCatalog } from "@/store/app-store";

export interface ModelChipProps {
  value: ModelChoice;
  onChange: (choice: ModelChoice) => void;
  /** label names what the choice is for, as a screen reader says it: "PRD", "Step 4". */
  label: string;
  /** own is a choice of its own, apart from what it would follow; it reads in the first ink. */
  own: boolean;
  /**
   * followNote is the tooltip: what an own choice sets aside ("Its own model · Implementation uses
   * Sonnet · high"), or what the choice follows ("Follows Implementation"); "" for none.
   */
  followNote: string;
  saving?: boolean;
  /** size is sm, the chip of the dense rows: the Models popover and Details. */
  size?: "sm";
  ref?: Ref<HTMLButtonElement>;
}

/** UNAVAILABLE_REASON is why a choice is marked unavailable. */
const UNAVAILABLE_REASON = "Not in the models of the installed Claude Code";

/**
 * ModelChip is the chip that picks a model and an effort in the rows of the task screen: the menu
 * has the models and the efforts of the chosen model; a choice the installed Claude Code no longer
 * offers is kept and marked; while the catalog is read the choice shimmers, and a catalog never read
 * says why in place of the items.
 */
export function ModelChip({
  value,
  onChange,
  label,
  own,
  followNote,
  saving = false,
  size,
  ref,
}: ModelChipProps) {
  const noteId = useId();
  const catalog = useModelCatalog();
  const models = catalogModels(catalog);
  const failure = asCatalogFailure(catalog.failure);
  const reading = models.length === 0 && failure === "";
  const unavailable = models.length > 0 && choiceUnavailable(catalog, value);
  const text = choiceLabel(catalog, value);
  const current = catalogModel(catalog, value.model);
  const efforts = current?.efforts ?? [];
  const note = unavailable ? UNAVAILABLE_REASON : followNote;

  const trigger = (
    <MenuTrigger
      ref={ref}
      render={
        <Chip
          kind="menu"
          size={size ?? "sm"}
          own={own}
          reading={reading}
          loading={saving}
          loadingLabel="Saving…"
          aria-label={`${label} model: ${text}${unavailable ? " · unavailable" : ""}`}
          {...(note !== "" ? { "aria-describedby": noteId } : {})}
          {...(own && !unavailable && followNote !== "" ? { defaultNote: followNote } : {})}
          {...(unavailable ? { unavailableReason: UNAVAILABLE_REASON } : {})}
          {...(own ? {} : { className: "text-ink-3" })}
        >
          {text}
        </Chip>
      }
    />
  );

  return (
    <>
      <Menu {...(saving ? { open: false } : {})}>
        {/* The chip draws the note of its own choice and the unavailable reason; a choice that
            follows another has its note here. */}
        {!own && !unavailable && followNote !== "" ? (
          <Tooltip content={followNote}>{trigger}</Tooltip>
        ) : (
          trigger
        )}
        <MenuContent align="end">
          {models.length === 0 && failure !== "" ? (
            <MenuMessage tone="error">{catalogFailureMessage(failure)}</MenuMessage>
          ) : (
            <>
              <MenuGroup>
                <MenuGroupLabel>Model</MenuGroupLabel>
                <MenuRadioGroup
                  value={value.model}
                  onValueChange={(model: string) => {
                    if (model !== value.model) onChange({ ...value, model });
                  }}
                >
                  {models.map((model) => (
                    <MenuRadioItem key={model.name} value={model.name}>
                      {modelLabel(model.name)}
                    </MenuRadioItem>
                  ))}
                  {current === undefined && (
                    <MenuRadioItem
                      value={value.model}
                      {...(reading ? {} : { unavailable: true, sub: UNAVAILABLE_REASON })}
                    >
                      {modelLabel(value.model)}
                    </MenuRadioItem>
                  )}
                </MenuRadioGroup>
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Effort</MenuGroupLabel>
                {takesEffort(catalog, value.model) ? (
                  <MenuRadioGroup
                    value={value.effort}
                    onValueChange={(effort: string) => {
                      if (effort !== value.effort) onChange({ ...value, effort });
                    }}
                  >
                    {efforts.map((effort) => (
                      <MenuRadioItem key={effort} value={effort}>
                        {effort}
                      </MenuRadioItem>
                    ))}
                    {value.effort !== "" && !efforts.includes(value.effort) && (
                      <MenuRadioItem
                        value={value.effort}
                        {...(reading ? {} : { unavailable: true })}
                      >
                        {value.effort}
                      </MenuRadioItem>
                    )}
                  </MenuRadioGroup>
                ) : (
                  <MenuText>{`${modelLabel(value.model)} has no effort levels.`}</MenuText>
                )}
              </MenuGroup>
            </>
          )}
        </MenuContent>
      </Menu>
      {note !== "" && (
        <span id={noteId} className="sr-only">
          {note}
        </span>
      )}
    </>
  );
}
