import { type ReactNode, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { CopyBlock } from "@/components/system/CopyBlock";
import { StateGlyph } from "@/components/system/StateGlyph";
import {
  ALTERNATIVE,
  type UpdateBlock as Block,
  keepsRunningText,
  NO_AGENTS,
  RESTART_FAILURE_TITLE,
  RESTART_REMEDY,
  STOPS_AGENTS,
  UPDATING_NOTE,
  workingLines,
} from "@/features/about/about";
import {
  availableText,
  INSTALL_FAILURE_TITLE,
  installedText,
  installFailureReason,
  installFailureRemedy,
  UPDATING,
  updateLabel,
} from "@/lib/update";
import type { Update } from "@/lib/wails";
import { installUpdate, restartForUpdate } from "@/store/actions";
import { useAppStore, useUpdateLater } from "@/store/app-store";

const READ = "max-w-(--measure-read) text-(length:--text-body) leading-(--leading-body)";

/** Failure is what the block says of a work that failed: the title, the reason and the remedy, below the heading. */
function Failure({ title, reason, remedy }: { title: string; reason: string; remedy: string }) {
  return (
    <div className="flex flex-col gap-(--space-1)">
      <span className="inline-flex items-center gap-(--space-1-5) text-(length:--text-meta) font-medium text-ink-2">
        <StateGlyph state="blocked" size="sm" />
        {title}
      </span>
      <p className="text-(length:--text-meta) text-ink-3">{reason}</p>
      {remedy !== "" && <p className="text-(length:--text-meta) text-ink-3">{remedy}</p>}
    </div>
  );
}

/** Heading is the title of the block, which names the section. */
function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="text-(length:--text-body) leading-(--leading-body) font-semibold text-ink-1"
    >
      {children}
    </h3>
  );
}

/** UpdateAction is Update to and Try again: it starts the installation and loads until the state follows. */
function UpdateAction({ label, loading }: { label: string; loading: boolean }) {
  // pending covers the gap between the click and the arrival of the installing phase with the state.
  const [pending, setPending] = useState(false);
  const busy = loading || pending;

  const install = async () => {
    if (busy) {
      return;
    }
    setPending(true);
    try {
      await installUpdate();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="primary"
      size="sm"
      loading={busy}
      loadingLabel={UPDATING}
      onClick={() => void install()}
    >
      {label}
    </Button>
  );
}

/** InstallCommand offers the install command to run in a terminal. */
function InstallCommand({ update }: { update: Update }) {
  return (
    <CopyBlock
      label="Install command"
      copyLabel="Copy the install command"
      text={update.installCommand}
    />
  );
}

/** Installed is the installed version: what keeps running, the agents a restart cuts, Restart now and Later. */
function Installed({ update, id, version }: { update: Update; id: string; version: string }) {
  const app = useAppStore((state) => state.app);
  const later = useUpdateLater();
  const deferUpdateRestart = useAppStore((state) => state.deferUpdateRestart);
  const [pending, setPending] = useState(false);
  const restartRef = useRef<HTMLButtonElement>(null);
  const { restartError } = update.install;
  const working = update.install.working ?? [];

  const restart = async () => {
    setPending(true);
    try {
      await restartForUpdate();
    } finally {
      setPending(false);
    }
  };

  const defer = () => {
    deferUpdateRestart();
    restartRef.current?.focus();
  };

  return (
    <>
      <Heading id={id}>{installedText(version)}</Heading>
      <p className={`${READ} text-ink-3`}>{keepsRunningText(update.version)}</p>
      {working.length > 0 ? (
        <div className="flex flex-col gap-(--space-1)">
          <p className={`${READ} text-ink-3`}>{STOPS_AGENTS}</p>
          <ul className={`${READ} list-disc pl-(--space-5) text-ink-2`}>
            {workingLines(app, working).map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the lines are a fixed list that may repeat
              <li key={index}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={`${READ} text-ink-3`}>{NO_AGENTS}</p>
      )}
      {restartError !== "" && (
        <Failure title={RESTART_FAILURE_TITLE} reason={restartError} remedy={RESTART_REMEDY} />
      )}
      <div className="flex items-center gap-(--space-2)">
        <Button
          ref={restartRef}
          variant="primary"
          size="sm"
          loading={pending}
          loadingLabel="Restarting…"
          onClick={() => void restart()}
        >
          Restart now
        </Button>
        {!later && (
          <Button variant="secondary" size="sm" onClick={defer}>
            Later
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * UpdateBlock is the block of the newer version on About, in the state of its installation:
 * available (Update to), updating (the same button, loading), failed (the reason, Try again and the
 * install command) and installed (Restart now and Later, and the agents a restart cuts).
 */
export function UpdateBlock({
  update,
  block,
}: {
  update: Update;
  block: Exclude<Block, { kind: "none" }>;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-(--space-3)">
      {block.kind === "installed" ? (
        <Installed update={update} id={id} version={block.version} />
      ) : (
        <>
          <Heading id={id}>{availableText(block.version)}</Heading>
          {block.kind === "failed" ? (
            <>
              <Failure
                title={INSTALL_FAILURE_TITLE}
                reason={installFailureReason(block.failure)}
                remedy={installFailureRemedy(block.failure)}
              />
              {(block.failure.commands ?? []).map((command) => (
                <CopyBlock
                  key={command}
                  label="Command"
                  copyLabel="Copy the command"
                  text={command}
                />
              ))}
              <div>
                <UpdateAction label="Try again" loading={false} />
              </div>
              <p className={`${READ} text-ink-3`}>{ALTERNATIVE}</p>
              <InstallCommand update={update} />
            </>
          ) : (
            <>
              <div>
                <UpdateAction
                  label={updateLabel(block.version)}
                  loading={block.kind === "updating"}
                />
              </div>
              {block.kind === "updating" && (
                <p className="text-(length:--text-meta) text-ink-3">{UPDATING_NOTE}</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
