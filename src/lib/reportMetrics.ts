import type { TranslationKey } from "../hooks/useTranslation";
import type { CounterattackOrigin, Ratio, TeamStats } from "./reportAnalytics";
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
export const fraction = (value: Ratio) =>
  `${value.numerator} / ${value.denominator}`;
