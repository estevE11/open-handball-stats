import { describe, expect, it } from "vitest";
import { exportCSV, exportJSON, exportXML, importJSON } from "./exportService";
import { logEvent, newMatch } from "./matchEngine";
describe("portable exports", () => {
  it("preserves blocked shots across every export format and JSON re-import", () => {
    const match = logEvent(
      { ...newMatch(), attackPhase: "COUNTERATTACK" },
      "SHOT_BLOCKED",
    );
    const restored = importJSON(exportJSON(match));
    expect(restored.events[0]).toMatchObject({
      eventType: "SHOT_BLOCKED",
      isPossessionFlipped: false,
      attackPhase: "COUNTERATTACK",
    });
    expect(restored.currentAttackingTeamId).toBe("home");
    expect(exportCSV(match)).toContain('"SHOT_BLOCKED"');
    expect(exportXML(match)).toContain("<text>SHOT_BLOCKED</text>");
  });
  it("round-trips complete match tactics with fresh identifiers", () => {
    const match = logEvent(
      {
        ...newMatch("Local", "Visitante"),
        attackPhase: "COUNTERATTACK_ATTEMPTED",
      },
      "TECHNICAL_FAULT",
      { subType: "TRAVELING", notes: "Pasos" },
    );
    const restored = importJSON(exportJSON(match));
    expect(restored.id).not.toBe(match.id);
    expect(restored.events[0].matchId).toBe(restored.id);
    expect(restored.events[0].attackPhase).toBe("COUNTERATTACK_ATTEMPTED");
    expect(restored.events[0].notes).toBe("Pasos");
    expect(restored.currentAttackingTeamId).toBe("away");
  });
  it("escapes CSV delimiters, Unicode, newlines and formulas", () => {
    const match = logEvent(newMatch("=SUM(A1)", 'Peña, "A"'), "GOAL", {
      notes: "one\ntwo",
    });
    const csv = exportCSV(match);
    expect(csv).toContain("attack_phase,defense_system");
    expect(csv).toContain('"\'=SUM(A1)"');
    expect(csv).toContain('"Peña, ""A"""');
    expect(csv).toContain('"one\ntwo"');
  });
  it("emits Sportscode instances, descriptors, rows and safe XML", () => {
    const xml = exportXML(logEvent(newMatch("A & B", "<Team>"), "GOAL"), 10);
    expect(xml).toContain("<ALL_INSTANCES>");
    expect(xml).toContain("<start>5.000</start>");
    expect(xml).toContain("<end>13.000</end>");
    expect(xml).toContain("A &amp; B");
    expect(xml).toContain("&lt;Team&gt;");
    expect(xml).toContain("<group>attack_phase</group>");
    expect(xml).toContain("<ROWS>");
  });
  it("rejects corrupt, foreign-version and inconsistent data", () => {
    expect(() => importJSON("{}")).toThrow();
    expect(() => importJSON("bad")).toThrow();
    expect(() =>
      importJSON(JSON.stringify({ ...newMatch(), schemaVersion: 2 })),
    ).toThrow();
    const match = logEvent(newMatch(), "GOAL");
    match.events[0].matchId = "another";
    expect(() => importJSON(JSON.stringify(match))).toThrow();
  });
  it("rejects a retention event that claims to flip possession", () => {
    const match = logEvent(newMatch(), "REBOUND_REGAINED");
    match.events[0].isPossessionFlipped = true;
    expect(() => importJSON(JSON.stringify(match))).toThrow();
  });
  it("exports a paused snapshot without changing the live clock", () => {
    const match = { ...newMatch(), clockStartedAt: Date.now() - 10000 };
    const json = JSON.parse(exportJSON(match));
    expect(json.clockStartedAt).toBeNull();
    expect(json.gameTimeSeconds).toBeGreaterThanOrEqual(10);
    expect(match.clockStartedAt).not.toBeNull();
  });
});
