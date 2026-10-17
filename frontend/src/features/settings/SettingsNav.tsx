import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import { signOf, signText } from "@/features/about/about";
import { missingItems, navMissingText } from "@/features/machine/machine";
import {
  missingClones,
  missingText,
  nextPage,
  pageOf,
  SETTINGS_PAGES,
  type SettingsPage,
} from "@/features/settings/settings-nav";
import { cn } from "@/lib/utils";
import { useAppStore, useMachine, useSettingsUi, useUpdate } from "@/store/app-store";

const NO_REPOSITORIES: never[] = [];

/** Mark is what an item carries at its end: how it looks and what a screen reader reads. */
interface Mark {
  visual: ReactNode;
  description: string;
}

/**
 * SettingsNav is the navigation of Settings: the six pages as links, the open one the stop of Tab.
 * The arrows open the page they reach, as the tabs do, and Home and End the ends of the list; with the
 * list in a row, as it is in a narrow window, the side arrows too. Repositories carries ◇ N when
 * the clone of a repository is missing, Machine when something on the machine is, and About
 * when a newer version is known.
 */
export function SettingsNav() {
  const { settingsSection } = useSettingsUi();
  const repositories = useAppStore((state) => state.app?.repositories ?? NO_REPOSITORIES);
  const pendingFocus = useAppStore((state) => state.pendingFocus);
  const clearPendingFocus = useAppStore((state) => state.clearPendingFocus);
  const selectSettingsSection = useAppStore((state) => state.selectSettingsSection);
  const machine = useMachine();
  const update = useUpdate();
  const open = pageOf(settingsSection);
  const missing = missingClones(repositories);
  const lacking = missingItems(machine).length;
  const markId = useId();

  const list = useRef<HTMLUListElement>(null);
  const items = useRef(new Map<SettingsPage, HTMLAnchorElement>());
  const focusAfterRender = useRef(false);

  // The page a key opened is on screen after the render: the focus follows it.
  useEffect(() => {
    if (focusAfterRender.current) {
      focusAfterRender.current = false;
      items.current.get(open)?.focus();
    }
  }, [open]);

  // Opened by Ctrl+, or by a link, Settings puts the focus on the item of the page.
  useEffect(() => {
    if (pendingFocus === "nav") {
      items.current.get(open)?.focus();
      clearPendingFocus();
    }
  }, [pendingFocus, open, clearPendingFocus]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // A key with a modifier is someone else's, like Alt+← that goes back.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const inline = list.current !== null && getComputedStyle(list.current).flexDirection === "row";
    const next = nextPage(open, event.key, inline);
    if (next === null) {
      return;
    }
    event.preventDefault();
    focusAfterRender.current = true;
    selectSettingsSection(next);
  };

  // markOf is what the item of a page carries at its end, with what a screen reader reads of it.
  const markOf = (page: SettingsPage): Mark | null => {
    if (page === "about") {
      const sign = signOf(update);
      return sign === null
        ? null
        : {
            visual:
              sign.kind === "updating" ? (
                <Spinner tone="current" />
              ) : (
                <Icon
                  icon={sign.kind === "installed" ? ICONS.refresh : ICONS.update}
                  size="xs"
                  tone="active"
                />
              ),
            description: signText(sign),
          };
    }
    const count = page === "repositories" ? missing.length : page === "machine" ? lacking : 0;
    if (count === 0) {
      return null;
    }
    return {
      visual: (
        <>
          <StateGlyph state="blocked" size="sm" />
          {count}
        </>
      ),
      description: page === "machine" ? navMissingText(machine) : missingText(missing),
    };
  };

  return (
    <nav aria-label="Settings" onKeyDown={onKeyDown} className="settings-nav">
      <ul
        ref={list}
        className="flex flex-col gap-(--space-0-5) @max-[820px]/main:flex-row @max-[820px]/main:flex-wrap @max-[820px]/main:gap-(--space-1)"
      >
        {SETTINGS_PAGES.map(({ page, label, icon }) => {
          const current = page === open;
          const mark = markOf(page);
          const link = (
            // biome-ignore lint/a11y/useValidAnchor: a page link of Settings, which has no URL of its own; the click is the navigation.
            <a
              ref={(element) => {
                if (element === null) {
                  items.current.delete(page);
                } else {
                  items.current.set(page, element);
                }
              }}
              href="#"
              {...(current ? { "aria-current": "page" as const } : {})}
              {...(mark !== null ? { "aria-describedby": `${markId}-${page}` } : {})}
              tabIndex={current ? 0 : -1}
              onClick={(event: MouseEvent) => {
                event.preventDefault();
                selectSettingsSection(page);
              }}
              className={cn(
                "flex h-(--size-control) items-center gap-(--space-2) rounded-sm px-(--space-2-5) text-(length:--text-ui) leading-(--leading-ui) text-ink-2 outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover hover:text-ink-1 active:bg-veil-press focus-visible:focus-ring",
                current &&
                  "bg-brand-tint-plane font-medium text-ink-1 shadow-[inset_0_0_0_var(--border)_var(--brand-ring)] hover:bg-brand-tint-plane active:bg-brand-tint-plane",
              )}
            >
              <Icon icon={ICONS[icon]} tone={current ? "active" : "muted"} />
              <span>{label}</span>
              {mark !== null && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-auto flex items-center gap-(--space-1) text-(length:--text-micro) leading-(--leading-micro) tabular-nums",
                    current ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  {mark.visual}
                </span>
              )}
            </a>
          );
          return (
            <li key={page}>
              {mark !== null ? <Tooltip content={mark.description}>{link}</Tooltip> : link}
              {mark !== null && (
                <span id={`${markId}-${page}`} className="sr-only">
                  {mark.description}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
