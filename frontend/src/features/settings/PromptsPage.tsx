import { useEffect, useState } from "react";
import { Badge } from "@/components/system/Badge";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { SkeletonBar } from "@/components/system/Skeleton";
import { Tooltip } from "@/components/system/Tooltip";
import { editedLabel, PROMPTS } from "@/features/settings/prompts";
import { SettingsList } from "@/features/settings/SettingsList";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SaveFailure } from "@/features/task/SaveFailure";
import { messageOf } from "@/lib/errors";
import type { PromptListing } from "@/lib/wails";
import { fullTime } from "@/lib/when";
import { listPrompts } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** Listing is the reading of which prompts are edited, as the page holds it. */
type Listing =
  | { status: "loading" }
  | { status: "ready"; listings: readonly PromptListing[] }
  | { status: "failed"; message: string };

/**
 * PromptsPage is the list of the nine prompts, each a link that opens it, with Default or the date it
 * was edited at its right. The dates are read when the list opens; a failure of the reading leaves
 * that column empty and says so under the list, and every prompt still opens.
 */
export function PromptsPage() {
  const selectSettingsSection = useAppStore((state) => state.selectSettingsSection);
  const [listing, setListing] = useState<Listing>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const now = Date.now();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt reads the list again.
  useEffect(() => {
    let stale = false;
    setListing({ status: "loading" });
    listPrompts()
      .then((listings) => {
        if (!stale) setListing({ status: "ready", listings });
      })
      .catch((reason: unknown) => {
        if (!stale) setListing({ status: "failed", message: messageOf(reason) });
      });
    return () => {
      stale = true;
    };
  }, [attempt]);

  return (
    <SettingsPage
      title="Prompts"
      sentence="The instructions each session starts with. A prompt you never edit follows the default of every new version of MySpec."
    >
      <div className="flex flex-col gap-(--space-3)">
        <SettingsList label="Prompts">
          {PROMPTS.map(({ stage, name, description }) => {
            const edited =
              listing.status === "ready"
                ? listing.listings.find((entry) => entry.stage === stage)
                : undefined;
            return (
              <li key={stage}>
                {/* biome-ignore lint/a11y/useValidAnchor: a row of the list that opens a prompt, which has no URL of its own; the click is the navigation. */}
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    selectSettingsSection(stage);
                  }}
                  className="grid grid-cols-[var(--icon)_minmax(0,1fr)_auto_var(--icon)] items-start gap-(--space-3) p-(--space-3) text-ink-1 outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:shadow-[inset_0_0_0_var(--focus-width)_var(--focus)]"
                >
                  <Icon icon={ICONS.prompt} tone="muted" className="mt-(--space-0-5)" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-(length:--text-ui) leading-(--leading-ui) font-medium">
                      {name}
                    </span>
                    <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                      {description}
                    </span>
                  </span>
                  <span className="flex min-w-(--space-12) items-center justify-end text-(length:--text-meta) leading-(--leading-meta)">
                    {listing.status === "loading" ? (
                      <SkeletonBar className="w-(--space-8)" />
                    ) : edited?.modified === true ? (
                      <Tooltip content={fullTime(edited.editedAt)}>
                        <span>
                          <Badge variant="edited">{editedLabel(edited.editedAt, now)}</Badge>
                        </span>
                      </Tooltip>
                    ) : listing.status === "ready" ? (
                      <span className="text-ink-4">Default</span>
                    ) : null}
                  </span>
                  <Icon icon={ICONS.go} tone="muted" className="mt-(--space-0-5)" />
                </a>
              </li>
            );
          })}
        </SettingsList>
        {listing.status === "failed" && (
          <SaveFailure
            onRetry={() => setAttempt((count) => count + 1)}
            className="text-(length:--text-meta) leading-(--leading-meta)"
          >
            {`Couldn't read which prompts are edited: ${listing.message}`}
          </SaveFailure>
        )}
      </div>
    </SettingsPage>
  );
}
