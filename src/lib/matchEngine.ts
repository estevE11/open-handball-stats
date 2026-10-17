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
  const before = match.currentAttackingTeamId;
  const attacker =
    eventType === "REBOUND_REGAINED" ? otherTeam(before) : before;
  const defender = otherTeam(attacker);
  const flips = [
    "GOAL",
    "GK_SAVE",
    "SHOT_OUT",
    "SHOT_BLOCKED",
    "REBOUND_REGAINED",
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
    ...(eventType === "REBOUND_REGAINED"
      ? { possessionBeforeTeamId: before }
      : {}),
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
    currentAttackingTeamId: flips ? otherTeam(before) : before,
    currentPossessionIndex: match.currentPossessionIndex + Number(flips),
    attackPhase: flips ? ("STATIC" as AttackPhase) : match.attackPhase,
  };
}
// Older rebounds described the team before the automatic switch back. Correct
// their attribution for display and exports without rewriting stored history.
export function attributedEvents(match: MatchSession): MatchEvent[] {
  let previous: MatchEvent | undefined;
  return match.events.map((event) => {
    if (event.eventType === "SANCTION") return event;
    let attributed = event;
    if (
      event.eventType === "REBOUND_REGAINED" &&
      event.isPossessionFlipped &&
      !event.possessionBeforeTeamId
    ) {
      const before =
        event.attackingTeamId ??
        (event.attackingTeamName === match.homeTeam.name ? "home" : "away");
      const attacker = otherTeam(before);
      attributed = {
        ...event,
        possessionBeforeTeamId: before,
        attackingTeamId: attacker,
        attackingTeamName: teamOf(match, attacker).name,
        defendingTeamName: teamOf(match, before).name,
        defenseSystem:
          previous?.period === event.period &&
          previous.attackingTeamName === teamOf(match, attacker).name
            ? previous.defenseSystem
            : teamOf(match, before).currentDefense,
      };
    }
    previous = attributed;
    return attributed;
  });
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
