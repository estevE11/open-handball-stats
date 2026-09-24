import type { CSSProperties } from "react";
import { eventAppearance } from "./eventAppearance";
import { Activity, ArrowRight, MessageCircle, Target } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { useMatchStore } from "../../store/matchStore";
import { formatTime } from "../../lib/matchEngine";
import type { MatchEvent } from "../../types/match";
export function EventStream({
  onEdit,
}: {
  onEdit: (event: MatchEvent) => void;
}) {
  const match = useMatchStore((s) => s.match);
  const { t } = useTranslation();
  return (
    <aside className="event-stream">
      <div className="stream-heading">
        <h2>
          <Activity size={17} />
          {t("liveEvents")}
        </h2>
        <span>{match.events.length}</span>
      </div>
      <div className="stream-meta">
        <span>
          {t("period")} {match.period}
        </span>
        <span>
          {match.events.length} {t("events")}
        </span>
      </div>
      {!match.events.length ? (
        <div className="empty-stream">
          <div className="empty-symbol">
            <Target size={30} strokeWidth={1} />
          </div>
          <h3>{t("emptyTitle")}</h3>
          <p>{t("emptyBody")}</p>
          <div className="empty-lines">
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : (
        <ol className="event-list" aria-label={t("liveEvents")}>
          {[...match.events].reverse().map((e) => {
            const appearance = eventAppearance[e.eventType];
            const Icon = appearance.icon;
            const teamId =
              e.sanctionTeamId ??
              e.attackingTeamId ??
              (e.attackingTeamName === match.homeTeam.name ? "home" : "away");
            const teamColor =
              match[teamId === "home" ? "homeTeam" : "awayTeam"].color;
            return (
              <li
                key={e.id}
                style={{ "--event-team-color": teamColor } as CSSProperties}
                className={e.eventType === "GOAL" ? "event-goal" : ""}
              >
                <span
                  className="event-action-icon"
                  style={
                    {
                      "--event-action-color": appearance.color,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <div className="event-time">
                  <span>{formatTime(e.gameTimeSeconds)}</span>
                  <small>P{e.period}</small>
                </div>
                <div className="event-detail">
                  <strong>
                    {t(e.eventType)} {e.eventType === "GOAL" && <b>+1</b>}
                  </strong>
                  <span>
                    {e.attackingTeamName}
                    {e.isPossessionFlipped && <ArrowRight size={12} />}
                  </span>
                  <small>
                    {t(e.attackPhase)} ·{" "}
                    {e.defenseSystem === "MAN_TO_MAN" ||
                    e.defenseSystem === "OTHER"
                      ? t(e.defenseSystem)
                      : e.defenseSystem}
                  </small>
                  {e.subType && (
                    <small>
                      {t(e.subType)}
                      {e.sanctionTeamId &&
                        ` · ${match[e.sanctionTeamId === "home" ? "homeTeam" : "awayTeam"].name}`}
                    </small>
                  )}
                  {e.notes && <p>{e.notes}</p>}
                </div>
                <button
                  className="icon-button note-button"
                  aria-label={t("editEvent")}
                  onClick={() => onEdit(e)}
                >
                  <MessageCircle size={14} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="stream-footer">
        <ShieldIcon />
        <span>{t("noCloud")}</span>
      </div>
    </aside>
  );
}
function ShieldIcon() {
  return <span className="tiny-dot" />;
}
