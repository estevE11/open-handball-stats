import { describe, expect, it } from "vitest";
import { newMatch, logEvent } from "./matchEngine";
import {
  buildReport,
  defenseBands,
  reconstructPossessions,
} from "./reportAnalytics";

describe("match analysis", () => {
  it("returns unavailable percentages for an empty match", () => {
    const report = buildReport(newMatch());
    expect(report.possessions).toEqual([]);
    expect(report.teams.home.attack.value).toBeNull();
    expect(report.teams.away.keeper.value).toBeNull();
  });
  it("counts mirrored shooting, defense, keeper and turnover metrics", () => {
    let match = newMatch();
    for (const type of [
      "GOAL",
      "GK_SAVE",
      "SHOT_OUT",
      "STEAL",
      "TECHNICAL_FAULT",
      "SHOT_BLOCKED",
    ] as const)
      match = logEvent(
        match,
        type,
        type === "TECHNICAL_FAULT" ? { subType: "BAD_PASS" } : {},
      );
    const { teams } = buildReport(match);
    expect(teams.home).toMatchObject({
      goals: 1,
      possessions: 3,
      shots: 2,
      steals: 1,
      lostBalls: 0,
      technicalFaults: 1,
      turnovers: 2,
    });
    expect(teams.away).toMatchObject({
      goals: 0,
      possessions: 3,
      shots: 2,
      steals: 0,
      lostBalls: 1,
      technicalFaults: 0,
      turnovers: 1,
    });
    expect(teams.home.attack.value).toBeCloseTo(100 / 3);
    expect(teams.home.defense.value).toBe(100);
    expect(teams.away.defense.value).toBeCloseTo(200 / 3);
    expect(teams.home.keeper.value).toBe(100);
    expect(teams.away.keeperConceded.value).toBe(100);
  });
  it.each(["GK_SAVE", "SHOT_BLOCKED", "SHOT_OUT"] as const)(
    "merges %s and rebound into one attack but preserves both shots",
    (type) => {
      let match = logEvent(newMatch(), type);
      match = logEvent(match, "SANCTION", {
        subType: "YELLOW",
        sanctionTeamId: "away",
      });
      match = logEvent(match, "REBOUND_REGAINED");
      expect(buildReport(match).teams.home).toMatchObject({
        possessions: 0,
        pending: 1,
        shots: 1,
      });
      match = logEvent(match, "GOAL");
      const report = buildReport(match);
      expect(report.possessions).toHaveLength(1);
      expect(report.possessions[0].tagIndices).toEqual([1, 2, 3]);
      expect(report.teams.home).toMatchObject({
        goals: 1,
        possessions: 1,
        shots: 2,
      });
      expect(report.teams.home.attack.value).toBe(100);
      expect(report.teams.home.shooting.value).toBe(50);
    },
  );
  it("separates launched, finished, aborted and counter-goal transitions", () => {
    let match = logEvent(newMatch(), "GOAL");
    match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "GOAL");
    match = logEvent(
      { ...match, attackPhase: "COUNTERATTACK_ATTEMPTED" },
      "TECHNICAL_FAULT",
      { subType: "TRAVELING" },
    );
    match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "SHOT_OUT");
    const { teams } = buildReport(match);
    expect(teams.away).toMatchObject({
      caAttempts: 2,
      caFinished: 2,
      caGoals: 1,
      counterGoalAttempts: 1,
      counterGoals: 1,
    });
    expect(teams.away.counterAttack.value).toBe(50);
    expect(teams.home).toMatchObject({
      caAttempts: 1,
      caAborted: 1,
      caFinished: 0,
      counterGoalAttempts: 1,
    });
  });
  it("ignores administrative switches, incomplete attacks and sanctions in efficiency denominators", () => {
    let match = logEvent(newMatch(), "POSSESSION_SWITCH");
    match = logEvent(match, "PENALTY_7M");
    match = logEvent(match, "SANCTION", {
      subType: "YELLOW",
      sanctionTeamId: "home",
    });
    const report = buildReport(match);
    expect(report.teams.away).toMatchObject({ possessions: 0, pending: 1 });
    expect(report.teams.home.defense.value).toBeNull();
  });
  it("preserves legacy retained rebounds and blocks", () => {
    let match = logEvent(newMatch(), "SHOT_BLOCKED");
    match.events[0].isPossessionFlipped = false;
    match.currentAttackingTeamId = "home";
    match.currentPossessionIndex = 1;
    const rebound = logEvent(match, "REBOUND_REGAINED").events.at(-1)!;
    match.events.push({ ...rebound, isPossessionFlipped: false });
    match = logEvent(match, "GOAL");
    expect(buildReport(match).teams.home).toMatchObject({
      possessions: 1,
      goals: 1,
      shots: 2,
    });
  });
  it("keeps score cumulative across period filters, resets unknown defenses and merges equal bands", () => {
    let match = newMatch();
    match.awayTeam.currentDefense = "5:1";
    for (let n = 0; n < 4; n++) match = logEvent(match, "GOAL");
    match = logEvent(
      { ...match, period: 2, attackPhase: "COUNTERATTACK" },
      "GOAL",
    );
    const all = reconstructPossessions(match);
    expect(defenseBands(all, "away")).toEqual([
      { system: "5:1", start: 0, end: 3 },
      { system: "5:1", start: 4, end: 4 },
    ]);
    const report = buildReport(match, 2);
    expect(report.teams.home.counterGoalAttempts).toBe(0);
    expect(report.teams.home.goals).toBe(1);
    expect(report.possessions[0]).toMatchObject({
      number: 5,
      homeScore: 3,
      awayScore: 2,
      defenses: { home: null, away: "5:1" },
    });
  });
});
