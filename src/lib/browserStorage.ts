import { parseHistory, type HistoryEntry } from "./matchHistory";
import Dexie, { type Table } from "dexie";
import type { MatchSession } from "../types/match";
class MatchDatabase extends Dexie {
  matches!: Table<MatchSession, string>;
  settings!: Table<{ key: string; value: string }, string>;
  constructor() {
    super("ohm.library.v1");
    this.version(1).stores({ matches: "id, date", settings: "key" });
  }
}
export const db = new MatchDatabase();
export async function saveMatch(
  match: MatchSession,
  history: HistoryEntry[] = [],
) {
  await db.transaction("rw", db.matches, db.settings, async () => {
    await db.matches.put(match);
    await db.settings.put({
      key: `undo:${match.id}`,
      value: JSON.stringify(history),
    });
    await db.settings.put({ key: "activeMatch", value: match.id });
  });
}
export async function loadActiveMatch() {
  const active = await db.settings.get("activeMatch");
  return active ? db.matches.get(active.value) : undefined;
}

export async function loadMatchHistory(match: MatchSession) {
  const saved = await db.settings.get(`undo:${match.id}`);
  return parseHistory(saved?.value, match);
}
