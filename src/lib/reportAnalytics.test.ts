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
  it("records cumulative scores at completed five-minute checkpoints, including exact-boundary goals", () => {
    let match = logEvent({ ...newMatch(), gameTimeSeconds: 299 }, "GOAL");
    match = logEvent({ ...match, gameTimeSeconds: 300 }, "GOAL");
    match = logEvent({ ...match, gameTimeSeconds: 301 }, "GOAL");
    match = logEvent({ ...match, gameTimeSeconds: 600 }, "GOAL");
    match = { ...match, period: 2, gameTimeSeconds: 970 };
    const expected = [
      { gameTimeSeconds: 300, homeScore: 1, awayScore: 1 },
      { gameTimeSeconds: 600, homeScore: 2, awayScore: 2 },
      { gameTimeSeconds: 900, homeScore: 2, awayScore: 2 },
    ];
    expect(buildReport(match).scoreCheckpoints).toEqual(expected);
    expect(buildReport(match, 2).scoreCheckpoints).toEqual(expected);
  });
  it("does not invent five-minute checkpoints before the match reaches them", () => {
    expect(buildReport(newMatch()).scoreCheckpoints).toEqual([]);
    expect(
      buildReport({ ...newMatch(), gameTimeSeconds: 299 }).scoreCheckpoints,
    ).toEqual([]);
    expect(
      buildReport({ ...newMatch(), gameTimeSeconds: 300 }).scoreCheckpoints,
    ).toEqual([{ gameTimeSeconds: 300, homeScore: 0, awayScore: 0 }]);
  });
  it("uses recorded goal times even when the clock was corrected backwards or events are out of order", () => {
    let match = logEvent({ ...newMatch(), gameTimeSeconds: 600 }, "GOAL");
    match = logEvent({ ...match, gameTimeSeconds: 300 }, "GOAL");
    match.gameTimeSeconds = 250;
    expect(buildReport(match).scoreCheckpoints).toEqual([
      { gameTimeSeconds: 300, homeScore: 0, awayScore: 1 },
      { gameTimeSeconds: 600, homeScore: 1, awayScore: 1 },
    ]);
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
      turnovers: 1,
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
  it.each(["GK_SAVE", "SHOT_BLOCKED", "SHOT_OUT"] as const)(
    "keeps a manually restored %s rebound and penalty in the original possession",
    (type) => {
      let match = logEvent(newMatch(), type);
      match = logEvent(match, "POSSESSION_SWITCH");
      match = logEvent(match, "PENALTY_7M");
      match = logEvent(match, "PENALTY_7M");
      match = logEvent(match, "GOAL");
      const report = buildReport(match);
      expect(report.possessions).toHaveLength(1);
      expect(report.possessions[0].tagIndices).toEqual([1, 2, 3]);
      expect(report.teams.home).toMatchObject({
        possessions: 1,
        goals: 1,
        shots: 2,
        pending: 0,
      });
      expect(report.teams.away.possessions).toBe(0);
    },
  );
  it("does not merge a rebound across a period boundary or an opponent action", () => {
    let match = logEvent(newMatch(), "SHOT_OUT");
    match = logEvent({ ...match, period: 2 }, "POSSESSION_SWITCH");
    match = logEvent(match, "GOAL");
    expect(buildReport(match).teams.home.possessions).toBe(2);

    match = logEvent(newMatch(), "SHOT_OUT");
    match = logEvent(match, "PENALTY_7M");
    match = logEvent(match, "POSSESSION_SWITCH");
    match = logEvent(match, "GOAL");
    expect(buildReport(match).teams.home.possessions).toBe(2);
  });
  it("keeps repeated rebounds, a penalty and a goal within one possession", () => {
    let match = newMatch();
    for (const type of [
      "SHOT_OUT",
      "REBOUND_REGAINED",
      "GK_SAVE",
      "REBOUND_REGAINED",
      "PENALTY_7M",
      "GOAL",
    ] as const)
      match = logEvent(match, type);
    const report = buildReport(match);
    expect(report.possessions).toHaveLength(1);
    expect(report.teams.home).toMatchObject({
      possessions: 1,
      goals: 1,
      shots: 3,
    });
    expect(report.teams.away.possessions).toBe(0);
  });
  it("cancels a manual rebound correction when possession is switched away again", () => {
    let match = logEvent(newMatch(), "SHOT_OUT");
    match = logEvent(match, "POSSESSION_SWITCH");
    expect(buildReport(match).teams.home).toMatchObject({
      possessions: 0,
      pending: 1,
    });
    match = logEvent(match, "POSSESSION_SWITCH");
    match = logEvent(match, "GOAL");
    expect(buildReport(match).teams.home).toMatchObject({
      possessions: 1,
      pending: 0,
    });
    expect(buildReport(match).teams.away.possessions).toBe(1);
  });
  it("includes counter-goals once in overall counterattacks and separates their origin", () => {
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
      counterattacks: { GOAL: { attempts: 1, goals: 1 } },
    });
    expect(teams.away.counterAttack.value).toBe(50);
    expect(teams.home).toMatchObject({
      caAttempts: 1,
      caAborted: 1,
      caFinished: 0,
      counterattacks: { GOAL: { attempts: 1 } },
    });
  });
  it.each([
    ["STEAL", "RECOVERY"],
    ["SHOT_OUT", "RECOVERY"],
    ["SHOT_BLOCKED", "RECOVERY"],
    ["GK_SAVE", "KEEPER_SAVE"],
    ["GOAL", "GOAL"],
    ["TECHNICAL_FAULT", "TECHNICAL_FAULT"],
  ] as const)("classifies a counterattack after %s as %s", (type, origin) => {
    let match = logEvent(
      newMatch(),
      type,
      type === "TECHNICAL_FAULT" ? { subType: "BAD_PASS" } : {},
    );
    match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "GOAL");
    const stats = buildReport(match).teams.away;
    expect(stats.counterattacks[origin]).toMatchObject({
      attempts: 1,
      finished: 1,
      goals: 1,
    });
    expect(
      Object.values(stats.counterattacks).reduce(
        (total, group) => total + group.attempts,
        0,
      ),
    ).toBe(stats.caAttempts);
    expect(stats.counterAttack.value).toBe(100);
    expect(buildReport(match).possessions[1].origin).toBe(origin);
  });
  it("preserves the attack origin through an attacking rebound and period filtering", () => {
    let match = logEvent(newMatch(), "GK_SAVE");
    match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "SHOT_OUT");
    match = logEvent(match, "REBOUND_REGAINED");
    match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "GOAL");
    const report = buildReport(match, 1);
    expect(report.teams.away.counterattacks.KEEPER_SAVE).toMatchObject({
      attempts: 1,
      finished: 1,
      goals: 1,
    });
    expect(report.teams.away.caAttempts).toBe(1);
  });
  it("reconciles attacking outcomes without adding defensive recoveries to losses", () => {
    let match = logEvent(newMatch(), "SHOT_OUT");
    match = logEvent(match, "REBOUND_REGAINED");
    match = logEvent(match, "GOAL");
    match = logEvent(match, "STEAL");
    match = logEvent(match, "TECHNICAL_FAULT", { subType: "BAD_PASS" });
    match = logEvent(match, "GOAL");
    match = logEvent(match, "STEAL");
    match = logEvent(match, "GOAL");
    const home = buildReport(match).teams.home;
    expect(home).toMatchObject({
      possessions: 3,
      shots: 2,
      shotPossessions: 1,
      steals: 1,
      lostBalls: 1,
      technicalFaults: 1,
      turnovers: 2,
    });
    // Home has three possessions here: one shot-ending, two loss-ending.
    expect(home.possessions).toBe(home.shotPossessions + home.turnovers);
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
    match.events.push({
      ...rebound,
      attackingTeamId: "home",
      attackingTeamName: "Home",
      defendingTeamName: "Away",
      possessionBeforeTeamId: undefined,
      isPossessionFlipped: false,
    });
    match = logEvent(match, "GOAL");
    expect(buildReport(match).teams.home).toMatchObject({
      possessions: 1,
      goals: 1,
      shots: 2,
    });
  });
  it("does not infer a counterattack origin across a manual possession correction", () => {
    let match = logEvent(newMatch(), "GOAL");
    match = logEvent(logEvent(match, "POSSESSION_SWITCH"), "POSSESSION_SWITCH");
    match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "GOAL");
    expect(buildReport(match).teams.away).toMatchObject({
      caGoals: 1,
      counterattacks: {
        UNKNOWN: { attempts: 1, goals: 1 },
        GOAL: { attempts: 0 },
      },
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
    expect(report.teams.home.counterattacks.GOAL.attempts).toBe(0);
    expect(report.teams.home.goals).toBe(1);
    expect(report.possessions[0]).toMatchObject({
      number: 5,
      homeScore: 3,
      awayScore: 2,
      defenses: { home: null, away: "5:1" },
    });
  });
});
