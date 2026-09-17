# Current requested update — 16 September 2026

User-approved scope:
- Duha/Ishraq estimated time window (20 minutes after sunrise, adjustable; before solar noon).
- Gregorian/Hijri calendar mode, identical layout; month/year exports follow selected calendar, including CSV/ICS.
- Bismillah on startup under Settings; launch-time playback including Windows sign-in, independent of restarting prayer scheduling. Keep disabled unless user enables. Preserve separate Windows startup switch.
- Call scheduled Athans prayers, reserve reminders/alerts for manual non-prayer reminders.
- Full Hisnul Muslim from user-provided majmoo-io repository/Sunnah.com, numbered chapters/entries, references and source URLs for every reading.
- Optional major hadith collection downloads through official Sunnah.com API (requires user-supplied API key); browser/desktop support where feasible, no invented completeness.
- Refined local/offline status placement; event list centres today's/upcoming event.
- Open exported file / show in folder.
- Device language default plus global selector: English, Arabic, Urdu, Turkish, Indonesian, French (explicitly chosen by user). Full UI translation and RTL, localized dates.

Before this update: 64 core + 17 desktop tests and browser smoke test passing. Real app PID 36832 (verify before restart), config Coburg North/MWL, volume 30, Bismillah off, prayer scheduler enabled. Daily hadith/dua reminders off. Never change the original Athan install or Windows privacy settings. Use npm.cmd.

Source: https://github.com/majmoo-io/hisnu-al-muslim-data/tree/main/data/ar.al-qahtani-sunnah-com (AGPL-3.0 repository; preserve attribution/licence). Official API docs https://sunnah.com/developers explicitly require API key and expose only manually checked portion of collections. Do not create public request/issue or transmit key without user action. API key entry belongs in app, not chat.

Implementation complete and production desktop/browser builds passed. Added complete Hisnul Muslim, official-API hadith downloads, shared Hijri month/year boundaries, Duha, startup-only Bismillah, file actions, current-event centring and six UI languages (452 translated phrases, RTL and localized PDF/date headings).

Verification: 72 core tests, 19 desktop tests and 2 browser tests passed, plus the offline/device browser smoke check. Six final PDF samples generated with expected page counts (1/1/1/12/1/1); latest Arabic Ramadan and Urdu annual pages visually checked. No live Sunnah.com API key was supplied; network tests use fixtures.

The additional desktop fixture check for connection/download/source/offline reading also passed after the user approved the final check and restart. Its offline fixture permits local app files while rejecting network access. Live app restarted successfully at 2026-09-16T06:03:08Z: scheduler PID 34796, Coburg North, Victoria. Configuration and preferences SHA-256 hashes were unchanged across the restart. Bismillah and daily reading reminders remain off. The approval-service limit initially blocked the extra check; the subsequent explicit approval allowed completion.

Live window verified after restart: language selector, Hisnul Muslim and Hadith library navigation, Duha/Ishraq window, refined offline footer and Automatic Athan on. Next prayer shown as Maghrib at 6:12 pm. Requested update complete.
