import { describe, expect, it } from "vitest";
import {
  gameSeconds,
  logEvent,
  newMatch,
  score,
  stopClock,
} from "./matchEngine";
describe("possession engine", () => {
  it.each([
    "GOAL",
    "GK_SAVE",
    "SHOT_OUT",
    "STEAL",
    "TECHNICAL_FAULT",
    "POSSESSION_SWITCH",
  ] as const)("%s snapshots tactics before flipping", (type) => {
    const match = newMatch();
    match.attackPhase = "COUNTERATTACK_ATTEMPTED";
    match.awayTeam.currentDefense = "5:1";
    const next = logEvent(
      match,
      type,
      type === "TECHNICAL_FAULT" ? { subType: "BAD_PASS" } : {},
    );
    expect(next.currentAttackingTeamId).toBe("away");
    expect(next.currentPossessionIndex).toBe(2);
    expect(next.attackPhase).toBe("STATIC");
    expect(next.events[0]).toMatchObject({
      attackingTeamName: "Home",
      defendingTeamName: "Away",
      defenseSystem: "5:1",
      attackPhase: "COUNTERATTACK_ATTEMPTED",
      possessionIndex: 1,
      isPossessionFlipped: true,
    });
    expect(score(next, "home")).toBe(type === "GOAL" ? 1 : 0);
    expect(match.events).toHaveLength(0);
  });
  it.each([
    "REBOUND_REGAINED",
    "SHOT_BLOCKED",
    "PENALTY_7M",
    "SANCTION",
  ] as const)("%s retains possession and phase", (type) => {
    const match = { ...newMatch(), attackPhase: "COUNTERATTACK" as const };
    const next = logEvent(match, type);
    expect(next.currentAttackingTeamId).toBe("home");
    expect(next.currentPossessionIndex).toBe(1);
    expect(next.attackPhase).toBe("COUNTERATTACK");
    expect(next.events[0].isPossessionFlipped).toBe(false);
  });
  it("restores each team defense through repeated flips", () => {
    const match = newMatch();
    match.homeTeam.currentDefense = "3:2:1";
    match.awayTeam.currentDefense = "5:1";
    const next = logEvent(
      logEvent(logEvent(match, "GOAL"), "STEAL"),
      "GK_SAVE",
    );
    expect(next.events.map((e) => e.defenseSystem)).toEqual([
      "5:1",
      "3:2:1",
      "5:1",
    ]);
  });
  it("uses elapsed wall time across suspension and reload", () => {
    const match = { ...newMatch(), gameTimeSeconds: 120, clockStartedAt: 1000 };
    expect(gameSeconds(match, 62000)).toBe(181);
    expect(gameSeconds(stopClock(match, 62000), 999999)).toBe(181);
  });
});
