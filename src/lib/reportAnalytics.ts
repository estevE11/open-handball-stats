import type {
  AttackPhase,
  DefenseSystem,
  MatchEvent,
  MatchSession,
  TeamId,
} from "../types/match";
import { otherTeam } from "./matchEngine";

export const shotTypes = [
  "GOAL",
  "GK_SAVE",
  "SHOT_OUT",
  "SHOT_BLOCKED",
] as const;
const isShot = (event: MatchEvent) =>
  (shotTypes as readonly string[]).includes(event.eventType);
const isMiss = (event?: MatchEvent) =>
  !!event && isShot(event) && event.eventType !== "GOAL";
export interface Possession {
  number: number;
  tagIndices: number[];
  team: TeamId;
  period: number;
  events: MatchEvent[];
  phase: AttackPhase;
  defense: DefenseSystem;
  completed: boolean;
  afterGoal: boolean;
  homeScore: number;
  awayScore: number;
  defenses: Record<TeamId, DefenseSystem | null>;
}
export interface Ratio {
  numerator: number;
  denominator: number;
  value: number | null;
}
export const ratio = (numerator: number, denominator: number): Ratio => ({
  numerator,
  denominator,
  value: denominator ? (numerator / denominator) * 100 : null,
});
export const formatRatio = (value: Ratio) =>
  value.value === null ? "—" : `${value.value.toFixed(1)}%`;
export interface TeamStats {
  goals: number;
  possessions: number;
  pending: number;
  shots: number;
  saved: number;
  out: number;
  blocked: number;
  steals: number;
  lostBalls: number;
  technicalFaults: number;
  turnovers: number;
  caAttempts: number;
  caFinished: number;
  caGoals: number;
  caAborted: number;
  counterGoalAttempts: number;
  counterGoalFinished: number;
  counterGoals: number;
  attack: Ratio;
  defense: Ratio;
  opponentAttack: Ratio;
  shooting: Ratio;
  keeper: Ratio;
  keeperConceded: Ratio;
  counterAttack: Ratio;
  counterGoal: Ratio;
}
export interface DefenseBand {
  system: DefenseSystem | null;
  start: number;
  end: number;
}
export function defenseBands(
  possessions: Possession[],
  team: TeamId,
): DefenseBand[] {
  const bands: DefenseBand[] = [];
  possessions.forEach((possession, index) => {
    const system = possession.defenses[team];
    const last = bands.at(-1);
    if (
      last &&
      last.system === system &&
      (index === 0 || possessions[index - 1].period === possession.period)
    )
      last.end = index;
    else bands.push({ system, start: index, end: index });
  });
  return bands;
}
export function reconstructPossessions(match: MatchSession): Possession[] {
  const possessions: Possession[] = [];
  let active: Possession | undefined;
  let reboundCandidate: Possession | undefined;
  let knownTransition = false;
  for (const event of match.events) {
    const team =
      event.attackingTeamId ??
      (event.attackingTeamName === match.homeTeam.name ? "home" : "away");
    if (event.eventType === "SANCTION") continue;
    if (event.eventType === "POSSESSION_SWITCH") {
      active = undefined;
      reboundCandidate = undefined;
      knownTransition = false;
      continue;
    }
    if (event.eventType === "REBOUND_REGAINED") {
      if (
        event.isPossessionFlipped &&
        reboundCandidate &&
        reboundCandidate.team === otherTeam(team) &&
        reboundCandidate.period === event.period &&
        isMiss(reboundCandidate.events.at(-1))
      ) {
        active = reboundCandidate;
        active.completed = false;
        active.tagIndices.push(event.possessionIndex);
      }
      reboundCandidate = undefined;
      continue;
    }
    if (!active || active.team !== team || active.period !== event.period) {
      const previous = possessions.at(-1);
      active = {
        number: possessions.length + 1,
        tagIndices: [],
        team,
        period: event.period,
        events: [],
        phase: event.attackPhase,
        defense: event.defenseSystem,
        completed: false,
        afterGoal:
          knownTransition &&
          !!previous &&
          previous.completed &&
          previous.team !== team &&
          previous.period === event.period &&
          previous.events.at(-1)?.eventType === "GOAL",
        homeScore: 0,
        awayScore: 0,
        defenses: { home: null, away: null },
      };
      possessions.push(active);
    }
    reboundCandidate = undefined;
    if (!active.tagIndices.includes(event.possessionIndex))
      active.tagIndices.push(event.possessionIndex);
    active.events.push(event);
    active.defense = event.defenseSystem;
    if (event.attackPhase !== "STATIC") active.phase = event.attackPhase;
    if (event.isPossessionFlipped) {
      active.completed = true;
      knownTransition = true;
      if (isMiss(event)) reboundCandidate = active;
      active = undefined;
    }
  }
  let home = 0,
    away = 0,
    period = 0;
  let defenses: Record<TeamId, DefenseSystem | null> = {
    home: null,
    away: null,
  };
  for (const possession of possessions) {
    if (period !== possession.period) defenses = { home: null, away: null };
    period = possession.period;
    for (const event of possession.events) {
      if (event.eventType === "GOAL") {
        if (possession.team === "home") home++;
        else away++;
      }
    }
    defenses[otherTeam(possession.team)] = possession.defense;
    possession.defenses = { ...defenses };
    possession.homeScore = home;
    possession.awayScore = away;
  }
  return possessions;
}
const launched = (p: Possession) =>
  p.events.some((e) => e.attackPhase !== "STATIC");
const caShot = (p: Possession) =>
  p.events.some((e) => e.attackPhase === "COUNTERATTACK" && isShot(e));
const caGoal = (p: Possession) =>
  p.events.some(
    (e) => e.attackPhase === "COUNTERATTACK" && e.eventType === "GOAL",
  );
function teamStats(possessions: Possession[], team: TeamId): TeamStats {
  const own = possessions.filter((p) => p.team === team);
  const rival = possessions.filter((p) => p.team !== team);
  const events = own.flatMap((p) => p.events),
    opponent = rival.flatMap((p) => p.events);
  const count = (type: string, source = events) =>
    source.filter((e) => e.eventType === type).length;
  const completed = own.filter((p) => p.completed).length,
    rivalCompleted = rival.filter((p) => p.completed).length;
  const goals = count("GOAL"),
    conceded = count("GOAL", opponent),
    saves = count("GK_SAVE", opponent);
  const shots = events.filter(isShot).length;
  const ca = own.filter(launched),
    cg = ca.filter((p) => p.afterGoal);
  const steals = count("STEAL", opponent),
    lostBalls = count("STEAL"),
    technicalFaults = count("TECHNICAL_FAULT");
  return {
    goals,
    possessions: completed,
    pending: own.length - completed,
    shots,
    saved: count("GK_SAVE"),
    out: count("SHOT_OUT"),
    blocked: count("SHOT_BLOCKED"),
    steals,
    lostBalls,
    technicalFaults,
    turnovers: steals + lostBalls + technicalFaults,
    caAttempts: ca.length,
    caFinished: ca.filter(caShot).length,
    caGoals: ca.filter(caGoal).length,
    caAborted: ca.filter((p) =>
      p.events.some((e) => e.attackPhase === "COUNTERATTACK_ATTEMPTED"),
    ).length,
    counterGoalAttempts: cg.length,
    counterGoalFinished: cg.filter(caShot).length,
    counterGoals: cg.filter(caGoal).length,
    attack: ratio(goals, completed),
    defense: ratio(rivalCompleted - conceded, rivalCompleted),
    opponentAttack: ratio(conceded, rivalCompleted),
    shooting: ratio(goals, shots),
    keeper: ratio(saves, saves + conceded),
    keeperConceded: ratio(conceded, saves + conceded),
    counterAttack: ratio(ca.filter(caGoal).length, ca.length),
    counterGoal: ratio(cg.filter(caGoal).length, cg.length),
  };
}
export function buildReport(match: MatchSession, period?: number) {
  const all = reconstructPossessions(match);
  const possessions = all.filter(
    (p) => period === undefined || p.period === period,
  );
  return {
    possessions,
    teams: {
      home: teamStats(possessions, "home"),
      away: teamStats(possessions, "away"),
    },
    periods: [...new Set(all.map((p) => p.period))],
  };
}
export type MatchReport = ReturnType<typeof buildReport>;
export function defenseStats(
  possessions: Possession[],
  team: TeamId,
  system: DefenseSystem,
) {
  const defended = possessions.filter(
    (p) => p.team !== team && p.defense === system && p.completed,
  );
  const goals = defended.filter((p) =>
    p.events.some((e) => e.eventType === "GOAL"),
  ).length;
  return {
    possessions: defended.length,
    goals,
    efficiency: ratio(defended.length - goals, defended.length),
  };
}
