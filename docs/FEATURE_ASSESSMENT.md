# Athan 4.5 assessment and replacement coverage

Assessed on 13 September 2026 using the installed **Athan Basic 4.5** files, bundled English FAQ and language catalogue, saved configuration and recording inventory. The publisher's [Windows feature table](https://www.islamicfinder.org/athan-windows/) also distinguishes Basic and Pro. A feature appearing in shared help is not proof that Basic unlocks it.

The product's strongest feature is its offline daily routine: choose a location and calculation settings once, then receive the calls automatically. Separate recordings, local timetable corrections and calendar tools are useful additions. Its main weaknesses are dated Windows media dependencies, opaque settings and daylight-saving data, hidden/tray-only behavior, and limited diagnostic visibility. The earlier launch problem in this session resolved by starting the application; it was not established to be an audio or calculation fault.

## Functional comparison

| Capability | Evidence in the original | Replacement now |
|---|---|---|
| Five automatic daily calls | Basic and Pro | Offline scheduler; each prayer individually enabled |
| Sunrise and full daily timetable | Local UI labels/help | Desktop dashboard and countdown, six times, explicit time zone, JSON or text |
| Location selection and manual coordinates | Basic; extended city search online | Country-then-city desktop picker, 235,803 offline cities/towns, saved locations, manual coordinates, installed catalogue CLI search and optional online lookup |
| Claimed six-million-city coverage | Publisher's search service | Modern equivalent via optional Open-Meteo/GeoNames lookup; exact database/coverage not reproduced |
| Five calculation presets and customization | Local FAQ explains angles | Original five plus eight more, custom angles/intervals |
| Standard/Hanafi Asr | Local FAQ | Both supported |
| Dhuhr/Maghrib margins and minute corrections | Local FAQ; Basic and Pro | Explicit margins and all six minute offsets |
| Time zone and daylight saving | Original stores numeric offsets/rules | IANA zones, automatic dated DST transitions |
| Audio recordings and dua | Basic and Pro | Native Windows playback; local WMA/MP3/WAV where supported by installed codecs; dua sequence; dismiss current alert/sound without pausing future calls |
| Different reciter per prayer / own files | Pro in publisher table; shared FAQ | Separate file per prayer, custom paths |
| Bismillah on startup / volume | Local settings and files | Separate Basmallah switch, off by default; saved startup recording and volume |
| Quran reminders before/after prayer | Pro | Signed offsets, selected audio, repetition, independent enable flags |
| Calendar display and Hijri correction | Basic and Pro | Gregorian/Umm al-Qura month grid, Ramadan shading, event navigation and ±2 day correction |
| Gregorian ↔ Hijri conversion | Pro in table | Both directions |
| Special Islamic days | Basic and Pro | Estimated annual observances, explicitly marked estimates |
| Monthly/annual printable timetable | Local help/labels; annual web link | Monthly, Ramadan, annual overview and twelve-month prayer PDF layouts; JSON, CSV and ICS exports retained |
| Qibla graphic | Pro | Calculated true-north bearing with optional Windows device compass; magnetic-only readings are labelled separately |
| Last third of night / Tahajjud help | Local FAQ | Calculated night midpoint and last third |
| Network prayer alerts | Pro; Windows Messenger in help | Opt-in JSON/UDP sender and CLI receiver; new protocol |
| Windows startup and complete exit | Advanced options/tray | Explicit startup registration, foreground or hidden run, graceful stop |
| Twelve/24-hour time display | Local setting | Configurable time formatting |
| Languages, skins, mosque photos, tray, popup behavior | Shared UI resources and Pro features | Native desktop window, light/dark/system themes, original landscape artwork, tray controls and optional local Windows notifications; English only |
| Athan text / rakaat reference screens | Local HTML/help | CLI Arabic/transliteration/meaning, Fajr variant, dua and prayer-unit data |
| Upgrade checks, promotion, installer/uninstaller | Legacy program shell | Normal source build; packaged installer/updater deferred |

## Implementation choices

The core uses the MIT-licensed [Adhan library](https://github.com/batoulapps/adhan-js) for astronomy. It calculates UTC instants and formats them in the selected location's zone. [The library's parameter guide](https://github.com/batoulapps/adhan-js/blob/master/METHODS.md) documents angles, high-latitude handling and preset behavior. The replacement adds legacy-style Dhuhr/Maghrib margins, civil date-line alignment, location profiles, validated persistence, calendar conversion, scheduling and audio orchestration around it. Exact minute-for-minute equivalence with the closed-source original has not been established.

Settings and data do not require writes inside Program Files. Durable event IDs and an atomic SQLite claim prevent duplicate attempts. Polling continues while audio plays. Startup and reminder audio can be interrupted by an Athan. Late queued audio and failed playback are visible in history. A corrupt ledger fails visibly rather than losing prior delivery records.

The existing user recordings are referenced in place for this PC. The original executable, media, artwork, translations and complete city catalogue are not redistributed. The desktop city catalogue is adapted from [GeoNames' cities500 data](https://download.geonames.org/export/dump/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It includes 235,803 locations across 246 countries and territories, with source hashes, attribution and rebuild instructions in `assets/locations`.

Optional worldwide lookup uses the [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api), backed by GeoNames. Its results include IANA zones and attribution. Internet access is confined to explicit lookup commands; it is not part of prayer-time calculation or scheduling.

## Initial profile and validation

Coburg uses latitude **-37.75**, longitude **144.9667**, **Australia/Melbourne**, and **Muslim World League**, as selected in this session. Standard Asr is the documented initial default. Egypt.wma, dua.wma and Bismillah.wma are the existing local recordings. Existing cryptic method codes were not assumed to mean MWL.

Calculation tests include the [upstream Raleigh time fixture](https://github.com/batoulapps/adhan-js/blob/develop/test/adhan.test.ts) and [Sydney Qibla fixture](https://github.com/batoulapps/adhan-js/blob/main/test/qibla.test.ts). Additional tests exercise real calendar transitions and scheduler failure cases. These establish implementation behavior; they do not establish agreement with a specific local mosque timetable. All local mosque corrections remain configurable.

Windows audio was separately tested with your existing recording at zero volume, confirming successful decoding and bounded playback. Speaker audibility and a real future prayer-time call have not been observed. Automatic alerts have since been enabled in the replacement; their state is remembered across launches.

Core automated coverage includes catalogue integrity and IANA zones, country filtering, pagination, saved settings, incomplete online records, stale replies and network failure recovery. Dismissal tests cover cancellation of active/queued audio, durable dismissed history, later alerts, and a four-line tray tooltip showing location, current prayer, next prayer/time and remaining time, independently of alert settings. Desktop tests use isolated configurations with silent audio and suppressed native notifications. Live Berlin, London and Sydney searches passed through the desktop picker after switching desktop requests to Chromium networking and skipping incomplete provider entries. No Windows sign-in startup entry was installed during testing.

## GUI phase

Implemented a native Electron window around the existing core with a React interface. The desktop shell includes the prayer dashboard and live countdown, settings and locations, audio selection and preview, reminder editing, calendar exports, a Qibla compass, light/dark/system themes, tray and notification controls, and delivery diagnostics. UI controls have accessible names, visible keyboard focus, and reduced-motion support. Fonts and original vector artwork load locally.

The app starts with automatic alerts paused. Its scheduler shares the CLI's durable event ledger and supports graceful start/stop; saved desktop settings apply while alerts run. The interface, persistence, exports, reminders, scheduler lifecycle, sandbox isolation, and compact window layout were tested in Electron. English is the current interface language. Reference screens, the CLI LAN receiver, a packaged installer, and an updater remain future additions.

The home page now includes **Stop Athan**, available for active calls, reminders or previews without disabling the scheduler. The calendar provides Gregorian/Hijri conversion, selected-day prayer times, Ramadan shading, event markers and a separate Hijri-year event list with direct date navigation. Four offline PDF layouts provide a monthly timetable, a full Ramadan timetable with fasting times, an annual overview and twelve monthly prayer timetables. The PDFs use original vector decoration, embedded fonts, saved calculation settings and local daylight saving. Their page counts and date coverage are tested; the rendered examples were visually checked. Islamic dates are labelled as estimates, with local moon-sighting and tradition-specific qualifications.


## Device sources and devotional readings

The tray tooltip follows the requested four-line format, with a live next-prayer countdown. Recording browse buttons use the selected file's existing directory. Device location is requested explicitly through Windows and staged for review before saving; measured coordinates are retained while the nearby catalogue city supplies a suggested time zone. Windows compass readings can orient the Qibla dial when true north is available. Hardware absence, denied access, magnetic-only readings and stale readings have explicit fallback states. The PC tested on 16 September 2026 had no Windows compass sensor and denied location access; no Windows privacy settings were changed.

A new reading section provides 97 offline dua/dhikr selections based on the kinds of supplications found in Hisnul Muslim, with Arabic, transliteration, meanings and supplied references, plus favorites, searching, category filters and a recitation counter. This is explicitly a selection rather than the full numbered book. Twelve sourced hadith meanings are labelled as paraphrases. Attribution, the MIT-licensed source and fixed source revision are recorded in `assets/devotion/README.md`.

Daily hadith and dua notifications have separate switches and local times, both off by default. A separate SQLite ledger prevents duplicate daily deliveries across restarts and daylight-saving folds. These silent notifications are independent of the prayer scheduler and can open the full reading or be dismissed. Closing to the tray keeps enabled daily reminders running even when prayer calls are paused.
