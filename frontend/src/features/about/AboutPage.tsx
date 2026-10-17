import { useId } from "react";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import {
  type UpdateBlock as Block,
  checkedText,
  checkedTip,
  NO_CHECKS,
  NO_NOTES,
  releaseHeading,
  resultOf,
  updateBlockOf,
  versionTitle,
} from "@/features/about/about";
import { CheckForUpdatesButton } from "@/features/about/CheckForUpdatesButton";
import { UpdateBlock } from "@/features/about/UpdateBlock";
import { useNow } from "@/features/attention/useNow";
import { Markdown } from "@/features/chat/Markdown";
import { SettingsBlock, SettingsPage } from "@/features/settings/SettingsPage";
import { FAILURE_TITLE, UP_TO_DATE } from "@/lib/update";
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

/** NewVersion is the newer version: its block, and the notes of every release after the installed one. */
function NewVersion({
  update,
  block,
  now,
}: {
  update: Update;
  block: Exclude<Block, { kind: "none" }>;
  now: number;
}) {
  const id = useId();
  const releases = update.releases ?? [];
  return (
    <>
      <UpdateBlock update={update} block={block} />
      {releases.length > 0 && (
        <SettingsBlock title="Release notes">
          <div className="flex flex-col gap-(--space-6)">
            {releases.map((release) => (
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
      )}
    </>
  );
}

/** AboutPage is Settings › About: the installed version, Check for updates, and, with a newer version, its block (Update to, Restart now) and the notes of every release after the installed one. */
export function AboutPage() {
  const update = useUpdate();
  const block = updateBlockOf(update);
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
      {block.kind !== "none" && <NewVersion update={update} block={block} now={now} />}
    </SettingsPage>
  );
}
