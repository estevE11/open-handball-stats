import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  db,
  loadActiveMatch,
  loadMatchHistory,
  saveMatch,
} from "../lib/browserStorage";
import { newMatch, score, logEvent } from "../lib/matchEngine";
import { flushSaves, useMatchStore } from "./matchStore";
const state = () => useMatchStore.getState();
beforeEach(async () => {
  await flushSaves();
  await db.matches.clear();
  await db.settings.clear();
  useMatchStore.setState({
    match: newMatch(),
    history: [],
    ready: true,
    saveStatus: "saved",
  });
});
describe("store and IndexedDB", () => {
  it("period undo restores the time at transition, not time spent paused", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    state().toggleClock();
    now.mockReturnValue(61000);
    state().nextPeriod();
    now.mockReturnValue(121000);
    state().undo();
    expect(state().match.gameTimeSeconds).toBe(60);
    expect(state().match.clockStartedAt).toBeNull();
    expect(state().match.period).toBe(1);
    now.mockRestore();
  });

  it("undo restores score, possession and phase atomically, then persists", async () => {
    state().setPhase("COUNTERATTACK");
    state().setDefense("4:2");
    state().log("GOAL");
    expect(score(state().match, "home")).toBe(1);
    state().undo();
    expect(state().match).toMatchObject({
      currentAttackingTeamId: "home",
      currentPossessionIndex: 1,
      attackPhase: "COUNTERATTACK",
    });
    expect(score(state().match, "home")).toBe(0);
    expect(state().match.awayTeam.currentDefense).toBe("4:2");
    await flushSaves();
    expect(await loadActiveMatch()).toEqual(state().match);
  });
  it("serializes rapid tags and stores the final state", async () => {
    for (let i = 0; i < 30; i++) state().log("GOAL");
    await flushSaves();
    const saved = await loadActiveMatch();
    expect(saved?.events).toHaveLength(30);
    expect(saved?.currentPossessionIndex).toBe(31);
    expect(state().saveStatus).toBe("saved");
  });
  it("preserves in-memory data on quota failure and can retry", async () => {
    const put = vi
      .spyOn(db.matches, "put")
      .mockRejectedValueOnce(new Error("QuotaExceededError"));
    state().log("GOAL");
    await flushSaves();
    expect(state().saveStatus).toBe("error");
    expect(state().match.events).toHaveLength(1);
    put.mockRestore();
    state().retry();
    await flushSaves();
    expect(state().saveStatus).toBe("saved");
    expect((await loadActiveMatch())?.events).toHaveLength(1);
  });
  it("undoing a tag never rewinds a running clock", () => {
    state().toggleClock();
    const anchor = state().match.clockStartedAt;
    state().log("GOAL");
    state().undo();
    expect(state().match.clockStartedAt).toBe(anchor);
  });
  it("retains previous matches when creating a new one", async () => {
    state().log("GOAL");
    await flushSaves();
    const id = state().match.id;
    state().replace(newMatch("A", "B"));
    await flushSaves();
    expect((await db.matches.get(id))?.events).toHaveLength(1);
    expect(await db.matches.count()).toBe(2);
  });
});

describe("persistent undo", () => {
  it("restores saved actions, notes and tactics without copying the event list", async () => {
    state().setPhase("COUNTERATTACK");
    state().setDefense("5:1");
    state().log("GOAL");
    const id = state().match.events[0].id;
    state().editNote(id, "first");
    state().editNote(id, "second");
    await flushSaves();
    const saved = (await loadActiveMatch())!;
    const history = await loadMatchHistory(saved);
    expect(history).toHaveLength(5);
    expect(history.every((entry) => !("events" in entry.before))).toBe(true);
    state().replace(saved, history);
    state().undo();
    expect(state().match.events[0].notes).toBe("first");
    state().undo();
    expect(state().match.events[0].notes).toBeUndefined();
    state().undo();
    expect(score(state().match, "home")).toBe(0);
    expect(state().match).toMatchObject({
      currentAttackingTeamId: "home",
      currentPossessionIndex: 1,
      attackPhase: "COUNTERATTACK",
    });
    expect(state().match.awayTeam.currentDefense).toBe("5:1");
    await flushSaves();
    expect(await loadMatchHistory(state().match)).toHaveLength(2);
  });
  it("keeps saved match and undo history atomic on a journal-write failure", async () => {
    state().log("GOAL");
    await flushSaves();
    const prior = (await loadActiveMatch())!;
    const put = vi
      .spyOn(db.settings, "put")
      .mockRejectedValueOnce(new Error("QuotaExceededError"));
    state().log("STEAL");
    await flushSaves();
    expect(state().saveStatus).toBe("error");
    expect(await loadActiveMatch()).toEqual(prior);
    expect(await loadMatchHistory(prior)).toHaveLength(1);
    put.mockRestore();
    state().retry();
    await flushSaves();
    expect(await loadMatchHistory(state().match)).toHaveLength(2);
  });
  it.each([
    "GOAL",
    "REBOUND_REGAINED",
    "SANCTION",
    "POSSESSION_SWITCH",
  ] as const)(
    "removes a legacy %s event when no history exists",
    async (type) => {
      const original = { ...newMatch(), attackPhase: "COUNTERATTACK" as const };
      original.awayTeam.currentDefense = "4:2";
      const match = logEvent(
        original,
        type,
        type === "SANCTION"
          ? { subType: "YELLOW", sanctionTeamId: "away" }
          : {},
      );
      await saveMatch(match);
      state().replace(match, await loadMatchHistory(match));
      state().undo();
      expect(state().match).toEqual(original);
      await flushSaves();
      expect((await loadActiveMatch())?.events).toHaveLength(0);
    },
  );
  it("rejects malformed or foreign history while keeping the match usable", async () => {
    state().log("GOAL");
    await flushSaves();
    const key = `undo:${state().match.id}`;
    await db.settings.put({ key, value: "broken json" });
    expect(await loadMatchHistory(state().match)).toEqual([]);
    const foreign = {
      ...state().history[0],
      before: { ...state().history[0].before, id: "another-match" },
    };
    await db.settings.put({ key, value: JSON.stringify([foreign]) });
    expect(await loadMatchHistory(state().match)).toEqual([]);
  });
  it("caps the journal at 50 actions and preserves each match separately", async () => {
    for (let i = 0; i < 55; i++) state().log("GOAL");
    await flushSaves();
    const first = state().match;
    expect(await loadMatchHistory(first)).toHaveLength(50);
    state().replace(newMatch("A", "B"));
    state().setDefense("3:3");
    await flushSaves();
    expect(await loadMatchHistory(state().match)).toHaveLength(1);
    expect(await loadMatchHistory(first)).toHaveLength(50);
  });
});
