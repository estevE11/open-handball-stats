import { SegmentedControl } from "../ui/SegmentedControl";
import { eventAppearance } from "./eventAppearance";
import {
  ArrowLeftRight,
  Shield,
  Undo2,
  CircleDot,
  RectangleVertical,
} from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { useMatchStore } from "../../store/matchStore";
import { otherTeam, teamOf } from "../../lib/matchEngine";
import {
  attackPhases,
  defenseSystems,
  type EventType,
} from "../../types/match";
export function TaggingPanel({
  onFault,
  onSanction,
}: {
  onFault: () => void;
  onSanction: () => void;
}) {
  const store = useMatchStore();
  const { match } = store;
  const { t } = useTranslation();
  const defender = teamOf(match, otherTeam(match.currentAttackingTeamId));
  const actions = [
    { type: "GOAL", help: "goalHelp" },
    { type: "GK_SAVE", help: "flipHelp" },
    { type: "SHOT_OUT", help: "flipHelp" },
    { type: "STEAL", help: "flipHelp" },
    { type: "TECHNICAL_FAULT", help: "faultHelp" },
    { type: "REBOUND_REGAINED", help: "retainHelp" },
  ].map((action) => ({
    ...action,
    ...eventAppearance[action.type as EventType],
  })) as {
    type: EventType;
    help: "goalHelp" | "flipHelp" | "faultHelp" | "retainHelp";
    icon: typeof Shield;
    className: string;
  }[];
  return (
    <section className="tagging-panel" aria-label={t("tagEvent")}>
      <div className="phase-panel">
        <div className="section-label">
          <span>{t("attackPhase")}</span>
          <small>{t("phaseHelp")}</small>
        </div>
        <SegmentedControl
          className="phase"
          label={t("attackPhase")}
          value={match.attackPhase}
          options={attackPhases.map((value) => ({ value, label: t(value) }))}
          onChange={store.setPhase}
        />
      </div>
      <div className="tag-heading">
        <div>
          <h2>{t("tagEvent")}</h2>
          <p>{t("actionHelp")}</p>
        </div>
        <span className="possession-badge">
          {t("possession")}{" "}
          <b>{String(match.currentPossessionIndex).padStart(2, "0")}</b>
        </span>
      </div>
      <div className="action-grid">
        {actions.map(({ type, icon: Icon, className, help }) => (
          <button
            key={type}
            className={`action ${className}`}
            title={type === "REBOUND_REGAINED" ? t("reboundNote") : undefined}
            onClick={() =>
              type === "TECHNICAL_FAULT"
                ? onFault()
                : store.log(type as EventType)
            }
          >
            <div className="action-top">
              <Icon size={26} strokeWidth={1.6} />
              <span>
                {type === "GOAL"
                  ? "+1"
                  : type === "REBOUND_REGAINED"
                    ? "↳"
                    : "↔"}
              </span>
            </div>
            <strong>{t(type)}</strong>
            <small>{t(help)}</small>
          </button>
        ))}
      </div>
      <div className="secondary-actions">
        <button
          className="button secondary"
          onClick={() => store.log("PENALTY_7M")}
        >
          <CircleDot size={18} />
          {t("PENALTY_7M")}
        </button>
        <button className="button secondary" onClick={onSanction}>
          <RectangleVertical size={17} />
          {t("SANCTION")}
        </button>
        <button
          className="button plain switch"
          onClick={store.switchPossession}
        >
          <ArrowLeftRight size={17} />
          {t("manualSwitch")}
        </button>
      </div>
      <div className="defense-panel">
        <div className="section-label">
          <span>
            <Shield size={15} />
            {t("defenseSystem")} <em>· {defender.name}</em>
          </span>
          <small>{t("defenseHelp")}</small>
        </div>
        <SegmentedControl
          className="defense"
          label={t("defenseSystem")}
          value={defender.currentDefense}
          options={defenseSystems.map((value) => ({
            value,
            label:
              value === "MAN_TO_MAN" || value === "OTHER"
                ? t(value === "OTHER" ? "defenseOther" : value)
                : value,
          }))}
          onChange={store.setDefense}
        />
      </div>
      <div className="tagging-bottom">
        <span>{t("allLocal")}</span>
        <button
          className="button undo"
          disabled={!store.history.length}
          onClick={store.undo}
          title={t("undoHelp")}
        >
          <Undo2 size={17} />
          {t("undo")}
        </button>
      </div>
    </section>
  );
}
