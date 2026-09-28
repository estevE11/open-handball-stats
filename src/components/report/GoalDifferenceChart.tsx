import type { MatchSession, TeamId } from "../../types/match";
import { defenseBands, type Possession } from "../../lib/reportAnalytics";
import { useTranslation } from "../../hooks/useTranslation";
import { teamOf } from "../../lib/matchEngine";

export function GoalDifferenceChart({
  possessions,
  match,
  perspective,
  selected,
  onSelect,
  onZoom,
}: {
  possessions: Possession[];
  match: MatchSession;
  perspective: TeamId;
  selected: number;
  onSelect: (index: number) => void;
  onZoom: (start: number, end: number) => void;
}) {
  const { t } = useTranslation();
  const left = 64,
    width = 872,
    top = 99,
    height = 180;
  const sign = perspective === "home" ? 1 : -1;
  const differences = possessions.map(
    (p) => (p.homeScore - p.awayScore) * sign,
  );
  const first = possessions[0];
  const firstGoals =
    first?.events.filter((e) => e.eventType === "GOAL").length ?? 0;
  const before = first
    ? differences[0] - firstGoals * (first.team === perspective ? 1 : -1)
    : 0;
  const extent = Math.max(
    2,
    Math.max(...differences.map(Math.abs), Math.abs(before)) + 1,
  );
  const cell = width / Math.max(1, possessions.length);
  const x = (i: number) => left + (i + 0.5) * cell;
  const y = (difference: number) =>
    top + height / 2 - ((difference / extent) * height) / 2;
  let path = `M ${left} ${y(before)}`;
  differences.forEach((d, i) => {
    path += ` H ${x(i)} V ${y(d)}`;
  });
  path += ` H ${left + width}`;
  const ticks = [
    ...new Set([
      -extent,
      -Math.round(extent / 2),
      0,
      Math.round(extent / 2),
      extent,
    ]),
  ];
  return (
    <div className="report-chart-scroll">
      <svg
        className="difference-chart"
        viewBox="0 0 960 382"
        aria-label={t("goalDifference")}
      >
        <title>{t("goalDifference")}</title>
        <text x={left} y={22} className="chart-label">
          {match.homeTeam.name} · {t("defense")}
        </text>
        <text x={left} y={361} className="chart-label">
          {match.awayTeam.name} · {t("defense")}
        </text>
        {(["home", "away"] as const).map((team) =>
          defenseBands(possessions, team).map((band, i) => {
            const bandWidth = cell * (band.end - band.start + 1);
            const label =
              band.system === null
                ? t("unknownDefense")
                : band.system === "MAN_TO_MAN" || band.system === "OTHER"
                  ? t(band.system)
                  : band.system;
            const bandY = team === "home" ? 35 : 318;
            return (
              <g
                key={`${team}-${i}`}
                role="button"
                tabIndex={0}
                aria-label={`${teamOf(match, team).name}: ${label}, ${t("possession")} ${possessions[band.start].number}–${possessions[band.end].number}`}
                onClick={() => onZoom(band.start, band.end)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onZoom(band.start, band.end);
                  }
                }}
                className="defense-band"
              >
                <title>
                  {label} · {possessions[band.start].number}–
                  {possessions[band.end].number}
                </title>
                <rect
                  x={left + cell * band.start}
                  y={bandY}
                  width={Math.max(0, bandWidth - 1)}
                  height={24}
                  rx={4}
                  fill={teamOf(match, team).color}
                  fillOpacity={band.system ? 0.23 : 0.06}
                />
                {bandWidth > 44 && (
                  <text
                    x={left + (cell * (band.start + band.end + 1)) / 2}
                    y={bandY + 16}
                    textAnchor="middle"
                    className="band-label"
                  >
                    {bandWidth > 115 || label.length <= 5 ? label : "…"}
                  </text>
                )}
              </g>
            );
          }),
        )}
        <rect
          x={left}
          y={top}
          width={width}
          height={height / 2}
          fill={teamOf(match, perspective).color}
          fillOpacity=".04"
        />
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={left + width}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? "chart-zero" : "chart-grid"}
            />
            <text
              x={left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              className="chart-tick"
            >
              {tick > 0 ? "+" : ""}
              {tick}
            </text>
          </g>
        ))}
        <text
          x={19}
          y={190}
          transform="rotate(-90 19 190)"
          textAnchor="middle"
          className="chart-label"
        >
          {t("difference")}
        </text>
        <path
          d={path}
          fill="none"
          stroke={teamOf(match, perspective).color}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {possessions.map((p, i) =>
          i % Math.max(1, Math.ceil(possessions.length / 12)) === 0 ||
          i === possessions.length - 1 ? (
            <text
              key={p.number}
              x={x(i)}
              y={299}
              textAnchor="middle"
              className="chart-tick"
            >
              {p.number}
            </text>
          ) : null,
        )}
        <text
          x={left + width / 2}
          y={378}
          textAnchor="middle"
          className="chart-label"
        >
          {t("possession")}
        </text>
        {possessions[selected] && (
          <g>
            <line
              x1={x(selected)}
              x2={x(selected)}
              y1={top}
              y2={top + height}
              className="chart-cursor"
            />
            <circle
              cx={x(selected)}
              cy={y(differences[selected])}
              r={5}
              fill={teamOf(match, perspective).color}
              stroke="white"
              strokeWidth={2}
            />
          </g>
        )}
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill="transparent"
          onPointerMove={(e) => {
            const bounds =
              e.currentTarget.ownerSVGElement!.getBoundingClientRect();
            const position = ((e.clientX - bounds.left) / bounds.width) * 960;
            onSelect(
              Math.max(
                0,
                Math.min(
                  possessions.length - 1,
                  Math.floor((position - left) / cell),
                ),
              ),
            );
          }}
        />
      </svg>
    </div>
  );
}
