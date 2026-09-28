import { jsPDF } from "jspdf";
import en from "../locales/en.json";
import es from "../locales/es.json";
import {
  attackPhases,
  defenseSystems,
  type Language,
  type MatchSession,
  type TeamId,
} from "../types/match";
import {
  defenseBands,
  defenseStats,
  formatRatio,
  ratio,
  type MatchReport,
  type Possession,
} from "./reportAnalytics";
import { countMetrics, efficiencyMetrics, fraction } from "./reportMetrics";
import { teamOf } from "./matchEngine";

export async function downloadReportPDF(
  match: MatchSession,
  report: MatchReport,
  language: Language,
  period?: number,
  perspective: TeamId = "home",
) {
  const t = (key: keyof typeof en) => (language === "es" ? es : en)[key];
  const response = await fetch("/fonts/NotoSans-Regular.ttf");
  if (!response.ok) throw new Error("PDF font unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const pdf = new jsPDF({ compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS("NotoSans.ttf", btoa(binary));
  pdf.addFont("NotoSans.ttf", "NotoSans", "normal");
  pdf.setFont("NotoSans");
  pdf.setProperties({
    title: `${match.matchName} - ${t("report")}`,
    creator: "Open Handball Stats",
  });
  const scope =
    period === undefined ? t("allPeriods") : `${t("period")} ${period}`;
  let y = 0;
  const text = (
    value: string,
    x: number,
    top: number,
    size = 10,
    color = "#33412e",
  ) => {
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    pdf.text(
      Array.from(value)
        .filter((char) => char.charCodeAt(0) >= 32)
        .join(""),
      x,
      top,
    );
  };
  const fit = (value: string, width: number, size: number) => {
    pdf.setFontSize(size);
    if (pdf.getTextWidth(value) <= width) return value;
    let result = value;
    while (result.length && pdf.getTextWidth(`${result}…`) > width)
      result = result.slice(0, -1);
    return `${result}…`;
  };
  function header(title: string, add = true) {
    if (add) pdf.addPage();
    pdf.setFillColor("#f1f5ed");
    pdf.rect(0, 0, 210, 40, "F");
    text("OPEN HANDBALL STATS", 15, 12, 8, "#70816a");
    text(title, 15, 23, 17);
    text(fit(`${match.matchName} · ${scope}`, 180, 9), 15, 33, 9);
    y = 51;
  }
  function room(height: number) {
    if (y + height > 278) header(t("report"));
  }
  function paragraph(value: string, size = 9) {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value, 180) as string[];
    for (const line of lines) {
      room(5);
      text(line, 15, y, size, "#6d7a66");
      y += 4.8;
    }
    y += 5;
  }
  function heading(value: string) {
    room(22);
    text(value, 15, y, 12);
    y += 10;
  }
  function table(rows: [string, string, string][]) {
    const tableHeader = () => {
      pdf.setFillColor("#edf2e8");
      pdf.rect(15, y - 5, 180, 10, "F");
      text(t("team"), 18, y + 1, 9);
      text(
        fit(match.homeTeam.name, 43, 9),
        104,
        y + 1,
        9,
        match.homeTeam.color,
      );
      text(
        fit(match.awayTeam.name, 43, 9),
        151,
        y + 1,
        9,
        match.awayTeam.color,
      );
      y += 12;
    };
    room(24);
    tableHeader();
    for (const [label, home, away] of rows) {
      pdf.setFontSize(9);
      const lines = pdf.splitTextToSize(label, 81) as string[];
      const height = Math.max(10, lines.length * 4.2 + 5);
      if (y + height > 278) {
        header(t("report"));
        tableHeader();
      }
      lines.forEach((line, i) => text(line, 18, y + i * 4.2, 9));
      text(home, 104, y, 9);
      text(away, 151, y, 9);
      pdf.setDrawColor("#e3e8de");
      pdf.line(15, y + height - 5, 195, y + height - 5);
      y += height;
    }
    y += 7;
  }
  header(t("report"), false);
  paragraph(
    `${new Date(match.date).toLocaleDateString(language === "es" ? "es-ES" : "en-GB")} ${match.competition ? `· ${match.competition}` : ""}`,
  );
  heading(t("efficiency"));
  table([
    ...efficiencyMetrics.map(
      ([label, key]): [string, string, string] =>
        [
          t(label),
          ...(["home", "away"] as const).map(
            (team) =>
              `${formatRatio(report.teams[team][key])} (${fraction(report.teams[team][key])})`,
          ),
        ] as [string, string, string],
    ),
    ...countMetrics.map(([label, key]): [string, string, string] => [
      t(label),
      String(report.teams.home[key]),
      String(report.teams.away[key]),
    ]),
  ]);
  paragraph(t("reportFilterHelp"), 8);
  function timeline(possessions: Possession[]) {
    header(t("goalDifference"));
    const left = 22,
      width = 173,
      top = 86,
      height = 100;
    const cell = width / possessions.length;
    const sign = perspective === "home" ? 1 : -1;
    const differences = possessions.map(
      (p) => (p.homeScore - p.awayScore) * sign,
    );
    const first = possessions[0];
    const goals = first.events.filter((e) => e.eventType === "GOAL").length;
    const before =
      differences[0] - goals * (first.team === perspective ? 1 : -1);
    const max = Math.max(
      2,
      Math.max(...differences.map(Math.abs), Math.abs(before)) + 1,
    );
    const yy = (d: number) => top + height / 2 - ((d / max) * height) / 2;
    const xx = (i: number) => left + (i + 0.5) * cell;
    text(
      `${t("perspective")}: ${fit(teamOf(match, perspective).name, 130, 9)}`,
      15,
      50,
      9,
    );
    for (const [team, bandY] of [
      ["home", 64],
      ["away", 202],
    ] as const) {
      text(
        `${fit(teamOf(match, team).name, 140, 9)} · ${t("defense")}`,
        left,
        bandY - 4,
        9,
      );
      for (const band of defenseBands(possessions, team)) {
        const bandWidth = cell * (band.end - band.start + 1);
        pdf.setFillColor(band.system ? teamOf(match, team).color : "#dce3d8");
        pdf.rect(
          left + cell * band.start,
          bandY,
          Math.max(0.1, bandWidth - 0.2),
          8,
          "F",
        );
        const name = band.system ?? "?";
        if (bandWidth > 8)
          text(
            fit(
              name === "MAN_TO_MAN"
                ? t("MAN_TO_MAN")
                : name === "OTHER"
                  ? t("OTHER")
                  : name,
              bandWidth - 2,
              6,
            ),
            left + cell * band.start + 1,
            bandY + 5.5,
            6,
            "#17251b",
          );
      }
    }
    for (const tick of [
      ...new Set([-max, -Math.round(max / 2), 0, Math.round(max / 2), max]),
    ]) {
      pdf.setDrawColor(tick === 0 ? "#99a68f" : "#e5eade");
      pdf.setLineWidth(0.2);
      pdf.line(left, yy(tick), left + width, yy(tick));
      text(`${tick > 0 ? "+" : ""}${tick}`, 12, yy(tick) + 1, 8);
    }
    pdf.setDrawColor(teamOf(match, perspective).color);
    pdf.setLineWidth(0.65);
    let previousX = left,
      previousY = yy(before);
    possessions.forEach((p, i) => {
      pdf.line(previousX, previousY, xx(i), previousY);
      pdf.line(xx(i), previousY, xx(i), yy(differences[i]));
      previousX = xx(i);
      previousY = yy(differences[i]);
      if (
        i % Math.max(1, Math.ceil(possessions.length / 12)) === 0 ||
        i === possessions.length - 1
      )
        text(String(p.number), xx(i) - 1, 194, 7);
    });
    pdf.line(previousX, previousY, left + width, previousY);
    text(
      `${t("possession")} ${first.number}–${possessions.at(-1)!.number}`,
      80,
      223,
      9,
    );
    y = 235;
    paragraph(t("defenseBandsHelp"), 8);
    paragraph(
      `${t("difference")}: ${fit(teamOf(match, perspective).name, 80, 8)} - ${fit(teamOf(match, perspective === "home" ? "away" : "home").name, 80, 8)}`,
      8,
    );
  }
  for (let offset = 0; offset < report.possessions.length; offset += 60)
    timeline(report.possessions.slice(offset, offset + 60));
  header(t("counterAttacks"));
  table(
    (
      [
        ["launched", "caAttempts"],
        ["finished", "caFinished"],
        ["goals", "caGoals"],
        ["aborted", "caAborted"],
      ] as const
    ).map(([label, key]) => [
      t(label),
      String(report.teams.home[key]),
      String(report.teams.away[key]),
    ]),
  );
  heading(t("counterGoal"));
  table(
    (
      [
        ["launched", "counterGoalAttempts"],
        ["finished", "counterGoalFinished"],
        ["goals", "counterGoals"],
      ] as const
    ).map(([label, key]) => [
      t(label),
      String(report.teams.home[key]),
      String(report.teams.away[key]),
    ]),
  );
  paragraph(t("methodCounters"));
  header(t("shotOutcomes"));
  table(
    (
      [
        ["GOAL", "goals"],
        ["GK_SAVE", "saved"],
        ["SHOT_OUT", "out"],
        ["SHOT_BLOCKED", "blocked"],
      ] as const
    ).map(([label, key]) => [
      t(label),
      `${report.teams.home[key]} (${formatRatio(ratio(report.teams.home[key], report.teams.home.shots))})`,
      `${report.teams.away[key]} (${formatRatio(ratio(report.teams.away[key], report.teams.away.shots))})`,
    ]),
  );
  for (const team of ["home", "away"] as const) {
    text(fit(teamOf(match, team).name, 170, 8), 15, y, 8);
    y += 3;
    let x = 15;
    for (const [key, color] of [
      ["goals", "#a2c887"],
      ["saved", "#96bad6"],
      ["out", "#ddc58d"],
      ["blocked", "#93c6b9"],
    ] as const) {
      const width =
        (ratio(report.teams[team][key], report.teams[team].shots).value ?? 0) *
        1.8;
      pdf.setFillColor(color);
      if (width) pdf.rect(x, y, width, 6, "F");
      x += width;
    }
    y += 14;
  }
  heading(t("turnoverBreakdown"));
  table(
    countMetrics
      .filter(([, key]) =>
        ["steals", "lostBalls", "technicalFaults", "turnovers"].includes(key),
      )
      .map(([label, key]) => [
        t(label),
        String(report.teams.home[key]),
        String(report.teams.away[key]),
      ]),
  );
  header(t("defenseBreakdown"));
  table(
    defenseSystems.map((system) => {
      const display = (team: TeamId) => {
        const data = defenseStats(report.possessions, team, system);
        return `${formatRatio(data.efficiency)} (${fraction(data.efficiency)})`;
      };
      return [
        system === "MAN_TO_MAN" || system === "OTHER" ? t(system) : system,
        display("home"),
        display("away"),
      ];
    }),
  );
  heading(t("phaseBreakdown"));
  table(
    attackPhases.map((phase) => {
      const display = (team: TeamId) => {
        const attacks = report.possessions.filter(
          (p) => p.team === team && p.phase === phase && p.completed,
        );
        const value = ratio(
          attacks.filter((p) => p.events.some((e) => e.eventType === "GOAL"))
            .length,
          attacks.length,
        );
        return `${formatRatio(value)} (${fraction(value)})`;
      };
      return [t(phase), display("home"), display("away")];
    }),
  );
  header(t("methodology"));
  for (const key of [
    "methodPossessions",
    "methodEfficiency",
    "methodCounters",
    "methodTurnovers",
    "defenseBandsHelp",
  ] as const)
    paragraph(t(key));
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    text(t("reportGenerated"), 15, 288, 7, "#7c8975");
    text(`${page} / ${total}`, 179, 288, 8, "#7c8975");
  }
  pdf.save(
    `${match.matchName.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "match"}-report.pdf`,
  );
}
