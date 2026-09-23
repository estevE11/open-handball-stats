import {
  ArrowLeftRight,
  CircleDot,
  CornerDownLeft,
  Crosshair,
  Footprints,
  Hand,
  RectangleVertical,
  Target,
  Zap,
} from "lucide-react";
import type { EventType } from "../../types/match";
export const eventAppearance = {
  GOAL: { icon: Target, color: "#54723c", className: "goal" },
  GK_SAVE: { icon: Hand, color: "#5c7e9e", className: "save" },
  SHOT_OUT: { icon: Crosshair, color: "#9c865c", className: "out" },
  STEAL: { icon: Zap, color: "#778b5c", className: "steal" },
  TECHNICAL_FAULT: { icon: Footprints, color: "#b28265", className: "fault" },
  REBOUND_REGAINED: {
    icon: CornerDownLeft,
    color: "#8b779f",
    className: "rebound",
  },
  PENALTY_7M: { icon: CircleDot, color: "#6e8062", className: "penalty" },
  SANCTION: {
    icon: RectangleVertical,
    color: "#b28265",
    className: "sanction",
  },
  POSSESSION_SWITCH: {
    icon: ArrowLeftRight,
    color: "#707c73",
    className: "switch",
  },
} satisfies Record<
  EventType,
  { icon: typeof Target; color: string; className: string }
>;
