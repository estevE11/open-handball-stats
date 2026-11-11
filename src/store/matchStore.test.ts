import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  db,
  loadActiveMatch,
  loadMatchHistory,
  saveMatch,
} from "../lib/browserStorage";
import { newMatch, score, logEvent } from "../lib/matchEngine";
import { currentSeconds, flushSaves, useMatchStore } from "./matchStore";
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
  it.each(["REBOUND_REGAINED", "SHOT_BLOCKED"] as const)(
    "loads legacy %s events and their undo journal without rewriting them",
    async (type) => {
      const original = newMatch();
      const legacy = {
        ...original,
        events: [
          {
            ...logEvent(original, type).events[0],
            attackingTeamId: "home" as const,
            attackingTeamName: "Home",
            defendingTeamName: "Away",
            possessionBeforeTeamId: undefined,
            isPossessionFlipped: false,
          },
        ],
      };
      state().replace(legacy);
      state().setPhase("COUNTERATTACK");
      await flushSaves();
      const saved = (await loadActiveMatch())!;
      expect(saved.events[0].isPossessionFlipped).toBe(false);
      const history = await loadMatchHistory(saved);
      expect(history).toHaveLength(1);
      state().replace(saved, history);
      state().undo();
      expect(state().match).toEqual(legacy);
      state().undo();
      expect(state().match).toEqual(original);
    },
  );
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

describe("automatic halftime", () => {
  it.each([25, 30])(
    "stops exactly at %i minutes after a delayed tick, saves once, then resumes in period 2",
    async (minutes) => {
      const now = vi.spyOn(Date, "now").mockReturnValue(1000);
      try {
        state().setClockSettings(minutes, true);
        state().setTime(minutes * 60 - 1);
        state().setPhase("COUNTERATTACK");
        state().toggleClock();
        now.mockReturnValue(121000);
        expect(currentSeconds()).toBe(minutes * 60);
        state().checkPeriodEnd();
        expect(state().match).toMatchObject({
          period: 1,
          gameTimeSeconds: minutes * 60,
          clockStartedAt: null,
        });
        await flushSaves();
        expect(await loadActiveMatch()).toEqual(state().match);
        const put = vi.spyOn(db.matches, "put");
        state().checkPeriodEnd();
        state().checkPeriodEnd();
        await flushSaves();
        expect(put).not.toHaveBeenCalled();
        put.mockRestore();
        state().toggleClock();
        expect(state().match).toMatchObject({
          period: 2,
          gameTimeSeconds: minutes * 60,
          attackPhase: "STATIC",
          clockStartedAt: 121000,
        });
        now.mockReturnValue(126000);
        state().log("GOAL");
        expect(state().match.events[0]).toMatchObject({
          period: 2,
          gameTimeSeconds: minutes * 60 + 5,
        });
        state().undo();
        expect(state().match.period).toBe(2);
        state().undo();
        expect(state().match).toMatchObject({
          period: 1,
          gameTimeSeconds: minutes * 60,
          clockStartedAt: null,
          attackPhase: "COUNTERATTACK",
        });
      } finally {
        now.mockRestore();
      }
    },
  );

  it("always pauses at halftime with automatic switching off, and requires manual period change", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      state().toggleClock();
      now.mockReturnValue(11000);
      state().toggleClock();
      state().toggleClock();
      expect(state().match.period).toBe(1);
      state().setClockSettings(25, false);
      now.mockReturnValue(2000000);
      state().checkPeriodEnd();
      expect(state().match.clockStartedAt).toBeNull();
      expect(currentSeconds()).toBe(1500);
      state().toggleClock();
      expect(state().match).toMatchObject({ period: 1, clockStartedAt: null });
      state().nextPeriod();
      state().toggleClock();
      expect(state().match.period).toBe(2);
      expect(state().match.clockStartedAt).not.toBeNull();
    } finally {
      now.mockRestore();
    }
  });

  it.each([true, false])(
    "stops at full time without advancing to period 3 (automatic switching: %s)",
    (automatic) => {
      const now = vi.spyOn(Date, "now").mockReturnValue(1000);
      try {
        state().setClockSettings(25, automatic);
        state().setTime(2999);
        state().nextPeriod();
        state().toggleClock();
        now.mockReturnValue(11000);
        state().checkPeriodEnd();
        expect(state().match).toMatchObject({
          period: 2,
          gameTimeSeconds: 3000,
          clockStartedAt: null,
        });
        state().toggleClock();
        expect(state().match).toMatchObject({
          period: 2,
          clockStartedAt: null,
        });
      } finally {
        now.mockRestore();
      }
    },
  );

  it("clamps events at halftime before the UI tick and restores a late saved running clock as paused", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      state().setTime(1799);
      state().toggleClock();
      now.mockReturnValue(10000);
      state().log("GOAL");
      expect(state().match.events[0]).toMatchObject({
        period: 1,
        gameTimeSeconds: 1800,
      });
      expect(state().match.clockStartedAt).toBeNull();
      state().replace({
        ...newMatch(),
        gameTimeSeconds: 1799,
        clockStartedAt: 1000,
      });
      expect(state().match).toMatchObject({
        period: 1,
        gameTimeSeconds: 1800,
        clockStartedAt: null,
      });
    } finally {
      now.mockRestore();
    }
  });

  it("does not rewind time when enabling automation after the configured limit", async () => {
    state().setClockSettings(30, false);
    state().setTime(3300);
    state().log("GOAL");
    state().setClockSettings(25, true);
    expect(currentSeconds()).toBe(3300);
    expect(state().match.events[0].gameTimeSeconds).toBe(3300);
    state().toggleClock();
    expect(state().match.period).toBe(2);
    await flushSaves();
    expect((await loadActiveMatch())?.halfDurationMinutes).toBe(25);
    expect((await loadActiveMatch())?.automaticPeriodChange).toBe(true);
  });

  it("resumes the first half when its length is increased, and rejects invalid lengths", () => {
    state().setClockSettings(25, true);
    state().setTime(1500);
    state().setClockSettings(30, true);
    state().toggleClock();
    expect(state().match.period).toBe(1);
    const match = state().match;
    for (const minutes of [0, -1, 25.5, NaN, Infinity, 10081])
      state().setClockSettings(minutes, true);
    expect(state().match).toBe(match);
  });
});
