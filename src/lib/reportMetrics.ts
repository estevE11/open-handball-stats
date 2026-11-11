import type { TranslationKey } from "../hooks/useTranslation";
import type {
  CounterattackOrigin,
  IntervalTeamStats,
  Ratio,
  TeamStats,
} from "./reportAnalytics";
export const efficiencyMetrics = [
  ["attackEfficiency", "attack"],
  ["defenseEfficiency", "defense"],
  ["caEfficiency", "counterAttack"],
  ["shotEfficiency", "shooting"],
  ["keeperEfficiency", "keeper"],
  ["keeperConceded", "keeperConceded"],
] as const satisfies readonly (readonly [TranslationKey, keyof TeamStats])[];
export const countMetrics = [
  ["goals", "goals"],
  ["completedPossessions", "possessions"],
  ["pendingPossessions", "pending"],
  ["shotPossessions", "shotPossessions"],
  ["shots", "shots"],
  ["stealsWon", "steals"],
  ["lostBalls", "lostBalls"],
  ["technicalFaults", "technicalFaults"],
  ["totalTurnovers", "turnovers"],
] as const satisfies readonly (readonly [TranslationKey, keyof TeamStats])[];
export const counterattackSources = [
  ["afterRecovery", "RECOVERY"],
  ["afterKeeperSave", "KEEPER_SAVE"],
  ["afterGoal", "GOAL"],
  ["afterTechnicalFault", "TECHNICAL_FAULT"],
  ["unknownOrigin", "UNKNOWN"],
] as const satisfies readonly (readonly [
  TranslationKey,
  CounterattackOrigin,
])[];
export type EfficiencyMetric = (typeof efficiencyMetrics)[number][1];
export const intervalMetrics = [
  ["scorePlusMinus", "difference"],
  ["offensiveEfficiency", "attack"],
  ["defenseEfficiency", "defense"],
] as const satisfies readonly (readonly [
  TranslationKey,
  keyof IntervalTeamStats,
])[];
export const formatDifference = (value: number) =>
  `${value > 0 ? "+" : ""}${value}`;
// Shared by the report and PDF: white at the midpoint, stronger green/red as
// values move above/below it. A missing denominator stays neutral.
export function intervalCellColor(
  value: number | null,
  midpoint = 50,
  range = 50,
) {
  if (value === null) return "#ffffff";
  const amount = Math.min(1, Math.abs(value - midpoint) / Math.max(1, range));
  const target = value >= midpoint ? [95, 197, 154] : [239, 150, 144];
  return `#${target
    .map((channel) =>
      Math.round(255 + (channel - 255) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
export const fraction = (value: Ratio) =>
  `${value.numerator} / ${value.denominator}`;
