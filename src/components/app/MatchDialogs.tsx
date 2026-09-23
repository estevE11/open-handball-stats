import { SegmentedControl } from "../ui/SegmentedControl";
import { ClockEditor } from "./ClockEditor";
import { useEffect, useState, type FormEvent } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileCode2,
  FolderOpen,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { useTranslation } from "../../hooks/useTranslation";
import { useMatchStore, flushSaves } from "../../store/matchStore";
import { db } from "../../lib/browserStorage";
import { gameSeconds, newMatch, score, stopClock } from "../../lib/matchEngine";
import { downloadMatch } from "../../lib/exportService";
import {
  matchSchema,
  sanctions,
  technicalFaults,
  type MatchEvent,
  type MatchSession,
  type TeamId,
} from "../../types/match";
export type DialogKind =
  | "new"
  | "library"
  | "export"
  | "fault"
  | "sanction"
  | "clock"
  | "period"
  | { event: MatchEvent };
export function MatchDialogs({
  kind,
  onClose,
}: {
  kind: DialogKind;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const store = useMatchStore();
  const { match } = store;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<MatchSession[]>([]);
  const [offset, setOffset] = useState(0);
  const [team, setTeam] = useState<TeamId>(
    match.currentAttackingTeamId === "home" ? "away" : "home",
  );
  useEffect(() => {
    if (kind === "library")
      void db.matches
        .orderBy("date")
        .reverse()
        .toArray()
        .then(setMatches)
        .catch(() => setError("loadError"));
  }, [kind]);
  async function openMatch(next: MatchSession) {
    setBusy(true);
    try {
      if (match.clockStartedAt !== null) store.toggleClock();
      await flushSaves();
      if (useMatchStore.getState().saveStatus !== "saved") {
        setError("saveError");
        return;
      }
      store.replace(stopClock(next));
      await flushSaves();
      if (useMatchStore.getState().saveStatus !== "saved") {
        setError("saveError");
        return;
      }
      onClose();
    } catch {
      setError("loadError");
    } finally {
      setBusy(false);
    }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const home = String(values.get("home")).trim();
    const away = String(values.get("away")).trim();
    if (!home || !away || home === away) {
      setError("nameError");
      return;
    }
    const next = newMatch(
      home,
      away,
      String(values.get("name")).trim() || `${home} vs ${away}`,
    );
    next.competition = String(values.get("competition")).trim();
    next.homeTeam.color = String(values.get("homeColor"));
    next.awayTeam.color = String(values.get("awayColor"));
    void openMatch(next);
  }
  const title =
    typeof kind === "object"
      ? t("editEvent")
      : {
          new: t("newMatch"),
          library: t("matches"),
          export: t("export"),
          fault: t("TECHNICAL_FAULT"),
          sanction: t("SANCTION"),
          clock: t("editClock"),
          period: t("nextPeriod"),
        }[kind];
  return (
    <Modal title={title} onClose={onClose}>
      {error && (
        <p className="error" role="alert">
          {t(error as "loadError")}
        </p>
      )}
      {kind === "new" && (
        <form onSubmit={create}>
          <p className="dialog-description">{t("newHelp")}</p>
          <label>
            {t("matchName")}
            <input
              name="name"
              maxLength={200}
              placeholder={`${t("home")} vs ${t("away")}`}
            />
          </label>
          <div className="two-cols">
            <label>
              {t("homeTeam")}
              <input
                name="home"
                maxLength={200}
                required
                defaultValue={t("home")}
              />
              <input
                type="color"
                name="homeColor"
                defaultValue="#5684a3"
                aria-label={t("homeTeam")}
              />
            </label>
            <label>
              {t("awayTeam")}
              <input
                name="away"
                maxLength={200}
                required
                defaultValue={t("away")}
              />
              <input
                type="color"
                name="awayColor"
                defaultValue="#c89247"
                aria-label={t("awayTeam")}
              />
            </label>
          </div>
          <label>
            {t("competition")}
            <input name="competition" maxLength={200} />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              {t("cancel")}
            </button>
            <button className="button primary" disabled={busy}>
              {t("create")}
            </button>
          </div>
        </form>
      )}
      {kind === "library" && (
        <>
          <p className="dialog-description">{t("libraryHelp")}</p>
          <div className="match-list">
            {matches.map((saved) => (
              <button
                key={saved.id}
                className="match-row"
                disabled={busy || saved.id === match.id}
                onClick={() => {
                  const parsed = matchSchema.safeParse(saved);
                  if (parsed.success) void openMatch(parsed.data);
                  else setError("loadError");
                }}
              >
                <FolderOpen size={22} />
                <span>
                  <strong>{saved.matchName}</strong>
                  <small>
                    {new Date(saved.date).toLocaleDateString()} ·{" "}
                    {saved.events.length} {t("events")}
                  </small>
                </span>
                <b>
                  {score(saved, "home")} : {score(saved, "away")}
                </b>
              </button>
            ))}
          </div>
          <p className="dialog-note">{t("backupNote")}</p>
        </>
      )}
      {kind === "export" && (
        <>
          <p className="dialog-description">{t("exportHelp")}</p>
          <div className="export-options">
            {(
              [
                { format: "csv", icon: FileSpreadsheet, help: "csvHelp" },
                { format: "json", icon: FileJson, help: "jsonHelp" },
                { format: "xml", icon: FileCode2, help: "xmlHelp" },
              ] as const
            ).map(({ format, icon: Icon, help }) => (
              <button
                key={format}
                onClick={() => downloadMatch(match, format, offset)}
              >
                <Icon size={24} />
                <span>
                  <strong>{format.toUpperCase()}</strong>
                  <small>{t(help)}</small>
                </span>
                <Download size={18} />
              </button>
            ))}
          </div>
          <label>
            {t("offset")}
            <input
              type="number"
              value={offset}
              min={-604800}
              max={604800}
              onChange={(e) => setOffset(Number(e.target.value))}
            />
          </label>
          <p className="dialog-note">{t("xmlNote")}</p>
          <p className="dialog-note">{t("backupNote")}</p>
        </>
      )}
      {kind === "fault" && (
        <div className="choice-list">
          {technicalFaults.map((fault) => (
            <button
              className="button secondary"
              key={fault}
              onClick={() => {
                store.log("TECHNICAL_FAULT", { subType: fault });
                onClose();
              }}
            >
              {t(fault)}
            </button>
          ))}
        </div>
      )}
      {kind === "sanction" && (
        <>
          <p className="dialog-description">{t("sanctionHelp")}</p>
          <div className="sanction-team-label">{t("sanctionTeam")}</div>
          <SegmentedControl
            className="sanction-teams"
            label={t("sanctionTeam")}
            value={team}
            options={[
              { value: "home", label: match.homeTeam.name },
              { value: "away", label: match.awayTeam.name },
            ]}
            onChange={setTeam}
          />
          <div className="choice-list">
            {sanctions.map((sanction) => (
              <button
                className={`button secondary sanction-${sanction}`}
                key={sanction}
                onClick={() => {
                  store.log("SANCTION", {
                    subType: sanction,
                    sanctionTeamId: team,
                  });
                  onClose();
                }}
              >
                <span className="card-swatch" />
                {t(sanction)}
              </button>
            ))}
          </div>
        </>
      )}
      {kind === "clock" && (
        <ClockEditor
          seconds={gameSeconds(match)}
          onApply={(seconds) => {
            store.setTime(seconds);
            onClose();
          }}
          onCancel={onClose}
        />
      )}
      {kind === "period" && (
        <>
          <p className="dialog-description">{t("nextPeriodHelp")}</p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              className="button primary"
              onClick={() => {
                store.nextPeriod();
                onClose();
              }}
            >
              {t("nextPeriod")}
            </button>
          </div>
        </>
      )}
      {typeof kind === "object" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            store.editNote(
              kind.event.id,
              String(new FormData(e.currentTarget).get("notes")),
            );
            onClose();
          }}
        >
          <label>
            {t("notes")}
            <textarea
              name="notes"
              maxLength={2000}
              rows={5}
              defaultValue={kind.event.notes}
            />
          </label>
          <div className="dialog-actions">
            <button className="button primary">{t("saveNote")}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
