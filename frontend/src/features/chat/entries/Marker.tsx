import {
  Archive,
  Ban,
  FileCheck,
  FileText,
  ListChecks,
  type LucideIcon,
  Play,
  RotateCcw,
} from "lucide-react";
import { stageLabel } from "@/lib/stages";
import { asMarkerType, asTaskStage, type MarkerEntry, type MarkerType } from "@/lib/wails";

const MARKERS: Record<MarkerType, { icon: LucideIcon; text: string }> = {
  prd_written: { icon: FileCheck, text: "PRD written" },
  prd_updated: { icon: FileText, text: "PRD updated" },
  tech_spec_written: { icon: FileCheck, text: "Tech spec written" },
  tech_spec_updated: { icon: FileText, text: "Tech spec updated" },
  plan_written: { icon: ListChecks, text: "Plan written" },
  plan_updated: { icon: ListChecks, text: "Plan updated" },
  stage_started: { icon: Play, text: "Stage started" },
  step_started: { icon: Play, text: "Step started" },
  compacted: { icon: Archive, text: "Context compacted" },
  interrupted: { icon: Ban, text: "Interrupted" },
};

// A stage marker names the stage it opened, and says whether the user asked
// for it again.
function stageMarker(marker: MarkerEntry): { icon: LucideIcon; text: string } {
  return {
    icon: marker.restarted ? RotateCcw : Play,
    text: `${stageLabel(asTaskStage(marker.stage))} ${marker.restarted ? "restarted" : "started"}`,
  };
}

// A step marker names the step it opened, and says whether the user discarded
// the step and started it over.
function stepMarker(marker: MarkerEntry): { icon: LucideIcon; text: string } {
  return {
    icon: marker.restarted ? RotateCcw : Play,
    text: `Step ${marker.step} ${marker.restarted ? "restarted" : "started"}`,
  };
}

// A stage and a step marker read from the marker itself; the rest are fixed.
function markerOf(type: MarkerType, marker: MarkerEntry): { icon: LucideIcon; text: string } {
  switch (type) {
    case "stage_started":
      return stageMarker(marker);
    case "step_started":
      return stepMarker(marker);
    default:
      return MARKERS[type];
  }
}

function timeOf(createdAt: string): string {
  const at = new Date(createdAt);
  return Number.isNaN(at.getTime())
    ? ""
    : at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export interface MarkerProps {
  marker: MarkerEntry;
  createdAt: string;
}

/** Marker is a milestone of the conversation, drawn as a rule across it. */
export function Marker({ marker, createdAt }: MarkerProps) {
  const type = asMarkerType(marker.type);
  const { icon: Icon, text } = markerOf(type, marker);
  const time = timeOf(createdAt);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span aria-hidden="true" className="flex-1 border-t" />
      <Icon className="size-3 shrink-0" />
      <span>{text}</span>
      {time !== "" && <span className="tabular-nums">{time}</span>}
      <span aria-hidden="true" className="flex-1 border-t" />
    </div>
  );
}
