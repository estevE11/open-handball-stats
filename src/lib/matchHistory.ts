import { z } from "zod";
import {
  eventSchema,
  matchSchema,
  type MatchEvent,
  type MatchSession,
} from "../types/match";
import { otherTeam, stopClock } from "./matchEngine";

// Store the pre-action metadata and at most one edited event, never 50 event lists.
export interface HistoryEntry {
  before: Omit<MatchSession, "events">;
  eventCount: number;
  editedEvent?: MatchEvent;
  restoreClock: boolean;
}
export function historyEntry(
  match: MatchSession,
  restoreClock: boolean,
  editedEvent?: MatchEvent,
): HistoryEntry {
  const snapshot = restoreClock ? stopClock(match) : match;
  const { events, ...before } = snapshot;
  return { before, eventCount: events.length, editedEvent, restoreClock };
}
export function restoreHistory(
  match: MatchSession,
  entry: HistoryEntry,
): MatchSession {
  const events = match.events
    .slice(0, entry.eventCount)
    .map((event) =>
      entry.editedEvent?.id === event.id ? entry.editedEvent : event,
    );
  return {
    ...entry.before,
    events,
    ...(entry.restoreClock
      ? {}
      : {
          gameTimeSeconds: match.gameTimeSeconds,
          clockStartedAt: match.clockStartedAt,
        }),
  };
}
const journalSchema = z
  .array(
    z.object({
      before: z.record(z.string(), z.unknown()),
      eventCount: z.number().int().min(0).max(100000),
      editedEvent: eventSchema.optional(),
      restoreClock: z.boolean(),
    }),
  )
  .max(50);
export function parseHistory(
  source: string | undefined,
  match: MatchSession,
): HistoryEntry[] {
  if (!source) return [];
  try {
    const history = journalSchema.parse(JSON.parse(source)).map((entry) => {
      const before = historyEntry(
        matchSchema.parse({ ...entry.before, events: [] }),
        false,
      ).before;
      return { ...entry, before };
    });
    let cursor = match;
    for (const entry of [...history].reverse()) {
      if (
        entry.before.id !== match.id ||
        entry.eventCount > cursor.events.length ||
        (entry.editedEvent &&
          !cursor.events
            .slice(0, entry.eventCount)
            .some((event) => event.id === entry.editedEvent?.id))
      )
        return [];
      cursor = matchSchema.parse(restoreHistory(cursor, entry));
    }
    return history;
  } catch {
    return [];
  } // A damaged journal must never prevent opening the match.
}
export function undoLastEvent(match: MatchSession): MatchSession {
  const last = match.events.at(-1);
  if (!last) return match;
  const attacker =
    last.attackingTeamId ??
    (last.attackingTeamName === match.homeTeam.name ? "home" : "away");
  const defenderKey = otherTeam(attacker) === "home" ? "homeTeam" : "awayTeam";
  return {
    ...match,
    events: match.events.slice(0, -1),
    currentAttackingTeamId: attacker,
    currentPossessionIndex: last.possessionIndex,
    attackPhase: last.attackPhase,
    [defenderKey]: {
      ...match[defenderKey],
      currentDefense: last.defenseSystem,
    },
  };
}
