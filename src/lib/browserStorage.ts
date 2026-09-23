import Dexie, { type Table } from 'dexie';
import type { MatchSession } from '../types/match';
class MatchDatabase extends Dexie {
  matches!: Table<MatchSession, string>;
  settings!: Table<{ key: string; value: string }, string>;
  constructor() { super('ohm.library.v1'); this.version(1).stores({ matches: 'id, date', settings: 'key' }); }
}
export const db = new MatchDatabase();
export async function saveMatch(match: MatchSession) {
  await db.transaction('rw', db.matches, db.settings, async () => {
    await db.matches.put(match);
    await db.settings.put({ key: 'activeMatch', value: match.id });
  });
}
export async function loadActiveMatch() {
  const active = await db.settings.get('activeMatch');
  return active ? db.matches.get(active.value) : undefined;
}
