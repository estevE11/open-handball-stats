import type {
  AttackPhase,
  EventType,
  MatchEvent,
  MatchSession,
  TeamId,
} from "../types/match";
export const otherTeam = (team: TeamId): TeamId =>
  team === "home" ? "away" : "home";
export const teamOf = (match: MatchSession, team: TeamId) =>
  match[team === "home" ? "homeTeam" : "awayTeam"];
export function newMatch(
  home = "Home",
  away = "Away",
  name = `${home} vs ${away}`,
): MatchSession {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    matchName: name,
    date: new Date().toISOString(),
    homeTeam: { name: home, color: "#5684a3", currentDefense: "6:0" },
    awayTeam: { name: away, color: "#c89247", currentDefense: "6:0" },
    currentAttackingTeamId: "home",
    currentPossessionIndex: 1,
    attackPhase: "STATIC",
    period: 1,
    gameTimeSeconds: 0,
    clockStartedAt: null,
    events: [],
  };
}
export function gameSeconds(match: MatchSession, now = Date.now()) {
  return (
    match.gameTimeSeconds +
    (match.clockStartedAt === null
      ? 0
      : Math.max(0, now - match.clockStartedAt) / 1000)
  );
}
export function stopClock(match: MatchSession, now = Date.now()): MatchSession {
  return {
    ...match,
    gameTimeSeconds: gameSeconds(match, now),
    clockStartedAt: null,
  };
}
export function logEvent(
  match: MatchSession,
  eventType: EventType,
  details: Pick<MatchEvent, "subType" | "sanctionTeamId" | "notes"> = {},
  now = Date.now(),
): MatchSession {
  const attacker = match.currentAttackingTeamId;
  const defender = otherTeam(attacker);
  const flips = [
    "GOAL",
    "GK_SAVE",
    "SHOT_OUT",
    "STEAL",
    "TECHNICAL_FAULT",
    "POSSESSION_SWITCH",
  ].includes(eventType);
  const event: MatchEvent = {
    id: crypto.randomUUID(),
    matchId: match.id,
    possessionIndex: match.currentPossessionIndex,
    period: match.period,
    gameTimeSeconds: Math.floor(gameSeconds(match, now)),
    realTimestamp: now,
    attackingTeamId: attacker,
    attackingTeamName: teamOf(match, attacker).name,
    defendingTeamName: teamOf(match, defender).name,
    attackPhase: match.attackPhase,
    defenseSystem: teamOf(match, defender).currentDefense,
    eventType,
    ...details,
    isPossessionFlipped: flips,
  };
  return {
    ...match,
    events: [...match.events, event],
    currentAttackingTeamId: flips ? defender : attacker,
    currentPossessionIndex: match.currentPossessionIndex + Number(flips),
    attackPhase: flips ? ("STATIC" as AttackPhase) : match.attackPhase,
  };
}
export function score(match: MatchSession, team: TeamId) {
  return match.events.filter(
    (event) =>
      event.eventType === "GOAL" &&
      (event.attackingTeamId
        ? event.attackingTeamId === team
        : event.attackingTeamName === teamOf(match, team).name),
  ).length;
}
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
