# Athan

**Browser app:** [Open Athan](https://blankmediator.github.io/athan/). After the first download shows **Available offline**, prayer times, calendars, readings, locations and the seven default recordings remain available without reception. Each browser profile stores its own settings and recordings. See [GitHub Pages and custom-domain setup](docs/GITHUB_PAGES.md).

**Android and iOS:** native Capacitor projects are in `android/` and `ios/`. The Android test APK is `output/mobile/Athan-Android.apk`; rebuild it with **Build Android.cmd**. See [mobile installation and build instructions](docs/MOBILE.md), including notification coverage, background-audio limits, and iOS signing on a Mac.

A native Windows prayer companion with a calm ivory-and-green interface, an offline calculation core, and a full command-line interface. The desktop interface uses the same tested calculations and scheduler as the CLI.

Desktop configuration is in `.athan/config.json`. The initial profile uses **Coburg, Victoria**, **Australia/Melbourne**, **Muslim World League**, and standard **Shafi Asr**. Choose your own location and calculation settings on first use; later choices are saved locally. Desktop audio can reference existing recordings.

Read [the feature assessment](docs/FEATURE_ASSESSMENT.md) for the comparison and remaining differences.

Read [Calculations and timing retrieval](docs/CALCULATIONS.md) for how each prayer time, night fraction, countdown, Qibla bearing, and Hijri date is calculated, where location data comes from, and how alerts are scheduled. The guide includes preset angles, adjustment order, time-zone handling, and a reproducible example.

## Open the desktop app

Double-click **Athan.lnk** (the Athan shortcut) or **Open Athan.cmd** in this folder, or run:

```powershell
cd D:\Athan
npm.cmd run gui
```

The launcher works from any directory and avoids PowerShell's unsigned `npm.ps1` wrapper. It opens the app directly; no web server is needed. Keep the project folder and `node_modules` together.

- **Today:** live next-prayer countdown, all six daily times, a Duha/Ishraq window, individual prayer switches, a dedicated **Stop Athan** button, Qibla preview, and the last third of the night.
- **Calendar:** switch between real Gregorian and Hijri months, a two-way date converter, daily timetables, Ramadan shading, and a separate list of Islamic events that jumps to the selected date. Includes printable PDF calendars and CSV/ICS export through a Windows save dialog.
- **Qibla:** a precise bearing from true north, with optional live Windows compass orientation when a sensor provides true north. Magnetic-only readings stay clearly labelled and leave the calculated dial fixed.
- **Athan & sounds:** per-prayer recording choices, native file selection that opens in the selected recording’s folder, 20-second previews, volume and dua after Athan.
- **Reminders:** create, edit, enable, and remove reminders before or after any prayer, with optional repeated recordings. Separate daily hadith and dua readings have their own times and default to off.
- **Hisnul Muslim:** the complete 132-chapter, 268-entry edition (including 75a and 75), with Arabic, English meanings, transliteration where supplied, original references and Sunnah.com links, numbered search, favorites, copying and a recitation counter. Includes 12 sourced daily hadith reflections.
- **Hadith library:** optional offline packs covering 17 collections and 51,776 source records, assembled from three public Sunnah.com datasets. No API key is required. Browse books and mapped chapters, search text/grades/references, and inspect original wording, source links and provenance. Missing metadata and partial Musnad Ahmad coverage are explicit.
- **Settings:** country-then-city selection, a worldwide offline catalogue, saved locations, manual coordinates and time zone, optional online search, all calculation presets, Asr, adjustments, advanced angles, Hijri correction, time format, weekly prayer days, Bismillah on startup, themes, notifications, tray behavior, and sign-in startup.
- **Activity & health:** recent delivery history and checks for missing or invalid recordings.

Automatic Athan starts **paused** on first use. Click **Enable Athan** to start it; your choice is remembered next time. Exit the original Athan before enabling daily playback here. By default, closing the window while alerts are enabled leaves Athan running in the system tray. Double-click the tray icon to reopen it, or choose **Quit Athan** to stop it completely. With close-to-tray enabled, daily reading reminders also keep the app in the tray even when prayers are paused. With prayers and daily readings off, closing exits the app.

Hover over the tray icon for four lines: **Athan · location**, **Current prayer**, **Next prayer · scheduled local time**, and **Remaining time**. Current means the most recently started of the five named prayers, including yesterday's Isha before Fajr; it is not a statement about the end of a prayer's valid time. The countdown always follows the next prayer, independently of sound switches, reminder offsets or selected weekdays. It updates every second in the tray, shows seconds in the last minute, and respects tomorrow labels and 12/24-hour formatting.

During a prayer or reminder, click **Stop Athan** beneath the home-page countdown, **Dismiss / stop sound** in the app or notification, or right-click the tray icon and choose **Dismiss / stop sound**. This stops the current recording, remaining dua and repeats, and clears current alerts without pausing future prayers or changing sound settings. Closing a Windows notification manually also dismisses that alert; a notification simply timing out does not stop playback. The app/tray control also stops a sound preview or startup Bismillah. The home button is disabled when nothing is active. Dismissed scheduled calls appear as **Dismissed** in Activity and are not replayed after restarting.

In **Calendar**, select **Gregorian** or **Hijri** and use **Go to month**, convert a Gregorian or Hijri date, or choose a row under **Key Islamic events** to select its day in the main calendar. Events include Ramadan, its last ten nights, the commonly observed Laylat al-Qadr date, both Eids, Hajj, Arafah, Islamic New Year, Ashura and tradition-specific observances. Dates use Umm al-Qura and your saved Hijri correction. They remain estimates subject to local moon sightings; an Islamic date begins at the preceding sunset.

Choose **Calendar → Export calendar → Save PDF** for an ivory, green and gold print layout with embedded fonts and your saved location:

- **Monthly prayer timetable:** one A4 page with all six times and the Duha/Ishraq window, both dates, Friday shading and event notes.
- **Ramadan timetable:** one A4 page covering the complete Hijri month, with Fajr/suhoor and Maghrib/iftar highlighted.
- **Year at a glance:** one A3 landscape page with twelve Gregorian/Hijri month grids, Ramadan shading and an event list.
- **Full year of prayer times:** twelve A4 pages, one timetable per month.

Month and year exports follow the selected calendar: a Hijri month is 29/30 days, and a Hijri year contains its twelve lunar months. CSV and ICS use the same selected month boundaries. After saving, choose **Open file** or **Show in folder**. The events list centres today’s first event or the next upcoming event on initial load.

PDFs are generated offline, with automatic local daylight saving, the saved time format and calculation settings. The desktop calendar and PDF picker support Gregorian years 1901–2098. CSV and ICS remain under **Other formats** in the export dialog. Print at actual size on the indicated paper, or fit to the printer's printable area.

In **Settings → Location → Use device location**, request a position from Windows, review the exact coordinates, accuracy and suggested nearby city's time zone, then choose **Use these coordinates → Save changes**. No location request is made automatically. The time zone is a nearest-city suggestion, so review it near borders. Windows privacy settings and available hardware determine whether a position can be returned; country/city and manual entry remain available. In **Qibla**, use **Use device compass** to start the sensor and **Stop device compass** to release it. It also stops when leaving Qibla or hiding the window. Stale readings revert to the calculated bearing. Keep the device flat, with its normal top edge ahead. Athan does not change Windows privacy settings.

**Hisnul Muslim** uses the complete numbered Sunnah.com edition supplied in the user-selected [majmoo-io repository](https://github.com/majmoo-io/hisnu-al-muslim-data), pinned to revision `8786672f2a89115f13d5a27765066378993bd358`. References, instructions and source URLs accompany every entry. Arabic and English are the source-text languages; changing the interface language preserves those texts. The source metadata and AGPL-3.0 licence are in [assets/devotion/hisn](assets/devotion/hisn). The older selection files are retained as legacy source material and are no longer the displayed library.

**Hadith library** offers public collection packs without an API key. Downloads stay locally in `.athan/hadith` (IndexedDB in the browser); existing readings survive cancellation or failed validation. Packs retain original Arabic and published English, source grades, references and direct Sunnah.com links. The interface language changes controls, not source wording. Book/chapter browsing only uses supplied mappings. See [dataset sources and limitations](docs/hadith-data-sources.md) and [the pack manifest](assets/hadith/manifest.json). Browser/LAN packs are served from your local Athan server; after downloading, reading works offline. No collection is automatically installed in your reading library.

The **globe icon** language selector above the location button offers device language, English, Arabic, Urdu, Turkish, Indonesian and French. Device language is the default, with English fallback. All languages retain the same navigation and panel layout. Arabic and Urdu text uses a bundled Noto Sans Arabic font and natural text direction. Dates and PDF headings follow the selected language; original reading texts and unrecognised system/provider diagnostics keep their source language.

**Settings → App preferences → Bismillah on startup** is off by default. It plays once when the desktop app launches, including Windows sign-in if **Open when I sign in** is enabled. Pausing/resuming prayers or saving calculation settings does not replay it. Startup sound follows the master audio switch and volume and can be stopped from the home page. Windows sign-in startup remains a separate preference.

**Duha / Ishraq** is an estimated voluntary prayer window, initially 20 minutes after astronomical sunrise until 10 minutes before solar noon. Both margins can be adjusted in **Prayer calculation**. Prayer-time corrections do not move these astronomical margins, and Duha does not add an automatic Athan. Unavailable/polar sunrise gives an unavailable window. See [timing guidance](https://daruliftabirmingham.co.uk/timing-for-salatul-ishraq/).

In **Reminders**, turn on **Daily hadith** or **Daily dua** and choose each time separately. Both start off. They follow the saved location's time zone, independently of prayer calls, and deliver silently once per local day. If today's time has passed, the reading appears once when enabled or when the app next opens; previous days are not queued. Readings appear in the app and, if enabled, as Windows notifications. **Open reading** opens its full entry; **Dismiss reading** clears it. Notification clicks also open the entry. Restarting or the autumn daylight-saving clock repeat does not repeat a reading. These are desktop app reminders; the CLI scheduler does not deliver them.

Settings changes use **Save changes**. Theme, tray, notification, sign-in, and alert switches take effect immediately. Saving settings while desktop alerts run restarts the scheduler without repeating the startup recording. Sound previews use the saved volume. The app uses your existing recordings in place; choose replacement files before removing the original installation.

Desktop preferences live in `.athan/desktop.json`; prayer configuration and event history are shared with the CLI. The app can pause a CLI scheduler using the same state directory; pause it before editing settings. Desktop sign-in startup and the CLI's `startup enable` are separate mechanisms, so use one. A running PC and awake Windows session are required for alerts.

Reference texts, legacy catalogue import, and LAN receiver controls remain available through the CLI, alongside its date conversion and CSV/ICS exports. This is a working local desktop build; an installer and automatic updater are not included.

## Serve the app locally in a browser

Double-click **Serve Athan.bat** (or **Open Athan Browser.cmd**). It starts a server on this PC and opens your default browser at **http://127.0.0.1:4173/**. Keep the server window open; close it or press **Ctrl+C** to stop serving. Opening the launcher again reopens the existing Athan server. The launcher works from any directory, uses `npm.cmd` when needed, and builds the browser files automatically if they are missing. Node.js 24 or newer is required; a fresh checkout needs `npm.cmd ci` first.

To start without automatically opening a browser, run `".\Serve Athan.bat" --no-open` from Command Prompt, or `& '.\Serve Athan.bat' --no-open` from PowerShell. The equivalent cross-platform server command is `npm.cmd run browser` on Windows (`npm run browser` elsewhere).

If port 4173 is occupied by another program, choose a fixed alternative in PowerShell:

```powershell
cd D:\Athan
$env:ATHAN_BROWSER_PORT = '4174'
& '.\Serve Athan.bat'
```

The batch launcher binds only to `127.0.0.1`. Browser settings and imported recordings are stored separately from the desktop app, per browser and address/port; use the same address each time. Keep the browser tab open and the PC awake for browser prayer playback. The desktop app continues to provide its system-tray and background scheduling features. After editing app code, rebuild with `npm.cmd run build:browser`, then reload the browser.

### Use another device on your LAN

The LAN launcher now automatically uses your matching `D:\Certificates\athan-cert.pem` and `D:\Certificates\athan-key.pem` pair. It also supports a portable `certificates` folder beside the app; explicit `ATHAN_TLS_CERT` and `ATHAN_TLS_KEY` settings take priority. It validates the pair and dates, opens an address covered by the certificate, and keeps the key outside the served directory. Your supplied certificate covers `192.168.50.36`, `100.75.251.128` and `172.21.32.1`; the normal LAN address is **https://192.168.50.36:4174/**. Trust the certificate on each connecting device. Localhost mode stays at **http://127.0.0.1:4173/** because the supplied certificate does not cover localhost. Pass `--http` to explicitly run without TLS.

Double-click **Serve Athan LAN.bat**. It listens on all IPv4 interfaces on **port 4174**, opens the app on this PC, and prints the addresses for your Ethernet/Wi-Fi connections. Open the appropriate printed address on a phone, tablet or computer on the same network. Keep the PC awake and the server window open. If Windows Firewall prompts, allow Node.js on the private network you intend to use. Guest Wi-Fi or client isolation may prevent devices from reaching one another.

The LAN launcher shares the browser app files; it does not expose your `.athan` folder, desktop settings, history or recordings. Each browser has its own saved settings. Local mode remains on port 4173, so both launchers can run together. Use `Serve Athan LAN.bat --no-open` to skip opening a browser, or `npm.cmd run browser:lan` to run the server directly. `ATHAN_BROWSER_PORT` overrides the port for either launcher.

**HTTP LAN mode supports prayer times, calendars, PDF/CSV export and readings.** On other devices, automatic prayer playback, ICS export, offline reopening, notifications and device location/compass require a secure browser context. Browsers treat localhost as secure but ordinary HTTP LAN addresses as insecure ([browser secure-context rules](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)). The desktop app continues scheduling on this PC independently.

For HTTPS, supply a PEM certificate and private key. The certificate must cover the IP address or hostname used by clients and be trusted by each device:

```powershell
cd D:\Athan
$env:ATHAN_TLS_CERT = 'D:\Certificates\athan-cert.pem'
$env:ATHAN_TLS_KEY = 'D:\Certificates\athan-key.pem'
& '.\Serve Athan LAN.bat' --no-open
```

Open the matching `https://` address printed by the launcher. These are example certificate paths; the launcher does not generate or install certificates or change firewall settings. Keep certificate/private-key files outside `browser-ui`, which is the publicly served directory. Remove `ATHAN_TLS_CERT` and `ATHAN_TLS_KEY` from the shell environment to return to HTTP.

### Offline use in both versions

**Default browser recordings now download automatically.** Each browser profile stores all seven recordings as MP3 audio blobs with integrity checks, and the app includes them in its offline cache. A fresh browser selects the same default voices as the original desktop setup; existing selections, custom files and deliberate silent choices are preserved. Wait for **Available offline** before disconnecting. The first audio download is about 10.5 MB. Failed or interrupted downloads retry on reconnection or reload; prayer calculations remain available while audio is downloading.

For the public browser deployment and custom subdomain setup, see [GitHub Pages](docs/GITHUB_PAGES.md). Public HTTPS is supplied by GitHub; your local private key is never uploaded.

The desktop app stores its settings, locations, readings and history on disk, bundles its fonts and full city catalogue, and calculates new prayer times, Qibla and calendars without an internet connection. Recordings are played from their saved local paths. Successful online city searches are also saved in `.athan/location-search-cache.json`; if reception drops, repeating that search returns the saved results with a visible date and cached-result message. The cache retains the 100 most recent queries.

In the browser, open the app once on **localhost or trusted HTTPS**, and wait until the footer says **Available offline**. Open that menu for download status and **Keep offline data**, which requests storage protection from the browser. The first download includes the entire worldwide city catalogue (about 10.5 MB compressed), app code, fonts and bundled readings. Once ready, the same address works after losing reception, reloading or restarting the browser. New days and months are calculated locally, so a cached timetable does not expire at midnight.

Browser settings, saved locations, preferences, reminders, imported audio and downloaded readings use IndexedDB on that device. Successful online city searches are retained there too. Import a recording through **Athan & sounds** to keep a copy in the browser; desktop recording paths are not shared. PDF export uses the browser print dialog’s **Save as PDF** option; CSV and ICS download normally. These exports work offline after setup completes.

Each browser and address/port has its own profile. Clearing site data removes it, private browsing may discard it when closed, and storage protection depends on the browser. A failed initial download is shown in the offline menu; reconnect and reload to retry. App updates download as a complete new cache and activate after all older Athan tabs close, preserving settings and recordings. No account or cloud sync is required.

Browser prayer alerts must be enabled after opening the app. Keep the tab open and device awake; browsers may delay background tabs. Only one tab can run prayer alerts at a time, and delivery claims are saved to prevent duplicates after reload. The desktop app provides the system-tray scheduler for background use.

Verification: `npm.cmd test`, `npm.cmd run test:desktop`, and `npm.cmd run test:browser`. Offline tests use isolated profiles and cover disconnect/reload, a full browser restart, future calendars, saved audio playback, cached searches, failed-download recovery, exports, duplicate suppression and phone layouts.

## Run the command line

Requires Node.js 24 or newer (already present on this PC). From `D:\Athan`:

```powershell
cd D:\Athan
node.exe dist\cli.js times
node.exe dist\cli.js next
node.exe dist\cli.js qibla
node.exe dist\cli.js doctor
```

The program is already built on this PC. To rebuild after source changes, run `npm.cmd run build`. Use `npm.cmd` instead of bare `npm` in Windows PowerShell: bare `npm` may select the unsigned `npm.ps1` wrapper and be blocked by your execution policy. No policy change is needed. The equivalent npm command for today's times is `npm.cmd run athan -- times`.

For automated consumption, use `node dist/cli.js times --json`. That avoids npm's banner. Global options `--config <file>` and `--state <directory>` select alternate profiles. Default paths are relative to your working directory, so run the commands from `D:\Athan` or supply absolute paths.

To recreate a configuration on a fresh installation:

```powershell
npm.cmd ci
npm.cmd run build
node dist/cli.js init
```

`init` refuses to overwrite settings. `init --force` saves the previous file as `.bak` before replacing it. The initial file has no audio unless imported or selected manually.

## Schedule and playback

```powershell
node dist/cli.js plan
node dist/cli.js run --once --dry-run
node dist/cli.js audio test --prayer fajr --seconds 5
node dist/cli.js run
```

`run` remains active until Ctrl+C. It plays the five calls and configured reminders. Exit the original Athan before using the replacement for daily playback to avoid two programs calling together. A running PC and awake Windows session are required; this version does not wake a sleeping computer.

`node dist/cli.js stop` requests graceful shutdown, including active audio, within the polling interval (default five seconds). This also works when the service runs hidden at sign-in. `history` shows delivered, skipped, failed and uncertain (`claimed`) events. Logs are in `.athan/state/events.jsonl`, with a rotated file after 5 MB.

Explicit Windows startup commands:

```powershell
node dist/cli.js startup show
node dist/cli.js startup enable
node dist/cli.js startup disable
```

`show` previews the command. `enable` installs an **Athan Core.lnk** shortcut in your Windows Startup folder to launch the runner hidden. `disable` removes that shortcut; use `stop` to also stop an already running instance. These affect only Athan Core, not the original Athan.

## Settings

Use the desktop settings, or edit `.athan/config.json`, then run `node dist/cli.js validate` and restart the scheduler. A running service reads settings at startup, not continuously.

- `calculation.method`: `MuslimWorldLeague`, `Karachi`, `NorthAmerica` (ISNA), `UmmAlQura`, `Egyptian`, or one of the extra presets from `methods`.
- `calculation.madhab`: `Shafi` (standard) or `Hanafi`.
- `dhuhrAfterNoon` and `maghribAfterSunset`: default 1 minute, matching the legacy help's stated behavior. These replace the library's preset Dhuhr/Maghrib margins. For an angle-based Maghrib preset, the Maghrib margin follows that calculated time.
- `calculation.adjustments`: additional signed minutes for each of the six times. All adjustments apply once.
- `Other` requires a `fajrAngle` plus an `ishaAngle` or positive `ishaInterval`. An explicit `ishaAngle` disables a preset interval unless `ishaInterval` is also supplied.
- `UmmAlQura` automatically increases the sunset-to-Isha interval by `ramadanIshaExtra` during Ramadan (default 30 minutes). Other interval presets do not silently get this change.
- `highLatitudeRule`: `TwilightAngle`, `MiddleOfTheNight` or `SeventhOfTheNight`. `polarResolution`: `Unresolved`, `AqrabBalad` (nearby location) or `AqrabYaum` (nearby date). Unresolved times are shown as unavailable and not scheduled.
- `hijriAdjustment`: -2 through +2 days. Hijri conversion uses ICU's **Umm al-Qura** calendar, not a live moon-sighting feed. Estimated Islamic observances may differ locally.
- `audio.volume`: 0–100; `audio.enabled`: global sound switch. Prayer `enabled` controls that Athan event; independent reminders retain their own enable setting.
- `audio.duaFile` plays after each Athan. `audio.startupEnabled` controls Basmallah when automatic alerts start and defaults to **false**, including older configurations without the setting. In **Athan & sounds**, turn on **Basmallah when alerts start** and save changes to enable it. `audio.startupFile` remembers the recording independently of the switch. `maxPlaybackSeconds` caps each recording at 600 seconds by default.
- `scheduler.days`: allowed weekdays, Sunday = 0. This applies to all events. `network.days` and `network.prayers` further restrict network sends.
- `hour12` and `locale` control time formatting. Existing translation files and interface strings are not copied.

Example reminder (insert inside the `reminders` array):

```json
{
  "id": "before-maghrib",
  "prayer": "maghrib",
  "offsetMinutes": -10,
  "file": "../recordings/recitation.mp3",
  "repeat": 1,
  "enabled": true
}
```

Positive offsets play after a prayer, negative offsets before it. A null file gives a silent reminder (logged in the CLI, with an optional notification in the desktop app). Paths are relative to the configuration file, not the shell. Every reminder needs a unique stable ID. An arriving Athan interrupts an active reminder or startup recording. Two Athans never mix; a queued call that has become too late fails visibly in history.

```powershell
node dist/cli.js audio set fajr "D:\Recordings\fajr.mp3"
node dist/cli.js audio mute isha
node dist/cli.js audio mute isha --off
```

## Locations, import and calendars

In **Settings → Location**, choose **Country or territory**, then select a **City**. Type in **Filter cities** to narrow the list by city, suburb, region, or alternate name; **Show more cities** loads the next 200 matches. Selecting a city fills its coordinates and IANA time zone. Click **Save changes** to use it for prayer times and alerts.

The desktop catalogue contains **235,803 cities and towns across 246 countries and territories**, with 250 country/territory choices overall. It works without internet access. Four territories have no cities in the source dataset. Coverage follows GeoNames' cities500 selection: places with over 500 residents and administrative seats, so it does not include every settlement. Source, licence and rebuild instructions are in [the catalogue notes](assets/locations/README.md).

For additional places or postal codes, type a name and click **Search online**. Only this action contacts Open-Meteo, sending the typed query and selected country. Changing the country or query clears old online results, and an online failure leaves the built-in cities available. Any location can also be entered manually by coordinates with an IANA time zone. The CLI retains its small starter list and can search the existing Athan catalogue in place.

```powershell
node dist/cli.js locations list
node dist/cli.js locations search Sydney
node dist/cli.js locations search "Coburg, Victoria" --online --country-code AU
node dist/cli.js locations search Coburg --legacy-root "C:\Program Files (x86)\Athan" --country Australia
node dist/cli.js locations add --id sydney --name Sydney --country Australia --lat -33.8688 --lon 151.2093 --timezone Australia/Sydney
node dist/cli.js locations use sydney
```

Online search uses Open-Meteo/GeoNames and returns coordinates plus an IANA zone. Only an explicit `--online` search uses the internet; saved locations and prayer calculations remain offline. Search results include attribution. The public endpoint is for noncommercial use. Add the chosen result with `locations add`. The legacy catalogue's numeric UTC offsets are reference only: select a modern IANA time zone when adding its results. The original proprietary six-million-city database is not bundled.

Desktop online lookup uses Electron's Chromium network stack, which respects Windows networking and proxy settings. Live searches for **Berlin (Germany), London (United Kingdom), and Sydney (Australia)** were verified through the desktop picker. Entries with missing or invalid time zones are skipped without discarding valid results. Network errors are shown explicitly and do not affect offline prayer times. CLI online lookup uses Node's network stack and may behave differently on restricted networks.

To import the legacy selected city and recording choices into a **new** config:

```powershell
node dist/cli.js --config .athan/imported.json init --from-legacy "C:\Program Files (x86)\Athan" --timezone Australia/Melbourne --method MuslimWorldLeague
```

The importer prefers the user's VirtualStore files. It does not infer undocumented numeric method, juristic or volume codes, minute offsets or old reminder formats. Warnings identify the settings left at defaults. Recording paths point at the original installation; removing that installation will require selecting other files.

```powershell
node dist/cli.js calendar --month 2026-09 --format csv --out september.csv
node dist/cli.js calendar --year 2027 --format ics --out prayers-2027.ics
node dist/cli.js convert --gregorian 2026-09-13
node dist/cli.js convert --hijri 1448-04-02
node dist/cli.js islamic-days 1448
node dist/cli.js reference athan --fajr
node dist/cli.js reference dua
node dist/cli.js reference prayer-units
```

CSV is a printable tabular export. ICS contains five one-minute, nonblocking calendar events per day; it does not install calendar notifications. Export paths must not already exist. Date inputs support modern Gregorian dates from 1900–2100, with neighbouring dates required at boundary calculations; Hijri reverse conversion is bounded to 1900–2099. Night midpoint and last third use Maghrib to the following day's Fajr.

## Local network alerts

The optional UDP transport replaces obsolete Windows Messenger `NET SEND`. It is disabled by default and is **not compatible with the old Messenger protocol**. Set `network.enabled` and explicit targets, for example `[{"host":"192.168.1.25","port":45845}]`. A receiver can run:

```powershell
node dist/cli.js listen --host 0.0.0.0 --port 45845
```

Messages are versioned JSON and the receiver prints them. It does not execute received content or play received file paths. UDP is best-effort, unauthenticated, and intended for a trusted LAN. The GUI's notifications are for the local scheduler; the LAN receiver remains a CLI feature. No network targets were configured or contacted during setup.

## Reliability and development

`npm.cmd test` builds and runs the tests on Windows (`npm test` on other platforms). They cover published reference values, both Melbourne DST changes, host-zone independence, the civil date line, polar behavior, Ramadan, Hijri round trips, leap calendars, input validation, exact-time triggers, sleep grace, duplicate suppression, concurrent claims, restart/crash state, CLI exports, import and audio queue behavior. Automated audio tests use a fake player. A separate real Windows WMA decoding test was performed at volume zero.

An event is committed to SQLite **before** its side effects. This gives at-most-once attempts, including across restarts and overlapping polls. A crash between claim and playback can miss a call; `claimed` means completion is unknown. Failed calls are logged and are not retried automatically. Short delays up to the configurable grace period are caught; older calls are marked skipped instead of all playing after a long sleep. Corrupt history is reported, never reset silently. Keep the same state directory to retain duplicate protection.

Core exports are in `src/index.ts`. `calculateDay`, `nextPrayer`, calendar helpers and `eventsForDay` are reusable without the CLI. `Scheduler.tick` accepts an injected clock instant and dispatch function. `AudioQueue` accepts a test player. `src/desktop` hosts Electron and a narrow IPC bridge; `ui/src` contains the React interface. The renderer is sandboxed with Node integration disabled, context isolation enabled, a local-only content policy, and validated main-process requests.

`npm.cmd run build` builds both core and UI. `npm.cmd run typecheck` checks both projects. `npm.cmd run test:desktop` runs the Electron interaction tests after a build, using a separate temporary profile with sound muted and notifications disabled. Tests exercise real navigation, persistence, validation errors, calendar export, reminders, scheduler start/stop, theme persistence, and layout. Native save dialogs are substituted in export tests. Screenshots are written to `docs/screenshots`.

Dependencies are pinned in `package-lock.json`. See [third-party notes](THIRD_PARTY.md).
