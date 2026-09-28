import { useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Download, BarChart3, Crosshair } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import {
  buildReport,
  defenseStats,
  formatRatio,
  ratio,
  type Ratio,
} from "../../lib/reportAnalytics";
import {
  countMetrics,
  efficiencyMetrics,
  fraction,
  type EfficiencyMetric,
} from "../../lib/reportMetrics";
import {
  attackPhases,
  defenseSystems,
  type MatchSession,
  type TeamId,
} from "../../types/match";
import { formatTime, teamOf } from "../../lib/matchEngine";
import { GoalDifferenceChart } from "./GoalDifferenceChart";
import "./report.css";
const teams = ["home", "away"] as const;
export default function ReportPage({
  match,
  onBack,
}: {
  match: MatchSession;
  onBack: () => void;
}) {
  const { t, language } = useTranslation();
  const [period, setPeriod] = useState<number | undefined>();
  const [perspective, setPerspective] = useState<TeamId>("home");
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [metric, setMetric] = useState<EfficiencyMetric>("attack");
  const [outcome, setOutcome] = useState<"goals" | "saved" | "out" | "blocked">(
    "goals",
  );
  const [pdfBusy, setPdfBusy] = useState(false),
    [pdfError, setPdfError] = useState(false);
  const report = useMemo(() => buildReport(match, period), [match, period]);
  const possessions = report.possessions.slice(
    zoom?.[0] ?? 0,
    zoom ? zoom[1] + 1 : undefined,
  );
  const index = Math.min(selected, Math.max(0, possessions.length - 1));
  const inspected = possessions[index];
  const periods = [...new Set([...report.periods, match.period])].sort(
    (a, b) => a - b,
  );
  async function download() {
    setPdfBusy(true);
    setPdfError(false);
    try {
      const { downloadReportPDF } = await import("../../lib/reportPdf");
      await downloadReportPDF(match, report, language, period, perspective);
    } catch {
      setPdfError(true);
    } finally {
      setPdfBusy(false);
    }
  }
  const tint = (team: TeamId) =>
    ({ "--team-color": teamOf(match, team).color }) as CSSProperties;
  const ratioCell = (value: Ratio) => (
    <>
      <strong>{formatRatio(value)}</strong>
      <small>{fraction(value)}</small>
    </>
  );
  return (
    <main className="report-page">
      <div className="report-heading">
        <div>
          <button className="button plain" onClick={onBack}>
            <ArrowLeft size={16} />
            {t("backToMatch")}
          </button>
          <div className="eyebrow">
            OPEN HANDBALL STATS · {t("reportSnapshot")}
          </div>
          <h1>{t("report")}</h1>
          <p>
            {match.matchName} · {t("reportSubtitle")}
          </p>
        </div>
        <button
          className="button primary"
          disabled={pdfBusy}
          onClick={() => void download()}
        >
          <Download size={17} />
          {t(pdfBusy ? "buildingPDF" : "downloadPDF")}
        </button>
      </div>
      {pdfError && (
        <p role="alert" className="notice error">
          {t("pdfError")}
        </p>
      )}
      <div className="report-toolbar">
        <label>
          {t("reportScope")}
          <select
            value={period ?? "all"}
            onChange={(e) => {
              setPeriod(
                e.target.value === "all" ? undefined : Number(e.target.value),
              );
              setZoom(null);
              setSelected(0);
            }}
          >
            <option value="all">{t("allPeriods")}</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {t("period")} {p}
              </option>
            ))}
          </select>
        </label>
        <p>{t("reportFilterHelp")}</p>
      </div>
      <div className="report-scorecards">
        {teams.map((team) => (
          <article className="report-team-card" key={team} style={tint(team)}>
            <span className="report-team-dot" />
            <div>
              <h2>{teamOf(match, team).name}</h2>
              <p>
                {report.teams[team].possessions}{" "}
                {t("completedPossessions").toLowerCase()} ·{" "}
                {report.teams[team].shots} {t("shots").toLowerCase()}
              </p>
            </div>
            <strong>{report.teams[team].goals}</strong>
          </article>
        ))}
      </div>
      {!report.possessions.length && (
        <div className="report-empty">
          <BarChart3 size={32} />
          <p>{t(period ? "periodEmpty" : "noReportData")}</p>
        </div>
      )}
      <section className="report-card">
        <div className="report-section-heading">
          <div>
            <h2>{t("goalDifference")}</h2>
            <p>{t("chartHelp")}</p>
          </div>
          <label>
            {t("perspective")}
            <select
              value={perspective}
              onChange={(e) => setPerspective(e.target.value as TeamId)}
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {teamOf(match, team).name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {possessions.length > 0 && (
          <>
            <div className="chart-tools">
              <button
                className="button secondary"
                disabled={!zoom}
                onClick={() => {
                  setZoom(null);
                  setSelected(0);
                }}
              >
                {t("resetZoom")}
              </button>
              <button
                className="button secondary"
                disabled={report.possessions.length <= 10}
                onClick={() => {
                  setZoom([
                    Math.max(0, report.possessions.length - 10),
                    report.possessions.length - 1,
                  ]);
                  setSelected(0);
                }}
              >
                {t("lastTen")}
              </button>
              <span>
                {t("possession")} {possessions[0].number}–
                {possessions.at(-1)!.number}
              </span>
            </div>
            <GoalDifferenceChart
              possessions={possessions}
              match={match}
              perspective={perspective}
              selected={index}
              onSelect={setSelected}
              onZoom={(start, end) => {
                setZoom([(zoom?.[0] ?? 0) + start, (zoom?.[0] ?? 0) + end]);
                setSelected(0);
              }}
            />
            <label className="possession-slider">
              <Crosshair size={16} />
              {t("inspectPossession")}
              <input
                type="range"
                min={0}
                max={Math.max(0, possessions.length - 1)}
                value={index}
                onChange={(e) => setSelected(Number(e.target.value))}
              />
            </label>
            {inspected && (
              <div className="possession-inspector" aria-live="polite">
                <strong>
                  #{inspected.number} · {teamOf(match, inspected.team).name}
                </strong>
                <span>
                  {t("period")} {inspected.period} ·{" "}
                  {formatTime(inspected.events.at(-1)!.gameTimeSeconds)}
                </span>
                <b>
                  {inspected.homeScore} : {inspected.awayScore}
                </b>
                <span>
                  {t(
                    inspected.completed
                      ? inspected.events.at(-1)!.eventType
                      : "notFinished",
                  )}{" "}
                  · {t(inspected.phase)} · {inspected.defense}
                </span>
                <small>
                  {t("originalTags")}: {inspected.tagIndices.join(", ")}
                </small>
              </div>
            )}
          </>
        )}
        <p className="report-note">{t("defenseBandsHelp")}</p>
      </section>
      <div className="report-two-columns">
        <section className="report-card">
          <h2>{t("efficiency")}</h2>
          <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>{t("efficiency")}</th>
                  {teams.map((team) => (
                    <th key={team} style={tint(team)}>
                      {teamOf(match, team).name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {efficiencyMetrics.map(([label, key]) => (
                  <tr key={key}>
                    <th scope="row">{t(label)}</th>
                    {teams.map((team) => (
                      <td key={team} data-testid={`${team}-${key}`}>
                        {ratioCell(report.teams[team][key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="report-note">
            {t("formula")}: {t("goals")} /{" "}
            {t("completedPossessions").toLowerCase()} · {t("methodEfficiency")}
          </p>
        </section>
        <section className="report-card">
          <h2>{t("efficiency")}</h2>
          <label>
            {t("efficiency")}
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as EfficiencyMetric)}
            >
              {efficiencyMetrics.map(([label, key]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <div className="efficiency-comparison">
            {teams.map((team) => (
              <div key={team} style={tint(team)} className="comparison-row">
                <span>{teamOf(match, team).name}</span>
                <strong>{formatRatio(report.teams[team][metric])}</strong>
                <div className="report-bar-track">
                  <i
                    style={{
                      width: `${report.teams[team][metric].value ?? 0}%`,
                    }}
                  />
                </div>
                <small>{fraction(report.teams[team][metric])}</small>
              </div>
            ))}
          </div>
          <div className="report-table-scroll">
            <table className="report-table compact">
              <thead>
                <tr>
                  <th>{t("reportSnapshot")}</th>
                  {teams.map((team) => (
                    <th key={team}>{teamOf(match, team).name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countMetrics.map(([label, key]) => (
                  <tr key={key}>
                    <th scope="row">{t(label)}</th>
                    {teams.map((team) => (
                      <td key={team}>{report.teams[team][key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="report-card">
        <h2>{t("counterAttacks")}</h2>
        <div className="report-two-columns inset">
          {teams.map((team) => (
            <article key={team} style={tint(team)} className="counter-team">
              <h3>{teamOf(match, team).name}</h3>
              <div className="counter-funnel">
                {(
                  [
                    ["launched", "caAttempts"],
                    ["finished", "caFinished"],
                    ["goals", "caGoals"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key}>
                    <span>{t(label)}</span>
                    <b>{report.teams[team][key]}</b>
                    <div className="report-bar-track">
                      <i
                        style={{
                          width: `${ratio(report.teams[team][key], report.teams[team].caAttempts).value ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p>
                {t("aborted")}: <b>{report.teams[team].caAborted}</b>
              </p>
              <div className="counter-goal">
                <strong>{t("counterGoal")}</strong>
                <p>
                  {report.teams[team].counterGoalAttempts}{" "}
                  {t("launched").toLowerCase()} ·{" "}
                  {report.teams[team].counterGoalFinished}{" "}
                  {t("finished").toLowerCase()} ·{" "}
                  {report.teams[team].counterGoals} {t("goals").toLowerCase()}
                </p>
                <b>{formatRatio(report.teams[team].counterGoal)}</b>
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="report-two-columns">
        <section className="report-card">
          <h2>{t("shotOutcomes")}</h2>
          <p className="report-note">{t("shotOutcomesHelp")}</p>
          <div className="outcome-controls">
            {(
              [
                ["goals", "GOAL"],
                ["saved", "GK_SAVE"],
                ["out", "SHOT_OUT"],
                ["blocked", "SHOT_BLOCKED"],
              ] as const
            ).map(([key, label]) => (
              <button
                className={`button secondary outcome-${key}`}
                key={key}
                aria-pressed={outcome === key}
                onClick={() => setOutcome(key)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          {teams.map((team) => (
            <div key={team} className="shot-team">
              <h3>
                {teamOf(match, team).name}
                <span>
                  {formatRatio(
                    ratio(
                      report.teams[team][outcome],
                      report.teams[team].shots,
                    ),
                  )}{" "}
                  · {report.teams[team][outcome]} / {report.teams[team].shots}
                </span>
              </h3>
              <div className="shot-stack">
                {(["goals", "saved", "out", "blocked"] as const).map((key) => (
                  <span
                    key={key}
                    className={`outcome-${key} ${key === outcome ? "is-selected" : ""}`}
                    style={{
                      width: `${ratio(report.teams[team][key], report.teams[team].shots).value ?? 0}%`,
                    }}
                  >
                    <b>{report.teams[team][key] || ""}</b>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
        <section className="report-card">
          <h2>{t("turnoverBreakdown")}</h2>
          {teams.map((team) => (
            <div key={team} className="turnover-team" style={tint(team)}>
              <h3>
                {teamOf(match, team).name}
                <b>{report.teams[team].turnovers}</b>
              </h3>
              {(
                [
                  ["stealsWon", "steals"],
                  ["lostBalls", "lostBalls"],
                  ["technicalFaults", "technicalFaults"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="turnover-row">
                  <span>{t(label)}</span>
                  <div className="report-bar-track">
                    <i
                      style={{
                        width: `${ratio(report.teams[team][key], Math.max(1, ...teams.flatMap((team) => [report.teams[team].steals, report.teams[team].lostBalls, report.teams[team].technicalFaults]))).value}%`,
                      }}
                    />
                  </div>
                  <b>{report.teams[team][key]}</b>
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
      <section className="report-card">
        <h2>{t("defenseBreakdown")}</h2>
        <div className="report-table-scroll">
          <table className="report-table defense-table">
            <thead>
              <tr>
                <th>{t("defenseSystem")}</th>
                {teams.map((team) => (
                  <th key={team}>{teamOf(match, team).name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {defenseSystems.map((system) => (
                <tr key={system}>
                  <th scope="row">
                    {system === "MAN_TO_MAN" || system === "OTHER"
                      ? t(system)
                      : system}
                  </th>
                  {teams.map((team) => {
                    const data = defenseStats(report.possessions, team, system);
                    return (
                      <td key={team} style={tint(team)}>
                        <strong>{formatRatio(data.efficiency)}</strong>
                        <small>
                          {data.efficiency.numerator} / {data.possessions}{" "}
                          {t("stops").toLowerCase()}
                        </small>
                        <div className="report-bar-track">
                          <i
                            style={{ width: `${data.efficiency.value ?? 0}%` }}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="report-card">
        <h2>{t("phaseBreakdown")}</h2>
        <div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>{t("attackPhase")}</th>
                {teams.map((team) => (
                  <th key={team}>{teamOf(match, team).name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attackPhases.map((phase) => (
                <tr key={phase}>
                  <th scope="row">{t(phase)}</th>
                  {teams.map((team) => {
                    const attacks = report.possessions.filter(
                      (p) =>
                        p.team === team && p.phase === phase && p.completed,
                    );
                    const goals = attacks.filter((p) =>
                      p.events.some((e) => e.eventType === "GOAL"),
                    ).length;
                    return (
                      <td key={team}>
                        {ratioCell(ratio(goals, attacks.length))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <details className="report-card report-methodology" open>
        <summary>{t("methodology")}</summary>
        {(
          [
            "methodPossessions",
            "methodEfficiency",
            "methodCounters",
            "methodTurnovers",
          ] as const
        ).map((key) => (
          <p key={key}>{t(key)}</p>
        ))}
      </details>
    </main>
  );
}
