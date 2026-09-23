import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, loadActiveMatch } from '../lib/browserStorage';
import { newMatch, score } from '../lib/matchEngine';
import { flushSaves, useMatchStore } from './matchStore';
const state = () => useMatchStore.getState();
beforeEach(async () => { await flushSaves(); await db.matches.clear(); await db.settings.clear(); useMatchStore.setState({ match: newMatch(), history: [], ready: true, saveStatus: 'saved' }); });
describe('store and IndexedDB', () => {
  it('undo restores score, possession and phase atomically, then persists', async () => {
    state().setPhase('COUNTERATTACK'); state().setDefense('4:2'); state().log('GOAL');
    expect(score(state().match, 'home')).toBe(1); state().undo();
    expect(state().match).toMatchObject({ currentAttackingTeamId: 'home', currentPossessionIndex: 1, attackPhase: 'COUNTERATTACK' });
    expect(score(state().match, 'home')).toBe(0); expect(state().match.awayTeam.currentDefense).toBe('4:2');
    await flushSaves(); expect(await loadActiveMatch()).toEqual(state().match);
  });
  it('serializes rapid tags and stores the final state', async () => {
    for (let i = 0; i < 30; i++) state().log('GOAL');
    await flushSaves(); const saved = await loadActiveMatch(); expect(saved?.events).toHaveLength(30); expect(saved?.currentPossessionIndex).toBe(31); expect(state().saveStatus).toBe('saved');
  });
  it('preserves in-memory data on quota failure and can retry', async () => {
    const put = vi.spyOn(db.matches, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
    state().log('GOAL'); await flushSaves(); expect(state().saveStatus).toBe('error'); expect(state().match.events).toHaveLength(1);
    put.mockRestore(); state().retry(); await flushSaves(); expect(state().saveStatus).toBe('saved'); expect((await loadActiveMatch())?.events).toHaveLength(1);
  });
  it('undoing a tag never rewinds a running clock', () => {
    state().toggleClock(); const anchor = state().match.clockStartedAt; state().log('GOAL'); state().undo(); expect(state().match.clockStartedAt).toBe(anchor);
  });
  it('retains previous matches when creating a new one', async () => {
    state().log('GOAL'); await flushSaves(); const id = state().match.id;
    state().replace(newMatch('A', 'B')); await flushSaves(); expect((await db.matches.get(id))?.events).toHaveLength(1); expect(await db.matches.count()).toBe(2);
  });
});
