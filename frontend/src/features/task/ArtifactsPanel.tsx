import { useEffect, useState } from "react";
import { AuxPanel } from "@/components/system/AuxPanel";
import { EmptyState } from "@/components/system/EmptyState";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { PanelRow } from "@/components/system/PanelRow";
import { PanelSection } from "@/components/system/PanelSection";
import { artifactGroupsOf } from "@/features/task/artifacts";
import { PanelDocument } from "@/features/task/PanelDocument";
import { asTaskMode, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

export interface ArtifactsPanelProps {
  task: TaskSummary;
}

/**
 * ArtifactsPanel is the documents a task has written: the PRD and the tech spec, or the One-Shot
 * document, the step files and the draft of the pull request. Each opens in place of the list, and
 * stays open until the way back, whatever the stage does.
 */
export function ArtifactsPanel({ task }: ArtifactsPanelProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const asked = useAppStore((state) => state.panelDocument);
  const clearPanelDocument = useAppStore((state) => state.clearPanelDocument);
  // The file chosen, not the stage, says what is open: the panel never changes document alone. At
  // first it is the one a marker of the conversation asked for.
  const [openFile, setOpenFile] = useState<string | null>(asked);
  // The last file opened is the row the focus returns to on the way back.
  const [lastFile, setLastFile] = useState<string | null>(asked);
  const groups = artifactGroupsOf(task);
  // A document the task no longer has falls back to the list.
  const open =
    groups.flatMap((group) => group.entries).find((entry) => entry.file === openFile) ?? null;
  const oneShot = asTaskMode(task.mode) === "one_shot";

  // Open in Artifacts of a marker opens its document, also with the panel already open.
  useEffect(() => {
    if (asked !== null) {
      setOpenFile(asked);
      setLastFile(asked);
      clearPanelDocument();
    }
  }, [asked, clearPanelDocument]);

  return (
    <AuxPanel id="artifacts" title="Artifacts" onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        {open !== null ? (
          <PanelDocument
            taskId={task.id}
            file={open.file}
            artifactVersion={task.artifactVersion}
            title={open.label}
            back="Artifacts"
            onBack={() => setOpenFile(null)}
            step={open.step}
          />
        ) : groups.length === 0 ? (
          <EmptyState title="No artifacts yet">
            {oneShot
              ? "The One-Shot document appears here once the agent writes it."
              : "The PRD appears here once the agent writes it."}
          </EmptyState>
        ) : (
          groups.map((group) => (
            <PanelSection key={group.legend} legend={group.legend}>
              <ul className="flex flex-col">
                {group.entries.map((entry) => (
                  <li key={entry.file}>
                    <PanelRow
                      onClick={() => {
                        setOpenFile(entry.file);
                        setLastFile(entry.file);
                      }}
                      glyph={<Icon icon={ICONS.file} size="sm" />}
                      {...(entry.meta !== "" ? { meta: entry.meta } : {})}
                      focusOnMount={entry.file === lastFile}
                    >
                      {entry.label}
                    </PanelRow>
                  </li>
                ))}
              </ul>
            </PanelSection>
          ))
        )}
      </div>
    </AuxPanel>
  );
}
