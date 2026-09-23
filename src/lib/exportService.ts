import { matchSchema, type MatchSession } from '../types/match';
import { stopClock } from './matchEngine';
const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  // Prevent formula execution when opening user-authored names/notes in spreadsheets.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const xml = (value: unknown) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export function exportCSV(match: MatchSession): string {
  const header = ['id', 'match_id', 'possession_index', 'period', 'game_time_seconds', 'timestamp', 'attacking_team', 'defending_team', 'attack_phase', 'defense_system', 'event_type', 'sub_type', 'is_possession_flipped', 'sanction_team', 'notes'];
  return '\ufeff' + [header.join(','), ...match.events.map(e => [e.id, e.matchId, e.possessionIndex, e.period, e.gameTimeSeconds, new Date(e.realTimestamp).toISOString(), e.attackingTeamName, e.defendingTeamName, e.attackPhase, e.defenseSystem, e.eventType, e.subType, e.isPossessionFlipped, e.sanctionTeamId, e.notes].map(csvCell).join(','))].join('\r\n');
}
export function exportJSON(match: MatchSession): string { return JSON.stringify(stopClock(match), null, 2); }
// Sportscode interchange: categories become rows, tactical fields become descriptor labels.
// Times use the cumulative match clock; video alignment is configured at export.
export function exportXML(match: MatchSession, offsetSeconds = 0): string {
  if (!Number.isFinite(offsetSeconds)) throw new Error('Invalid video offset');
  const codes = [...new Set(match.events.map(e => `${e.attackingTeamName} · ${e.eventType}`))];
  const instances = match.events.map((e, i) => {
    const time = Math.max(0, e.gameTimeSeconds + offsetSeconds);
    const labels = { possession_index: e.possessionIndex, period: e.period, attacking_team: e.attackingTeamName, defending_team: e.defendingTeamName, attack_phase: e.attackPhase, defense_system: e.defenseSystem, event_type: e.eventType, sub_type: e.subType ?? '', is_possession_flipped: e.isPossessionFlipped, timestamp: new Date(e.realTimestamp).toISOString(), sanction_team: e.sanctionTeamId ?? '', notes: e.notes ?? '', event_id: e.id, match_id: e.matchId };
    return `    <instance><ID>${i + 1}</ID><start>${Math.max(0, time - 5).toFixed(3)}</start><end>${(time + 3).toFixed(3)}</end><code>${xml(`${e.attackingTeamName} · ${e.eventType}`)}</code>${Object.entries(labels).map(([group, text]) => `<label><group>${group}</group><text>${xml(text)}</text></label>`).join('')}</instance>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<file>\n  <ALL_INSTANCES>\n${instances.join('\n')}\n  </ALL_INSTANCES>\n  <ROWS>\n${codes.map(code => `    <row><code>${xml(code)}</code><R>22000</R><G>32000</G><B>26000</B></row>`).join('\n')}\n  </ROWS>\n</file>\n`;
}
export function importJSON(source: string): MatchSession {
  if (new TextEncoder().encode(source).length > 20 * 1024 * 1024) throw new Error('File exceeds 20 MB');
  const match = matchSchema.parse(JSON.parse(source));
  const id = crypto.randomUUID();
  // A portable snapshot never resumes a remote running clock or overwrites a local match.
  return { ...match, id, clockStartedAt: null, events: match.events.map(e => ({ ...e, id: crypto.randomUUID(), matchId: id })) };
}
export function downloadMatch(match: MatchSession, format: 'csv' | 'json' | 'xml', offset = 0) {
  const contents = { csv: () => exportCSV(match), json: () => exportJSON(match), xml: () => exportXML(match, offset) }[format]();
  const mime = { csv: 'text/csv;charset=utf-8', json: 'application/json', xml: 'application/xml' }[format];
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a'); link.href = url;
  link.download = `${match.matchName.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'match'}.${format}`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
