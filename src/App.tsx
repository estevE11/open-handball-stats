import { Modal } from "./components/ui/Modal";
import { PossessionBall } from "./components/app/PossessionBall";
import { usePreferencesStore } from "./store/preferencesStore";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  BarChart3,
  Menu,
  Activity,
  Moon,
  Sun,
  ChevronRight,
  Download,
  FolderOpen,
  HardDrive,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Upload,
  WifiOff,
} from "lucide-react";
import { useTranslation, type TranslationKey } from "./hooks/useTranslation";
import { useMatchStore, flushSaves } from "./store/matchStore";
import { formatTime, gameSeconds, score, teamOf } from "./lib/matchEngine";
import { importJSON } from "./lib/exportService";
import { TaggingPanel } from "./components/app/TaggingPanel";
import { EventStream } from "./components/app/EventStream";
import { MatchDialogs, type DialogKind } from "./components/app/MatchDialogs";

const ReportPage = lazy(() => import("./components/report/ReportPage"));

export default function App() {
  const [reportOpen, setReportOpen] = useState(
    () => location.hash === "#report",
  );
  useEffect(() => {
    const onHash = () => {
      setReportOpen(location.hash === "#report");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const { theme, setTheme } = usePreferencesStore();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#171d1a" : "#fafafa");
  }, [theme]);
  const store = useMatchStore();
  const { match } = store;
  const { t, language, setLanguage } = useTranslation();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"menu" | "events" | null>(
    null,
  );
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [now, setNow] = useState(Date.now);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisterError: () => setNotice("pwaError") });
  useEffect(() => {
    void useMatchStore.getState().initialize();
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const protect = (e: BeforeUnloadEvent) => {
      if (["saving", "error"].includes(useMatchStore.getState().saveStatus)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeunload", protect);
    };
  }, []);
  async function importFile(file: File) {
    setImporting(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Too large");
      const next = importJSON(await file.text());
      const current = useMatchStore.getState();
      if (current.match.clockStartedAt !== null) current.toggleClock();
      await flushSaves();
      if (useMatchStore.getState().saveStatus !== "saved") {
        setNotice("saveError");
        return;
      }
      store.replace(next);
      await flushSaves();
      if (useMatchStore.getState().saveStatus !== "saved")
        setNotice("saveError");
      else setNotice("importSuccess");
    } catch {
      setNotice("importError");
    } finally {
      setImporting(false);
      if (input.current) input.current.value = "";
    }
  }
  async function protectStorage() {
    try {
      setNotice(
        (await navigator.storage?.persist?.())
          ? "persistGranted"
          : "persistDenied",
      );
    } catch {
      setNotice("persistDenied");
    }
  }
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const closeMobilePanel = () => {
      if (query.matches) setMobilePanel(null);
    };
    query.addEventListener("change", closeMobilePanel);
    return () => query.removeEventListener("change", closeMobilePanel);
  }, []);
  function openDialog(kind: DialogKind) {
    setMobilePanel(null);
    setDialog(kind);
  }
  const headerContent = (
    <>
      <a className="brand" href="/" aria-label={t("appName")}>
        <img src="/icon.svg" alt="" />
        <div>
          Open Handball <b>Stats</b>
          <span>{t("tagline")}</span>
        </div>
        <small>v0.1</small>
      </a>
      <div className="header-actions">
        <button
          className="icon-button theme-toggle"
          aria-label={t(theme === "dark" ? "lightMode" : "darkMode")}
          title={t(theme === "dark" ? "lightMode" : "darkMode")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <div
          className="language-toggle"
          role="group"
          aria-label="Language / Idioma"
        >
          {(["en", "es"] as const).map((lang) => (
            <button
              key={lang}
              aria-pressed={language === lang}
              onClick={() => setLanguage(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          className="button secondary"
          disabled={!store.ready}
          onClick={() => openDialog("library")}
        >
          <FolderOpen size={17} />
          <span>{t("matches")}</span>
        </button>
        <button
          className="button primary"
          disabled={!store.ready}
          onClick={() => openDialog("new")}
        >
          <Plus size={17} />
          <span>{t("newMatch")}</span>
        </button>
      </div>
    </>
  );
  const matchInfo = (
    <div>
      <div className="eyebrow">
        {t("liveWorkspace")}
        <span>/</span>
        <span>{t("localFirst")}</span>
      </div>
      <h1>{match.matchName}</h1>
      <div className="match-meta">
        {match.competition && (
          <span className="competition">{match.competition}</span>
        )}
        <span>
          {new Date(match.date).toLocaleDateString(
            language === "es" ? "es-ES" : "en-GB",
            { day: "numeric", month: "short", year: "numeric" },
          )}
        </span>
        <span className="save-status" role="status">
          <span className={`tiny-dot ${store.saveStatus}`} />
          {t(
            store.saveStatus === "loading"
              ? "loading"
              : store.saveStatus === "error"
                ? "saveError"
                : store.saveStatus,
          )}
        </span>
      </div>
    </div>
  );
  const workspaceActions = (
    <div className="workspace-actions">
      <button
        className="button secondary"
        disabled={!store.ready}
        onClick={() => {
          setMobilePanel(null);
          location.hash = "report";
        }}
      >
        <BarChart3 size={16} />
        {t("report")}
      </button>
      <button
        className="button secondary"
        disabled={importing || !store.ready}
        onClick={() => input.current?.click()}
      >
        <Upload size={16} />
        {t("import")}
      </button>
      <button
        className="button primary"
        disabled={!store.ready}
        onClick={() => openDialog("export")}
      >
        <Download size={16} />
        {t("export")}
      </button>
    </div>
  );
  const footerContent = (
    <>
      <button
        className="button plain storage-button"
        onClick={() => {
          setMobilePanel(null);
          void protectStorage();
        }}
        title={t("persistent")}
      >
        {offline ? <WifiOff size={14} /> : <ShieldCheck size={14} />}{" "}
        {offline
          ? t("offline")
          : offlineReady
            ? t("offlineReady")
            : t("localStorage")}
      </button>
      <span className="footer-ecosystem">
        {t("ecosystem")}
        <a
          href="https://open-handball-video.vercel.app"
          target="_blank"
          rel="noreferrer"
        >
          {t("video")} ↗
        </a>
        <a
          href="https://open-handball-tactics.vercel.app"
          target="_blank"
          rel="noreferrer"
        >
          {t("board")} ↗
        </a>
      </span>
      <span className="footer-data">
        <HardDrive size={13} />
        {t("allLocal")}
      </span>
    </>
  );
  const running = match.clockStartedAt !== null;
  return (
    <div className={`app-shell ${reportOpen ? "report-view" : ""}`}>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label={t("import")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setMobilePanel(null);
            void importFile(file);
          }
        }}
      />
      <div className="mobile-toolbar">
        <button
          className="icon-button"
          aria-label={t("openMenu")}
          aria-haspopup="dialog"
          aria-expanded={mobilePanel === "menu"}
          onClick={() => setMobilePanel("menu")}
        >
          <Menu size={21} />
        </button>
        <div className="mobile-match-title">
          <strong title={match.matchName}>{match.matchName}</strong>
          <span>
            <i className={`tiny-dot ${store.saveStatus}`} />
            {t(
              store.saveStatus === "error"
                ? "saveError"
                : store.saveStatus === "loading"
                  ? "loading"
                  : store.saveStatus,
            )}
          </span>
        </div>
        <button
          className="button secondary mobile-events-button"
          aria-label={t("liveEvents")}
          aria-haspopup="dialog"
          onClick={() => setMobilePanel("events")}
        >
          <Activity size={18} />
          <span>{match.events.length}</span>
        </button>
      </div>
      <header className="topbar">{headerContent}</header>
      {notice && (
        <div className="notice" role="status">
          <span>{t(notice)}</span>
          <button
            className="button plain"
            aria-label={t("dismissNotice")}
            onClick={() => setNotice(null)}
          >
            {t("close")}
          </button>
        </div>
      )}
      {store.saveStatus === "error" && (
        <div className="notice error" role="alert">
          <span>{t("saveError")}</span>
          <button className="button secondary" onClick={store.retry}>
            {t("retry")}
          </button>
        </div>
      )}
      {needRefresh && (
        <div className="notice">
          <span>{t("update")}</span>
          <button
            className="button secondary"
            disabled={store.saveStatus !== "saved" || running}
            onClick={() =>
              void flushSaves().then(() => {
                if (useMatchStore.getState().saveStatus === "saved")
                  return updateServiceWorker(true);
              })
            }
          >
            {t("updateNow")}
          </button>
        </div>
      )}
      {reportOpen ? (
        <Suspense fallback={<p className="report-loading">{t("loading")}</p>}>
          <ReportPage
            key={match.id}
            match={match}
            onBack={() => {
              location.hash = "";
            }}
          />
        </Suspense>
      ) : (
        <main className="workspace">
          <div className="workspace-heading">
            {matchInfo}
            {workspaceActions}
          </div>
          <fieldset
            className="match-workspace"
            disabled={!store.ready || importing}
          >
            <div
              className="scoreboard"
              data-attacker={match.currentAttackingTeamId}
              style={
                {
                  "--possession-color": teamOf(
                    match,
                    match.currentAttackingTeamId,
                  ).color,
                } as CSSProperties
              }
            >
              <PossessionBall />
              <span className="sr-only" role="status">
                {teamOf(match, match.currentAttackingTeamId).name}{" "}
                {t("attacking")}
              </span>
              <div
                className={`score-team home ${match.currentAttackingTeamId === "home" ? "has-ball" : ""}`}
              >
                <div
                  className="team-avatar"
                  style={{ background: match.homeTeam.color }}
                >
                  {match.homeTeam.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <small>{t("home")}</small>
                  <strong>{match.homeTeam.name}</strong>
                  <span>
                    {t(
                      match.currentAttackingTeamId === "home"
                        ? "attacking"
                        : "defending",
                    )}
                  </span>
                </div>
                <b data-testid="home-score">{score(match, "home")}</b>
              </div>
              <div className="clock-panel">
                <div className="period-label">
                  <span className={running ? "live-dot" : "paused-dot"} />
                  {t("period")} {match.period}
                  <span>·</span>
                  {t(running ? "running" : "paused")}
                </div>
                <button
                  className="clock"
                  onClick={() => setDialog("clock")}
                  aria-label={t("editClock")}
                >
                  {formatTime(gameSeconds(match, now))}
                </button>
                <div className="clock-controls">
                  <button
                    className="button clock-toggle"
                    onClick={store.toggleClock}
                  >
                    {running ? <Pause size={13} /> : <Play size={13} />}{" "}
                    <span>{t(running ? "pause" : "start")}</span>
                  </button>
                  <button
                    className="icon-button"
                    disabled={match.period >= 20}
                    onClick={() => setDialog("period")}
                    aria-label={t("nextPeriod")}
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>
              <div
                className={`score-team away ${match.currentAttackingTeamId === "away" ? "has-ball" : ""}`}
              >
                <b data-testid="away-score">{score(match, "away")}</b>
                <div>
                  <small>{t("away")}</small>
                  <strong>{match.awayTeam.name}</strong>
                  <span>
                    {t(
                      match.currentAttackingTeamId === "away"
                        ? "attacking"
                        : "defending",
                    )}
                  </span>
                </div>
                <div
                  className="team-avatar"
                  style={{ background: match.awayTeam.color }}
                >
                  {match.awayTeam.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
            <div className="editor-layout">
              <TaggingPanel
                onFault={() => setDialog("fault")}
                onSanction={() => setDialog("sanction")}
              />
              <EventStream onEdit={(event) => setDialog({ event })} />
            </div>
          </fieldset>
        </main>
      )}
      <footer className="app-footer">{footerContent}</footer>
      {mobilePanel === "menu" && (
        <Modal
          title={t("menu")}
          variant="drawer"
          onClose={() => setMobilePanel(null)}
        >
          <nav className="mobile-menu" aria-label={t("menu")}>
            {headerContent}
            {matchInfo}
            {workspaceActions}
            <div className="mobile-menu-footer">{footerContent}</div>
          </nav>
        </Modal>
      )}
      {mobilePanel === "events" && (
        <Modal
          title={t("liveEvents")}
          className="events-modal"
          onClose={() => setMobilePanel(null)}
        >
          <EventStream onEdit={(event) => setDialog({ event })} />
        </Modal>
      )}
      {dialog && (
        <MatchDialogs
          key={typeof dialog === "object" ? dialog.event.id : dialog}
          kind={dialog}
          onClose={() => setDialog(null)}
          onImport={() => input.current?.click()}
        />
      )}
    </div>
  );
}
