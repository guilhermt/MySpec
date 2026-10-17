import { useId } from "react";
import { CopyBlock } from "@/components/system/CopyBlock";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import {
  checkedText,
  checkedTip,
  HOW_TO_UPDATE,
  NO_CHECKS,
  NO_NOTES,
  releaseHeading,
  resultOf,
  versionTitle,
} from "@/features/about/about";
import { CheckForUpdatesButton } from "@/features/about/CheckForUpdatesButton";
import { useNow } from "@/features/attention/useNow";
import { Markdown } from "@/features/chat/Markdown";
import { SettingsBlock, SettingsPage } from "@/features/settings/SettingsPage";
import { availableText, FAILURE_TITLE, UP_TO_DATE } from "@/lib/update";
import type { Update } from "@/lib/wails";
import { useUpdate } from "@/store/app-store";

const MINUTE = 60_000;

/** Result is what the page says of the last check, below the version. */
function Result({ update }: { update: Update }) {
  const result = resultOf(update);
  switch (result.kind) {
    case "local":
      return <p className="text-(length:--text-meta) text-ink-3">{NO_CHECKS}</p>;
    case "failed":
      return (
        <>
          <span className="inline-flex items-center gap-(--space-1-5) text-(length:--text-meta) font-medium text-ink-2">
            <StateGlyph state="blocked" size="sm" />
            {FAILURE_TITLE}
          </span>
          <p className="text-(length:--text-meta) text-ink-3">{result.reason}</p>
        </>
      );
    case "latest":
      return <p className="text-(length:--text-meta) text-ink-3">{UP_TO_DATE}</p>;
    case "available":
    case "none":
      return null;
  }
}

/** NewVersion is the newer version: how to update, the install command and the notes of every release after the installed one. */
function NewVersion({ update, now }: { update: Update; now: number }) {
  const id = useId();
  return (
    <>
      <section aria-labelledby={id} className="flex flex-col gap-(--space-3)">
        <h3
          id={id}
          className="text-(length:--text-body) leading-(--leading-body) font-semibold text-ink-1"
        >
          {availableText(update.latest)}
        </h3>
        <p className="max-w-(--measure-read) text-(length:--text-body) leading-(--leading-body) text-ink-3">
          {HOW_TO_UPDATE}
        </p>
        <CopyBlock
          label="Install command"
          copyLabel="Copy the install command"
          text={update.installCommand}
        />
      </section>
      <SettingsBlock title="Release notes">
        <div className="flex flex-col gap-(--space-6)">
          {(update.releases ?? []).map((release) => (
            <article
              key={release.version}
              aria-labelledby={`${id}-${release.version}`}
              className="flex flex-col gap-(--space-2)"
            >
              <h4
                id={`${id}-${release.version}`}
                className="text-(length:--text-ui) leading-(--leading-ui) font-semibold text-ink-1"
              >
                {releaseHeading(release, now)}
              </h4>
              {release.notes.trim() === "" ? (
                <p className="text-(length:--text-meta) text-ink-3">{NO_NOTES}</p>
              ) : (
                <Markdown className="ui-headings">{release.notes}</Markdown>
              )}
            </article>
          ))}
        </div>
      </SettingsBlock>
    </>
  );
}

/** AboutPage is Settings › About: the installed version, Check for updates, and, with a newer version, how to update and the notes of every release after the installed one. */
export function AboutPage() {
  const update = useUpdate();
  const now = useNow(MINUTE, true);
  return (
    <SettingsPage
      title="About"
      sentence="The version of MySpec on this machine and what the releases after it bring."
      action={update.checks ? <CheckForUpdatesButton /> : undefined}
    >
      <SettingsBlock title="Version">
        <div className="flex flex-col gap-(--space-1)">
          <p className="text-(length:--text-body) leading-(--leading-body) font-semibold text-ink-1">
            {versionTitle(update)}
          </p>
          <Result update={update} />
          {update.checkedAt !== "" && update.checks && (
            <Tooltip content={checkedTip(update.checkedAt, now)}>
              <span className="text-(length:--text-micro) text-ink-4">
                {checkedText(update.checkedAt, now)}
              </span>
            </Tooltip>
          )}
        </div>
      </SettingsBlock>
      {update.latest !== "" && <NewVersion update={update} now={now} />}
    </SettingsPage>
  );
}
