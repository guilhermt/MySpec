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
  unavailableReason,
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
  /** accessibleName is the whole name of the chip, in place of "<label> model: <choice>". */
  accessibleName?: string;
  /** factory is the choice the installed app ships with; only Defaults passes it, and the menu marks it. */
  factory?: ModelChoice;
  saving?: boolean;
  /** size is sm, the chip of the dense rows: the Models popover and Details. */
  size?: "sm";
  ref?: Ref<HTMLButtonElement>;
}

/** READING_NOTE is the tooltip of the chip while the catalog is read. */
const READING_NOTE = "Reading the models of Claude Code · the menu opens when it ends";

/** FACTORY_FOOT is what the foot of the menu says in Defaults, where the factory choice is marked. */
const FACTORY_FOOT = "From the Claude Code installed here, read when MySpec opened.";

/**
 * ModelChip is the chip that picks a model and an effort in the rows of the task screen: the menu
 * has the models and the efforts of the chosen model; a choice the installed Claude Code no longer
 * offers is kept and marked; while the catalog is read the choice shimmers and the menu stays shut,
 * and a catalog never read says why in place of the items. In Defaults the menu marks the factory
 * choice.
 */
export function ModelChip({
  value,
  onChange,
  label,
  own,
  followNote,
  accessibleName,
  factory,
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
  const reason = unavailable ? unavailableReason(catalog, value) : "";
  // A choice that follows another is quiet, in the third ink. In Defaults, where the factory is the
  // reference, the factory choice keeps the chip's second ink.
  const quiet = !own && factory === undefined;
  const note = reading ? READING_NOTE : unavailable ? reason : followNote;
  // The chip draws the note of its own choice and the unavailable reason itself.
  const chipNote = unavailable || (own && !reading);

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
          aria-label={
            accessibleName ?? `${label} model: ${text}${unavailable ? " · unavailable" : ""}`
          }
          {...(note !== "" ? { "aria-describedby": noteId } : {})}
          {...(own && !unavailable && !reading && followNote !== ""
            ? { defaultNote: followNote }
            : {})}
          {...(unavailable ? { unavailableReason: reason } : {})}
          {...(quiet ? { className: "text-ink-3" } : {})}
        >
          {text}
        </Chip>
      }
    />
  );

  return (
    <>
      <Menu {...(saving || reading ? { open: false } : {})}>
        {/* A choice that follows another, and the chip that reads, have their note here. */}
        {!chipNote && note !== "" ? <Tooltip content={note}>{trigger}</Tooltip> : trigger}
        <MenuContent align="end">
          {models.length === 0 && failure !== "" ? (
            <MenuMessage tone="notice">{catalogFailureMessage(failure)}</MenuMessage>
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
                    <MenuRadioItem
                      key={model.name}
                      value={model.name}
                      {...(factory?.model === model.name ? { trailing: "factory" } : {})}
                    >
                      {modelLabel(model.name)}
                    </MenuRadioItem>
                  ))}
                  {current === undefined && (
                    <MenuRadioItem
                      value={value.model}
                      {...(reading ? {} : { unavailable: true, sub: reason })}
                    >
                      {modelLabel(value.model)}
                    </MenuRadioItem>
                  )}
                </MenuRadioGroup>
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>{`Effort · ${modelLabel(value.model)}`}</MenuGroupLabel>
                {takesEffort(catalog, value.model) ? (
                  <MenuRadioGroup
                    value={value.effort}
                    onValueChange={(effort: string) => {
                      if (effort !== value.effort) onChange({ ...value, effort });
                    }}
                  >
                    {efforts.map((effort) => (
                      <MenuRadioItem
                        key={effort}
                        value={effort}
                        {...(factory?.model === value.model && factory.effort === effort
                          ? { trailing: "factory" }
                          : {})}
                      >
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
              {factory !== undefined && (
                <>
                  <MenuSeparator />
                  <MenuText micro>{FACTORY_FOOT}</MenuText>
                </>
              )}
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
