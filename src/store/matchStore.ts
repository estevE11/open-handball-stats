import { create } from 'zustand';
import { loadActiveMatch, saveMatch } from '../lib/browserStorage';
import { gameSeconds, logEvent, newMatch, otherTeam, stopClock } from '../lib/matchEngine';
import { matchSchema, type AttackPhase, type DefenseSystem, type EventType, type MatchEvent, type MatchSession } from '../types/match';

type SaveStatus = 'loading' | 'saving' | 'saved' | 'error';
type HistoryEntry = { match: MatchSession; restoreClock: boolean };
interface MatchStore {
  match: MatchSession; history: HistoryEntry[]; ready: boolean; saveStatus: SaveStatus;
  initialize: () => Promise<void>; replace: (match: MatchSession) => void;
  log: (event: EventType, details?: Pick<MatchEvent, 'subType' | 'sanctionTeamId' | 'notes'>) => void;
  setPhase: (phase: AttackPhase) => void; setDefense: (defense: DefenseSystem) => void;
  editNote: (id: string, notes: string) => void; switchPossession: () => void; undo: () => void; toggleClock: () => void;
  nextPeriod: () => void; setTime: (seconds: number) => void; retry: () => void;
}
let saves: Promise<void> = Promise.resolve();
let revision = 0;
export const flushSaves = () => saves;
function persist(match: MatchSession) {
  const current = ++revision;
  useMatchStore.setState({ saveStatus: 'saving' });
  saves = saves.then(() => saveMatch(match)).then(() => {
    if (current === revision) useMatchStore.setState({ saveStatus: 'saved' });
  }).catch(() => { if (current === revision) useMatchStore.setState({ saveStatus: 'error' }); });
}
function change(match: MatchSession, remember = true, restoreClock = false) {
  const state = useMatchStore.getState();
  if (!state.ready) return;
  useMatchStore.setState({ match, history: remember ? [...state.history.slice(-49), { match: state.match, restoreClock }] : state.history });
  persist(match);
}
let initialization: Promise<void> | undefined;
export const useMatchStore = create<MatchStore>((set, get) => ({
  match: newMatch(), history: [], ready: false, saveStatus: 'loading',
  initialize: () => initialization ??= (async () => {
    try {
      const loaded = await loadActiveMatch();
      const match = loaded ? matchSchema.parse(loaded) : get().match;
      set({ match, ready: true, saveStatus: 'saved' });
      if (!loaded) persist(match);
    } catch { set({ ready: true, saveStatus: 'error' }); }
  })(),
  replace: match => { set({ match, history: [] }); persist(match); },
  log: (event, details) => change(logEvent(get().match, event, details)),
  setPhase: attackPhase => { if (get().match.attackPhase !== attackPhase) change({ ...get().match, attackPhase }); },
  setDefense: currentDefense => {
    const match = get().match;
    const key = otherTeam(match.currentAttackingTeamId) === 'home' ? 'homeTeam' : 'awayTeam';
    if (match[key].currentDefense !== currentDefense) change({ ...match, [key]: { ...match[key], currentDefense } });
  },
  editNote: (id, notes) => change({ ...get().match, events: get().match.events.map(e => e.id === id ? { ...e, notes: notes.slice(0, 2000) } : e) }),
  switchPossession: () => get().log('POSSESSION_SWITCH'),
  undo: () => {
    const { history, match: current } = get();
    const last = history.at(-1); if (!last) return;
    const match = last.restoreClock ? stopClock(last.match) : { ...last.match, gameTimeSeconds: current.gameTimeSeconds, clockStartedAt: current.clockStartedAt };
    set({ match, history: history.slice(0, -1) }); persist(match);
  },
  toggleClock: () => {
    const match = get().match;
    change(match.clockStartedAt === null ? { ...match, clockStartedAt: Date.now() } : stopClock(match), false);
  },
  nextPeriod: () => {
    const match = get().match; if (match.period >= 20) return;
    change({ ...stopClock(match), period: match.period + 1, attackPhase: 'STATIC' }, true, true);
  },
  setTime: seconds => {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 604800) return;
    change({ ...get().match, gameTimeSeconds: seconds, clockStartedAt: null }, true, true);
  },
  retry: () => persist(get().match),
}));
// The wall-clock anchor survives refresh and background throttling; no per-second writes.
export const currentSeconds = () => gameSeconds(useMatchStore.getState().match);
