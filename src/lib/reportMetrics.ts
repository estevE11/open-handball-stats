import type { TranslationKey } from "../hooks/useTranslation";
import type { Ratio, TeamStats } from "./reportAnalytics";
export const efficiencyMetrics = [
  ["attackEfficiency", "attack"],
  ["defenseEfficiency", "defense"],
  ["rivalEfficiency", "opponentAttack"],
  ["caEfficiency", "counterAttack"],
  ["cgEfficiency", "counterGoal"],
  ["shotEfficiency", "shooting"],
  ["keeperEfficiency", "keeper"],
  ["keeperConceded", "keeperConceded"],
] as const satisfies readonly (readonly [TranslationKey, keyof TeamStats])[];
export const countMetrics = [
  ["goals", "goals"],
  ["completedPossessions", "possessions"],
  ["pendingPossessions", "pending"],
  ["shots", "shots"],
  ["stealsWon", "steals"],
  ["lostBalls", "lostBalls"],
  ["technicalFaults", "technicalFaults"],
  ["totalTurnovers", "turnovers"],
] as const satisfies readonly (readonly [TranslationKey, keyof TeamStats])[];
export type EfficiencyMetric = (typeof efficiencyMetrics)[number][1];
export const fraction = (value: Ratio) =>
  `${value.numerator} / ${value.denominator}`;
