import { useTranslation } from "../../hooks/useTranslation";
import {
  formatRatio,
  type FiveMinuteInterval,
} from "../../lib/reportAnalytics";
import {
  formatDifference,
  fraction,
  intervalCellColor,
  intervalMetrics,
} from "../../lib/reportMetrics";
import { teamOf } from "../../lib/matchEngine";
import type { MatchSession, TeamId } from "../../types/match";

export function FiveMinuteTable({
  match,
  intervals,
  team,
  onTeamChange,
}: {
  match: MatchSession;
  intervals: FiveMinuteInterval[];
  team: TeamId;
  onTeamChange: (team: TeamId) => void;
}) {
  const { t } = useTranslation();
  const differenceScale = Math.max(
    1,
    ...intervals.map((interval) => Math.abs(interval.teams[team].difference)),
  );
  return (
    <section className="report-card" data-testid="five-minute-analysis">
      <div className="report-section-heading">
        <div>
          <h2>{t("fiveMinuteAnalysis")}</h2>
        </div>
        <div
          className="language-toggle interval-team-toggle"
          role="group"
          aria-label={t("fiveMinutePerspective")}
        >
          {(["home", "away"] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={team === id}
              onClick={() => onTeamChange(id)}
            >
              {teamOf(match, id).name}
            </button>
          ))}
        </div>
      </div>
      <p className="report-note">{t("fiveMinuteHelp")}</p>
      {intervals.length ? (
        <div className="report-table-scroll">
          <table
            className="five-minute-table"
            style={{ minWidth: 180 + intervals.length * 68 }}
            aria-label={`${t("fiveMinuteAnalysis")} · ${teamOf(match, team).name}`}
          >
            <colgroup>
              <col style={{ width: 180 }} />
              {intervals.map((interval) => (
                <col key={interval.endSeconds} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t("intervalMinute")}</th>
                {intervals.map((interval) => (
                  <th
                    scope="col"
                    key={interval.endSeconds}
                    title={`${interval.startSeconds / 60}–${interval.endSeconds / 60}′${interval.partial ? ` · ${t("intervalInProgress")}` : ""}`}
                  >
                    {interval.endSeconds / 60}′{interval.partial ? "*" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {intervalMetrics.map(([label, key]) => (
                <tr key={key} data-testid={`interval-${key}`}>
                  <th scope="row">{t(label)}</th>
                  {intervals.map((interval) => {
                    const data = interval.teams[team][key];
                    const value = typeof data === "number" ? data : data.value;
                    return (
                      <td
                        key={interval.endSeconds}
                        style={{
                          backgroundColor:
                            key === "difference"
                              ? intervalCellColor(value, 0, differenceScale)
                              : intervalCellColor(value),
                        }}
                        title={
                          typeof data === "number" ? undefined : fraction(data)
                        }
                      >
                        {typeof data === "number"
                          ? formatDifference(data)
                          : formatRatio(data)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="report-note">{t("noIntervalData")}</p>
      )}
      {intervals.some((interval) => interval.partial) && (
        <p className="report-note">* {t("intervalInProgress")}</p>
      )}
    </section>
  );
}
