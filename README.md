# Open Handball Stats

A lightweight, local-first handball match notebook in the [Open Handball Video](https://github.com/estevE11/open-handball-video) and [Open Handball Board](https://github.com/estevE11/open-handball-tactics) ecosystem. Tag live actions in English or Spanish, keep tactical context, and take your data anywhere.

**Live app:** https://open-handball-stats.vercel.app

## Development

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
npm run test:e2e
```

Browser tests use installed Google Chrome locally. For Chromium, run `npx playwright install chromium` and `CI=1 npm run test:e2e`. The test runner starts the production preview automatically. GitHub Actions runs lint, unit tests, the production build, and browser tests on each push and pull request.

## Live tagging

- The header theme button switches between light and dark appearances. The initial theme uses the device preference; explicit choices persist on this browser. All tagging controls and dialogs support both themes.
- The four-button lower action row contains Possession regained, 7m, sanctions, and manual possession switching (two columns on phones). The center of the second row is Shot blocked, with Technical fault to its right. Only Technical fault and Sanctions show a top-right arrow to indicate a dialog.
- Dialogs close when tapping the backdrop or pressing Escape. Unsaved edits are discarded when dismissed.
- Header language toggle switches all interface terminology instantly and remembers EN/ES on this browser. Team names are user data and are not translated.
- The scoreboard glows in the current attacking team’s color and follows automatic flips, manual switches, and undo. An oversized, clipped handball sits behind the attacking team and slides/rotates to the other side with a soft arrival bounce. Reduced-motion preferences disable the movement.
- Start/pause or adjust the cumulative match clock using independent digit inputs with up/down buttons and keyboard arrow support. Its persisted wall-clock anchor avoids drift when the page is throttled or refreshed. The clock continues while the app is closed until you pause it. Moving to the next period pauses the clock without resetting elapsed match time; the clock remains paused after undoing a period change.
- Select **Static**, **Counterattack**, or **Counterattack attempted** above the action grid. Every possession flip resets this to Static.
- **Goal**, **Keeper save**, **Off-target / post**, **Steal**, and a chosen **Technical fault** end a possession. Events record the attacking and defending teams and tactics **before** the flip. Goals alone increase the score.
- **Shot blocked**, **Possession regained**, **7m penalty**, and **Cards & suspensions** retain the current possession and phase. A blocked shot records the defensive block without assuming a change of possession; use Switch possession if the defending team wins the ball. A 7m tag records an award, not a scored goal: log the shot result separately. The sanctions team toggle defaults to the defending team each time the dialog opens. Sanctions identify the sanctioned team and support two-minute exclusions and yellow/red/blue cards.
- **Possession regained** keeps the _currently displayed attacker_. To correct a preceding shot's auto-flip, undo that shot first or use Switch possession; the rebound action never silently reverses the preceding event.
- Tactical selectors use sliding selection highlights, with reduced-motion preferences respected.
- Each team's last defense is independent: 6:0, 5:1, 4:2, 3:2:1, 3:3, Individual, or Other / 5+1. Switching possession restores the new defender's saved formation.
- **Undo** restores the last event, tactical selection, clock adjustment, period change, or note edit. It restores score and possession together without rewinding a running clock for ordinary tags. The last 50 changes are saved per match as a compact action journal, so undo survives reloads and reopening a match. Older or imported matches without a journal (and events preceding the retained journal) support last-event undo using the recorded possession and tactical context; this fallback keeps the current clock and period.
- **Switch possession** logs an explicit override. The event stream includes matching action icons, a pale team-colored edge (the sanctioned team for sanctions, the attacking team for other events), and comment buttons for note edits. My matches keeps previous sessions; creating or importing a match never deletes earlier ones. Opening another match pauses the current clock.

## Portable data

The version 1 types and runtime validation live in `src/types/match.ts`. Stable team IDs are `home` and `away`. The requested match schema is extended with `schemaVersion`, match clock/period/attack state, optional event team IDs, `SHOT_BLOCKED`, `SANCTION`, `POSSESSION_SWITCH`, sanction subtypes, and the sanctioned team ID. Score is derived from goal events, so undo cannot leave stale score counters.

### CSV

UTF-8 with a BOM, CRLF rows, quoted fields, and these columns:

```text
id, match_id, possession_index, period, game_time_seconds, timestamp,
attacking_team, defending_team, attack_phase, defense_system, event_type,
sub_type, is_possession_flipped, sanction_team, notes
```

Enums use stable English codes regardless of interface language. `timestamp` is ISO 8601 UTC; `game_time_seconds` is the cumulative match clock. Names and notes beginning with spreadsheet formula triggers are prefixed with an apostrophe. JSON preserves original strings exactly.

### JSON

Complete, versioned match snapshots with events, tactics, teams, and a paused clock. Exporting does not pause your live match. Import validates the entire document, rejects inconsistent identifiers/subtypes and unsupported versions, and creates a **separate match with new IDs**. Imports are limited to 20 MiB and 100,000 events. Files never leave the browser.

### XML

Sportscode interchange XML uses `<file>`, `<ALL_INSTANCES>`, `<instance>`, `<ROWS>`, row codes, and grouped tactical labels. Clips cover five seconds before and three seconds after an event (start clamped at zero). The export dialog accepts a video offset in seconds.

This targets the Sportscode/XML import path documented by [Nacsport](https://www.nacsport.com/Manuals/pdf/Nacsport_Pro_Manual_EN.pdf) and [LongoMatch](https://longomatch.com/en/longomatch/). It is not a proprietary project file. XML syntax and fields are covered by tests; imports into installed versions of those commercial applications have not been tested. Availability depends on the receiving software version/license.

**Time alignment:** the clock is cumulative playing time, not a camera timecode. A constant offset aligns a continuous segment. Stoppages, halftime, or an edited recording can need further alignment in the receiving editor. Real UTC timestamps are retained as descriptors.

## Architecture

```text
src/
  components/
    app/
      TaggingPanel.tsx    Attack/defense selectors and event actions
      EventStream.tsx     Live event history and note editing
      MatchDialogs.tsx    Match library, setup, exports, sub-tags, clock
    ui/Modal.tsx         Native accessible dialog and focus management
  hooks/useTranslation.ts
  locales/
    en.json              English terminology
    es.json              Spanish terminology
  lib/
    matchHistory.ts      Compact undo journal and last-event fallback
    matchEngine.ts       Pure possession transitions, scoring, clock
    browserStorage.ts    Dexie database and atomic active-match saves
    exportService.ts     CSV, JSON, Sportscode XML, validated import
  store/
    matchStore.ts        Zustand state, bounded undo, serialized autosave
    preferencesStore.ts  Language preference
  types/match.ts         TypeScript types and Zod runtime validation
  App.tsx                Match lifecycle, scoreboard, language, PWA
  index.css              Tailwind and responsive ecosystem styling
public/                  Bundled Open Handball ecosystem icons
e2e/                     Production tagging, portability, layout, offline tests
.github/workflows/ci.yml Automated quality checks
vite.config.ts           Vite, React, PWA manifest, offline precaching
vercel.json              Static build and service-worker cache headers
```

React 19, TypeScript, Vite, Tailwind CSS, Lucide, Zustand, and Dexie follow the sibling projects' stack and folder conventions. The shared local ecosystem icon is reused from Board. There are no runtime network APIs, external fonts, analytics, accounts, or cloud databases.

## Storage and offline use

Dexie database `ohm.library.v1` has `matches` and `settings` tables. Each save updates the match, its undo journal, and active-match pointer in one transaction. Undo journals use `undo:<match-id>` keys in the existing settings table, so existing databases need no schema migration. Saves are serialized so rapid actions cannot overwrite newer state with older writes. A failed save keeps the in-memory match and exposes Retry and JSON export. The UI reports loading, saving, saved, and error states; pending/failed saves guard page exit. Use one editing tab per browser profile: cross-tab conflict resolution is not implemented.

Browser storage belongs to the site's origin, device, and browser profile. Clearing it removes matches. Export JSON backups regularly. The footer storage button requests persistence; the browser may decline. Private browsing storage can be temporary.

Open the production app online once and wait for **Ready offline** before disconnecting. The application shell and icons are precached using [Vite PWA's prompt update flow](https://vite-pwa-org.netlify.app/guide/prompt-for-update). Offline tests verify reload, tagging, saving, and another reload with networking disabled. Development mode does not provide the production service worker. An available update is applied only after saves finish and the match clock is paused.

## Deployment

The public GitHub repository is connected to Vercel. Production serves only static app files; match data never goes to Vercel. No environment variables or runtime secrets are required.

```sh
vercel link --project open-handball-stats
vercel deploy --prod --yes
```

Use the stable production hostname to retain the same browser library across deployments. Preview hostnames have separate local data.

## License

MIT.
